"""Lexical suggestions service: surface tone/civic/idiomatic replacements based on the lexical network."""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Sequence

from services import graph_service


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
    driver = graph_service._get_driver()
    with driver.session() as session:
        records = session.run(
            """
            WITH $tokens AS tokens
            MATCH (k:KnowledgePoint)
            WHERE any(t IN tokens WHERE toLower(k.name) CONTAINS t)
            OPTIONAL MATCH (k)-[rc:IN_CLASS]->(sc:SemanticClass)
            OPTIONAL MATCH (k)-[rs:FITS_SLOT]->(s:Slot)
            OPTIONAL MATCH (k)-[:RELATED_TO {kind:'lex_anchor'}]->(anchor:KnowledgePoint)
            RETURN k.name AS lex_item,
                   collect(DISTINCT {class: sc.key, tone: rc.tone, civicTags: rc.civicTags, idiomatic: rc.idiomatic}) AS classes,
                   collect(DISTINCT {slot: s.name, tone: rs.tone, civicTags: rs.civicTags, idiomatic: rs.idiomatic}) AS slots,
                   collect(DISTINCT anchor.name) AS anchors
            """,
            {"tokens": tokens},
        ).data()
    return records or []


def _build_suggestion(base: Dict, trigger_type: str, recommendations: List[Dict], knowledge_points: List[str]) -> Dict:
    return {
        "lex_item": base.get("lex_item"),
        "semantic_class": base.get("semantic_class"),
        "slot": base.get("slot"),
        "tone": base.get("tone"),
        "civicTags": base.get("civicTags") or [],
        "idiomatic": base.get("idiomatic"),
        "trigger": trigger_type,
        "recommendations": recommendations,
        "knowledge_points": knowledge_points,
    }


def get_lexical_suggestions(utterance: str) -> Dict[str, List[Dict]]:
    tokens = _tokenize(utterance)
    if not tokens:
        return {"suggestions": []}

    hits = _collect_hits(tokens)
    suggestions: List[Dict] = []

    for hit in hits:
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
                            },
                            "idiomatic_shift",
                            idiomatic_recs,
                            anchors,
                        )
                    )

    return {"suggestions": suggestions}
