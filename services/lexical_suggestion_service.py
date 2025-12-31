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
              AND ($civicPositive = false OR any(c IN r.civicTags WHERE c IN $positive))
              AND ($idiomatic IS NULL OR r.idiomatic = $idiomatic)
            RETURN k.name AS lex_item, r.tone AS tone, r.civicTags AS civicTags, r.idiomatic AS idiomatic, sc.key AS semantic_class
            LIMIT $limit
            """,
            {
                "class": class_key,
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
              AND ($civicPositive = false OR any(c IN r.civicTags WHERE c IN $positive))
              AND ($idiomatic IS NULL OR r.idiomatic = $idiomatic)
            RETURN k.name AS lex_item, r.tone AS tone, r.civicTags AS civicTags, r.idiomatic AS idiomatic, s.name AS slot
            LIMIT $limit
            """,
            {
                "slot": slot,
                "tones": list(tones) if tones else None,
                "civicPositive": bool(civic_positive_only),
                "positive": list(POSITIVE_CIVICS),
                "idiomatic": idiomatic,
                "limit": limit,
            },
        ).data()
    return records or []


def _collect_hits(tokens: List[str]) -> List[Dict]:
    """Return matched lex items and their relations."""
    filtered_tokens = [t for t in tokens if len(t) >= 3]
    if not filtered_tokens:
        return []
    driver = graph_service._get_driver()
    with driver.session() as session:
        records = session.run(
            """
            WITH $tokens AS tokens
            MATCH (k:KnowledgePoint)
            WHERE any(t IN tokens WHERE size(t) >= 3 AND toLower(k.name) CONTAINS t)
            OPTIONAL MATCH (k)-[rc:IN_CLASS]->(sc:SemanticClass)
            OPTIONAL MATCH (k)-[rs:FITS_SLOT]->(s:Slot)
            OPTIONAL MATCH (k)-[:RELATED_TO {kind:'lex_anchor'}]->(anchor:KnowledgePoint)
            RETURN k.name AS lex_item,
                   [c IN collect(DISTINCT {class: sc.key, tone: rc.tone, civicTags: rc.civicTags, idiomatic: rc.idiomatic}) WHERE c.class IS NOT NULL] AS classes,
                   [s IN collect(DISTINCT {slot: s.name, tone: rs.tone, civicTags: rs.civicTags, idiomatic: rs.idiomatic}) WHERE s.slot IS NOT NULL] AS slots,
                   collect(DISTINCT anchor.name) AS anchors
            LIMIT 200
            """,
            {"tokens": filtered_tokens},
        ).data()
    return records or []


# ==============================
# 向量召回（可选，模型可用时）
# ==============================

_LEXICON_CACHE: Dict[str, object] = {
    "items": [],  # list of payloads
    "vectors": None,  # numpy array
}


