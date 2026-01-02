"""Lexical suggestions service: surface tone/civic/idiomatic replacements based on the lexical network."""

from __future__ import annotations

import logging
import re
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np

from services import embedding_service
from services import graph_service

logger = logging.getLogger(__name__)


NEGATIVE_CIVICS = {"Zero-Sum", "Dishonesty", "Disrespect", "Non-Compliance"}
POSITIVE_CIVICS = {"Win-Win", "Integrity", "Dignity", "Compliance"}
SOFTER_SET = {"softer"}
STRONGER_SET = {"stronger"}
NEUTRAL = "neutral"


def _tokenize(text: str) -> List[str]:
    if not text:
        return []
    return [tok.lower() for tok in re.split(r"[^A-Za-z0-9]+", text) if tok.strip()]


def _query_alternatives_by_class(
    class_key: str,
    *,
    context_anchors: Optional[List[str]] = None,
    tones: Optional[Sequence[str]] = None,
    civic_positive_only: bool = False,
    idiomatic: Optional[bool] = None,
    limit: int = 5,
) -> List[Dict]:
    driver = graph_service._get_driver()
    with driver.session() as session:
        records = session.run(
            """
            MATCH (k:KnowledgePoint)-[r:IN_CLASS]->(sc:SemanticClass {key: $class})
            WHERE ($tones IS NULL OR r.tone IN $tones)
              AND ($anchors IS NULL OR size($anchors) = 0 OR exists {
                MATCH (k)-[:RELATED_TO*1..2]->(kp:KnowledgePoint)
                WHERE kp.name IN $anchors
              })
              AND ($civicPositive = false OR any(c IN r.civicTags WHERE c IN $positive))
              AND ($idiomatic IS NULL OR r.idiomatic = $idiomatic)
            RETURN k.name AS lex_item, r.tone AS tone, r.civicTags AS civicTags, r.idiomatic AS idiomatic, sc.key AS semantic_class
            LIMIT $limit
            """,
            {
                "class": class_key,
                "anchors": list(context_anchors) if context_anchors else [],
                "tones": list(tones) if tones else None,
                "civicPositive": bool(civic_positive_only),
                "positive": list(POSITIVE_CIVICS),
                "idiomatic": idiomatic,
                "limit": limit,
            },
        ).data()
    return records or []


def _query_alternatives_by_slot(
    slot: str,
    *,
    context_anchors: Optional[List[str]] = None,
    tones: Optional[Sequence[str]] = None,
    civic_positive_only: bool = False,
    idiomatic: Optional[bool] = None,
    limit: int = 5,
) -> List[Dict]:
    driver = graph_service._get_driver()
    with driver.session() as session:
        records = session.run(
            """
            MATCH (k:KnowledgePoint)-[r:FITS_SLOT]->(s:Slot {name: $slot})
            WHERE ($tones IS NULL OR r.tone IN $tones)
              AND ($anchors IS NULL OR size($anchors) = 0 OR exists {
                MATCH (k)-[:RELATED_TO*1..2]->(kp:KnowledgePoint)
                WHERE kp.name IN $anchors
              })
              AND ($civicPositive = false OR any(c IN r.civicTags WHERE c IN $positive))
              AND ($idiomatic IS NULL OR r.idiomatic = $idiomatic)
            RETURN k.name AS lex_item, r.tone AS tone, r.civicTags AS civicTags, r.idiomatic AS idiomatic, s.name AS slot
            LIMIT $limit
            """,
            {
                "slot": slot,
                "anchors": list(context_anchors) if context_anchors else [],
                "tones": list(tones) if tones else None,
                "civicPositive": bool(civic_positive_only),
                "positive": list(POSITIVE_CIVICS),
                "idiomatic": idiomatic,
                "limit": limit,
            },
        ).data()
    return records or []


def _collect_hits(utterance: str, tokens: List[str]) -> List[Dict]:
    """Return matched lex items and their relations."""
    # Graph 命中用于“精确/半精确”匹配：避免仅靠单个高频词（如 price/ship）把召回范围拉爆。
    # 这里仅保留更有区分度的 token，并在 Cypher 侧要求至少 2 个 token 命中（除非是精确/强包含命中）。
    filtered_tokens = [t for t in tokens if (len(t) >= 4 or t.isdigit())]
    utterance_lower = (utterance or "").strip().lower()
    if not utterance_lower and not filtered_tokens:
        return []
    driver = graph_service._get_driver()
    with driver.session() as session:
        records = session.run(
            """
            WITH $tokens AS tokens, $utterance AS utterance, $roles AS roles
            MATCH (k:KnowledgePoint)
            WHERE k.lex_role IN roles
              AND (
                (utterance <> '' AND toLower(k.name) = utterance)
                OR (utterance <> '' AND size(k.name) >= 8 AND utterance CONTAINS toLower(k.name))
                OR (utterance <> '' AND size(utterance) >= 8 AND toLower(k.name) CONTAINS utterance)
                OR any(t IN tokens WHERE size(t) >= 3 AND toLower(k.name) CONTAINS t)
              )
            WITH k, tokens, utterance,
                 size([t IN tokens WHERE size(t) >= 3 AND toLower(k.name) CONTAINS t]) AS tokenHits,
                 CASE
                   WHEN (utterance <> '' AND toLower(k.name) = utterance) THEN 3
                   WHEN (utterance <> '' AND size(k.name) >= 8 AND utterance CONTAINS toLower(k.name)) THEN 2
                   WHEN (utterance <> '' AND size(utterance) >= 8 AND toLower(k.name) CONTAINS utterance) THEN 1
                   ELSE 0
                 END AS matchScore
            WHERE matchScore > 0 OR tokenHits >= 2
            OPTIONAL MATCH (k)-[rc:IN_CLASS]->(sc:SemanticClass)
            OPTIONAL MATCH (k)-[rs:FITS_SLOT]->(s:Slot)
            OPTIONAL MATCH (k)-[:RELATED_TO {kind:'lex_anchor'}]->(anchor:KnowledgePoint)
            RETURN k.name AS lex_item,
                   [c IN collect(DISTINCT {class: sc.key, tone: rc.tone, civicTags: rc.civicTags, idiomatic: rc.idiomatic}) WHERE c.class IS NOT NULL] AS classes,
                   [s IN collect(DISTINCT {slot: s.name, tone: rs.tone, civicTags: rs.civicTags, idiomatic: rs.idiomatic}) WHERE s.slot IS NOT NULL] AS slots,
                   collect(DISTINCT anchor.name) AS anchors,
                   tokenHits AS tokenHits,
                   matchScore AS matchScore
            ORDER BY matchScore DESC, tokenHits DESC, size(k.name) DESC
            LIMIT 20
            """,
            {"tokens": filtered_tokens, "utterance": utterance_lower, "roles": ["lexeme", "collocation", "construction"]},
        ).data()
    return records or []


# ==============================
# 向量召回（可选，模型可用时）
# ==============================

_LEXICON_CACHE: Dict[str, object] = {
    "items": [],  # list of payloads
    "vectors": None,  # numpy array
    "loaded": False,  # cache populated at least once
}