def _fetch_lexicon_index() -> Tuple[List[Dict], Optional[np.ndarray]]:
    """Load lexical items with class/slot relations and compute embeddings if模型可用."""
    if _LEXICON_CACHE.get("items") and _LEXICON_CACHE.get("vectors") is not None:
        return _LEXICON_CACHE["items"], _LEXICON_CACHE["vectors"]

    driver = graph_service._get_driver()
    with driver.session() as session:
        records = session.run(
            """
            MATCH (k:KnowledgePoint)
            OPTIONAL MATCH (k)-[rc:IN_CLASS]->(sc:SemanticClass)
            OPTIONAL MATCH (k)-[rs:FITS_SLOT]->(s:Slot)
            WITH k,
                 [c IN collect(DISTINCT {class: sc.key, tone: rc.tone, civicTags: rc.civicTags, idiomatic: rc.idiomatic}) WHERE c.class IS NOT NULL] AS classes,
                 [s IN collect(DISTINCT {slot: s.name, tone: rs.tone, civicTags: rs.civicTags, idiomatic: rs.idiomatic}) WHERE s.slot IS NOT NULL] AS slots
            WHERE size(classes) > 0 OR size(slots) > 0
            RETURN k.name AS lex_item,
                   k.lex_role AS lex_role,
                   classes,
                   slots
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
        text_parts = [lex_item]
        if lex_role:
            text_parts.append(f"[role={lex_role}]")
        if classes:
            class_labels = [c.get("class") for c in classes if c.get("class")]
            if class_labels:
                text_parts.append(f"class={'|'.join(class_labels)}")
            tones = [c.get("tone") for c in classes if c.get("tone")]
            if tones:
                text_parts.append(f"tone={'|'.join(tones)}")
            civics = []
            for c in classes:
                civics.extend(c.get("civicTags") or [])
            if civics:
                text_parts.append(f"civic={'|'.join(civics)}")
        if slots:
            slot_labels = [s.get("slot") for s in slots if s.get("slot")]
            if slot_labels:
                text_parts.append(f"slots={'|'.join(slot_labels)}")

        full_text = " ".join(text_parts).strip()
        if not full_text:
            continue

        items.append(
            {
                "lex_item": lex_item,
                "lex_role": lex_role,
                "classes": classes,
                "slots": slots,
            }
        )
        texts.append(full_text)

    if not texts:
        _LEXICON_CACHE["items"] = []
        _LEXICON_CACHE["vectors"] = None
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
    q = np.nan_to_num(q, nan=0.0)
    try:
        scores = vectors @ q  # 因为向量已归一化，可直接点乘
    except Exception as e:
        logger.error("Vector calculation error: %s", e)
        return []
    if scores.size == 0:
        return []
    top_idx = np.argsort(-scores)[:top_k]
    hits = []
    for idx in top_idx:
        score = float(scores[idx])
        if score < 0.65:  # 更高阈值，过滤噪声
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


def get_lexical_suggestions(utterance: str) -> Dict[str, List[Dict]]:
    tokens = _tokenize(utterance)
    if not tokens:
        return {"suggestions": []}

    hits_graph = _collect_hits(tokens)
    hits_vec = _vector_hits(utterance, top_k=30)

    # 合并 graph + vector 命中，graph 优先（score 置 1.0）
    merged: Dict[str, Dict] = {}
    for hit in hits_graph:
        merged[hit.get("lex_item")] = {**hit, "score": 1.0}
    for hit in hits_vec:
        key = hit.get("lex_item")
        if key in merged:
            continue
        merged[key] = {
            "lex_item": hit.get("lex_item"),
            "classes": hit.get("classes"),
            "slots": hit.get("slots"),
            "score": hit.get("score"),
        }

    suggestions: List[Dict] = []

    for hit in merged.values():
        lex_item = hit.get("lex_item")
        anchors = [a for a in (hit.get("anchors") or []) if a]

        for cls_rel in hit.get("classes") or []:
            cls_key = cls_rel.get("class")
            if not cls_key:
                continue

            civic_tags = cls_rel.get("civicTags") or []
            tone = (cls_rel.get("tone") or "").lower()
            idiomatic = cls_rel.get("idiomatic")

            # 负面思政 -> 推荐正面
            if any(tag in NEGATIVE_CIVICS for tag in civic_tags):
                recs = _query_alternatives_by_class(cls_key, civic_positive_only=True, limit=5)
                if recs:
                    suggestions.append(
                        _build_suggestion(
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
                            anchors,
                        )
                    )

            # neutral 语气 -> softer/stronger
            if tone == NEUTRAL:
                tone_recs = _query_alternatives_by_class(cls_key, tones=SOFTER_SET | STRONGER_SET, limit=6)
                if tone_recs:
                    suggestions.append(
                        _build_suggestion(
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
                            anchors,
                        )
                    )

            # idiomatic = False -> 推荐 idiomatic=True
            if idiomatic is False:
                idiomatic_recs = _query_alternatives_by_class(cls_key, idiomatic=True, limit=5)
                if idiomatic_recs:
                    suggestions.append(
                        _build_suggestion(
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
                            anchors,
                        )
                    )

        for slot_rel in hit.get("slots") or []:
            slot_name = slot_rel.get("slot")
            if not slot_name:
                continue
            civic_tags = slot_rel.get("civicTags") or []
            tone = (slot_rel.get("tone") or "").lower()
            idiomatic = slot_rel.get("idiomatic")

            if any(tag in NEGATIVE_CIVICS for tag in civic_tags):
                recs = _query_alternatives_by_slot(slot_name, civic_positive_only=True, limit=5)
                if recs:
                    suggestions.append(
                        _build_suggestion(
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
                            anchors,
                        )
                    )

            if tone == NEUTRAL:
                tone_recs = _query_alternatives_by_slot(slot_name, tones=SOFTER_SET | STRONGER_SET, limit=6)
                if tone_recs:
                    suggestions.append(
                        _build_suggestion(
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
                            anchors,
                        )
                    )

            if idiomatic is False:
                idiomatic_recs = _query_alternatives_by_slot(slot_name, idiomatic=True, limit=5)
                if idiomatic_recs:
                    suggestions.append(
                        _build_suggestion(
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
                            anchors,
                        )
                    )

    # 降噪：按 trigger 排序、score 降序、最多返回 12 条
    trigger_order = {"negative_civic": 0, "tone_shift": 1, "idiomatic_shift": 2}
    suggestions.sort(key=lambda x: (trigger_order.get(x.get("trigger"), 99), -(x.get("score") or 0)))
    return {"suggestions": suggestions[:12]}