def _fetch_lexicon_index() -> Tuple[List[Dict], Optional[np.ndarray]]:
    """Load lexical items with class/slot relations and compute embeddings if模型可用."""
    if _LEXICON_CACHE.get("loaded"):
        return _LEXICON_CACHE["items"], _LEXICON_CACHE["vectors"]

    driver = graph_service._get_driver()
    with driver.session() as session:
        records = session.run(
            """
            MATCH (k:KnowledgePoint)
            OPTIONAL MATCH (k)-[rc:IN_CLASS]->(sc:SemanticClass)
            OPTIONAL MATCH (k)-[rs:FITS_SLOT]->(s:Slot)
            OPTIONAL MATCH (k)-[:RELATED_TO {kind:'lex_anchor'}]->(anchor:KnowledgePoint)
            WITH k,
                 [c IN collect(DISTINCT {class: sc.key, tone: rc.tone, civicTags: rc.civicTags, idiomatic: rc.idiomatic}) WHERE c.class IS NOT NULL] AS classes,
                 [s IN collect(DISTINCT {slot: s.name, tone: rs.tone, civicTags: rs.civicTags, idiomatic: rs.idiomatic}) WHERE s.slot IS NOT NULL] AS slots,
                 collect(DISTINCT anchor.name) AS anchors
            WHERE size(classes) > 0 OR size(slots) > 0
            RETURN k.name AS lex_item,
                   k.lex_role AS lex_role,
                   classes,
                   slots,
                   anchors
            LIMIT 10000
            """
        ).data()

    items: List[Dict] = []
    texts: List[str] = []
    for rec in records:
        lex_item = rec.get("lex_item")
        if not lex_item or not lex_item.strip():
            continue
        lex_role = rec.get("lex_role") or ""
        classes = rec.get("classes") or []
        slots = rec.get("slots") or []
        # 向量召回只用于“这句话像不像某个 lex_item”，不要把 tone/civic/slot 等标签拼进文本，
        # 否则会显著拉低相似度并引入跨领域噪声。
        full_text = lex_item.strip()
        if lex_role:
            full_text = f"{full_text} [role={lex_role}]"
        if not full_text:
            continue

        items.append(
            {
                "lex_item": lex_item,
                "lex_role": lex_role,
                "classes": classes,
                "slots": slots,
                "anchors": [a for a in (rec.get("anchors") or []) if a],
            }
        )
        texts.append(full_text)

    if not texts:
        _LEXICON_CACHE["items"] = []
        _LEXICON_CACHE["vectors"] = None
        _LEXICON_CACHE["loaded"] = True
        return [], None

    vectors = embedding_service.embed_texts(texts)
    if vectors and len(vectors) == len(texts):
        vectors_np = np.array(vectors, dtype=np.float32)
        vectors_np = np.nan_to_num(vectors_np, nan=0.0, posinf=0.0, neginf=0.0)
    else:
        logger.warning("Embedding unavailable or length mismatch (texts=%d, vectors=%d)", len(texts), len(vectors) if vectors else 0)
        vectors_np = None
    _LEXICON_CACHE["items"] = items
    _LEXICON_CACHE["vectors"] = vectors_np
    _LEXICON_CACHE["loaded"] = True
    return items, vectors_np


def _vector_hits(utterance: str, top_k: int = 20) -> List[Dict]:
    """返回向量召回的词汇项，并附带其类/槽位关系。"""
    items, vectors = _fetch_lexicon_index()
    if vectors is None or not items:
        return []
    if len(items) != vectors.shape[0]:
        logger.warning("Lexical index mismatch: %d items but %d vectors", len(items), vectors.shape[0])
        return []
    query_vecs = embedding_service.embed_texts([utterance])
    if not query_vecs:
        return []
    q = np.array(query_vecs[0], dtype=np.float32)
    q = np.nan_to_num(q, nan=0.0, posinf=0.0, neginf=0.0)
    vectors = np.nan_to_num(vectors, nan=0.0, posinf=0.0, neginf=0.0)
    try:
        # numpy matmul 在部分环境下会产生“divide by zero/overflow”误报 warning（即使结果是有限值）。
        # 这里用 dot 并在局部屏蔽浮点 warning，避免日志噪音和误判。
        with np.errstate(all="ignore"):
            scores = np.dot(vectors, q)  # 因为向量已归一化，可直接点乘
            scores = np.nan_to_num(scores, nan=0.0, posinf=0.0, neginf=0.0)
    except Exception as e:
        logger.error("Vector calculation error: %s", e)
        return []
    if scores.size == 0:
        return []
    top_idx = np.argsort(-scores)[:top_k]
    hits = []
    for idx in top_idx:
        score = float(scores[idx])
        if np.isnan(score) or score < 0.65:  # 更高阈值，过滤噪声
            continue
        payload = dict(items[int(idx)])
        payload["score"] = score
        hits.append(payload)
    return hits


def _build_suggestion(base: Dict, trigger_type: str, recommendations: List[Dict], knowledge_points: List[str]) -> Dict:
    return {
        "lex_item": base.get("lex_item"),
        "semantic_class": base.get("semantic_class"),
        "slot": base.get("slot"),
        "tone": base.get("tone"),
        "civicTags": base.get("civicTags") or [],
        "idiomatic": base.get("idiomatic"),
        "score": base.get("score"),
        "trigger": trigger_type,
        "recommendations": recommendations,
        "knowledge_points": knowledge_points,
    }


def _rank_context_anchors(utterance: str, anchors: List[str]) -> List[str]:
    """Rank anchors by semantic similarity to the utterance (embedding-based), best-effort."""
    anchors = [a for a in anchors if a]
    if not utterance or not anchors:
        return anchors

    vecs = embedding_service.embed_texts([utterance] + anchors)
    if not vecs or len(vecs) != (1 + len(anchors)):
        return anchors

    try:
        q = np.array(vecs[0], dtype=np.float32)
        a = np.array(vecs[1:], dtype=np.float32)
        q = np.nan_to_num(q, nan=0.0, posinf=0.0, neginf=0.0)
        a = np.nan_to_num(a, nan=0.0, posinf=0.0, neginf=0.0)
        with np.errstate(all="ignore"):
            scores = np.dot(a, q)
        order = np.argsort(-scores)
        return [anchors[int(i)] for i in order]
    except Exception:
        return anchors


def get_lexical_suggestions(utterance: str) -> Dict[str, List[Dict]]:
    tokens = _tokenize(utterance)
    if not tokens:
        return {"suggestions": []}

    hits_graph = _collect_hits(utterance, tokens)
    hits_vec = _vector_hits(utterance, top_k=30)

    # 1) 召回与合并：Graph 优先；向量命中补充（若 Graph 已存在则不覆盖其结构信息）
    merged: Dict[str, Dict] = {}
    for hit in hits_graph:
        merged[hit.get("lex_item")] = {**hit, "score": 1.0}

    for hit in hits_vec:
        key = hit.get("lex_item")
        if key in merged:
            continue
        merged[key] = {
            "lex_item": hit.get("lex_item"),
            "classes": hit.get("classes") or [],
            "slots": hit.get("slots") or [],
            "anchors": hit.get("anchors") or [],
            "score": hit.get("score"),
        }

    # 2) 去重与聚合：同一 lex_item + trigger 只保留 1 条
    unique_suggestions: Dict[Tuple[str, str], Dict] = {}

    for hit in merged.values():
        lex_item = hit.get("lex_item") or ""
        anchors = [a for a in (hit.get("anchors") or []) if a]
        if not anchors:
            # 没有业务锚点就不生成“语义网”替换建议，避免跨领域错配。
            continue
        ranked_anchors = _rank_context_anchors(utterance, anchors)
        context_anchors = ranked_anchors[:15]  # 业务围栏：只用更相关的锚点
        knowledge_points = ranked_anchors[:6]  # UI：避免过载
        if not context_anchors:
            continue

        # 3) 生成建议（带上下文约束）
        for cls_rel in hit.get("classes") or []:
            cls_key = cls_rel.get("class")
            if not cls_key:
                continue

            civic_tags = cls_rel.get("civicTags") or []
            tone = (cls_rel.get("tone") or "").lower()
            idiomatic = cls_rel.get("idiomatic")

            if any(tag in NEGATIVE_CIVICS for tag in civic_tags):
                recs = _query_alternatives_by_class(
                    cls_key,
                    civic_positive_only=True,
                    context_anchors=context_anchors,
                    limit=5,
                )
                if recs:
                    unique_suggestions[(lex_item, "negative_civic")] = _build_suggestion(
                        {
                            "lex_item": lex_item,
                            "semantic_class": cls_key,
                            "tone": tone,
                            "civicTags": civic_tags,
                            "idiomatic": idiomatic,
                            "score": hit.get("score"),
                        },
                        "negative_civic",
                        recs,
                        knowledge_points,
                    )

            if tone == NEUTRAL:
                tone_recs = _query_alternatives_by_class(
                    cls_key,
                    tones=SOFTER_SET | STRONGER_SET,
                    context_anchors=context_anchors,
                    limit=6,
                )
                if tone_recs:
                    unique_suggestions[(lex_item, "tone_shift")] = _build_suggestion(
                        {
                            "lex_item": lex_item,
                            "semantic_class": cls_key,
                            "tone": tone,
                            "civicTags": civic_tags,
                            "idiomatic": idiomatic,
                            "score": hit.get("score"),
                        },
                        "tone_shift",
                        tone_recs,
                        knowledge_points,
                    )

            if idiomatic is False:
                idiomatic_recs = _query_alternatives_by_class(
                    cls_key,
                    idiomatic=True,
                    context_anchors=context_anchors,
                    limit=5,
                )
                if idiomatic_recs:
                    unique_suggestions[(lex_item, "idiomatic_shift")] = _build_suggestion(
                        {
                            "lex_item": lex_item,
                            "semantic_class": cls_key,
                            "tone": tone,
                            "civicTags": civic_tags,
                            "idiomatic": idiomatic,
                            "score": hit.get("score"),
                        },
                        "idiomatic_shift",
                        idiomatic_recs,
                        knowledge_points,
                    )

        for slot_rel in hit.get("slots") or []:
            slot_name = slot_rel.get("slot")
            if not slot_name:
                continue

            civic_tags = slot_rel.get("civicTags") or []
            tone = (slot_rel.get("tone") or "").lower()
            idiomatic = slot_rel.get("idiomatic")

            if any(tag in NEGATIVE_CIVICS for tag in civic_tags):
                key = (lex_item, "negative_civic")
                if key not in unique_suggestions:
                    recs = _query_alternatives_by_slot(
                        slot_name,
                        civic_positive_only=True,
                        context_anchors=context_anchors,
                        limit=5,
                    )
                    if recs:
                        unique_suggestions[key] = _build_suggestion(
                            {
                                "lex_item": lex_item,
                                "slot": slot_name,
                                "tone": tone,
                                "civicTags": civic_tags,
                                "idiomatic": idiomatic,
                                "score": hit.get("score"),
                            },
                            "negative_civic",
                            recs,
                            knowledge_points,
                        )

            if tone == NEUTRAL:
                key = (lex_item, "tone_shift")
                if key not in unique_suggestions:
                    tone_recs = _query_alternatives_by_slot(
                        slot_name,
                        tones=SOFTER_SET | STRONGER_SET,
                        context_anchors=context_anchors,
                        limit=6,
                    )
                    if tone_recs:
                        unique_suggestions[key] = _build_suggestion(
                            {
                                "lex_item": lex_item,
                                "slot": slot_name,
                                "tone": tone,
                                "civicTags": civic_tags,
                                "idiomatic": idiomatic,
                                "score": hit.get("score"),
                            },
                            "tone_shift",
                            tone_recs,
                            knowledge_points,
                        )

            if idiomatic is False:
                key = (lex_item, "idiomatic_shift")
                if key not in unique_suggestions:
                    idiomatic_recs = _query_alternatives_by_slot(
                        slot_name,
                        idiomatic=True,
                        context_anchors=context_anchors,
                        limit=5,
                    )
                    if idiomatic_recs:
                        unique_suggestions[key] = _build_suggestion(
                            {
                                "lex_item": lex_item,
                                "slot": slot_name,
                                "tone": tone,
                                "civicTags": civic_tags,
                                "idiomatic": idiomatic,
                                "score": hit.get("score"),
                            },
                            "idiomatic_shift",
                            idiomatic_recs,
                            knowledge_points,
                        )

    suggestions = list(unique_suggestions.values())
    trigger_order = {"negative_civic": 0, "tone_shift": 1, "idiomatic_shift": 2}
    suggestions.sort(key=lambda x: (trigger_order.get(x.get("trigger"), 99), -(x.get("score") or 0)))
    return {"suggestions": suggestions[:12]}
