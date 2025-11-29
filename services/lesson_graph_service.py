"""Build student-facing lesson subgraph."""

from __future__ import annotations

import re
from typing import Dict, List, Set

import database
from services import graph_service
from services.graph_service import GraphUnavailableError, _execute_read


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text or "")


def build_lesson_subgraph(lesson_id: str) -> Dict[str, object]:
    """Return nodes/edges/highlights for a lesson (linked + detected)."""
    lesson = database.get_theory_lesson(lesson_id, include_unpublished=False)
    if not lesson:
        return {"nodes": [], "edges": [], "highlights": []}

    linked_names: Set[str] = set()
    detected_names: Set[str] = set()
    try:
        detail = graph_service.get_lesson_detail(lesson_id)
        for kp in detail.get("knowledgePoints") or []:
            name = (kp.get("name") or "").strip()
            if name:
                linked_names.add(name)
    except GraphUnavailableError:
        linked_names = set()

    try:
        detected = graph_service.detect_knowledge_points_in_text(
            lesson.get("contentHtml") or ""
        )
        for kp in detected:
            name = (kp.get("name") or "").strip()
            if name:
                detected_names.add(name)
    except GraphUnavailableError:
        detected_names = set()

    target_names = linked_names | detected_names
    if not target_names:
        return {"nodes": [], "edges": [], "highlights": []}

    params = {"names": list(target_names)}
    records = _execute_read(
        """
        MATCH (kp:KnowledgePoint)
        WHERE kp.name IN $names
        OPTIONAL MATCH (t:Topic)-[:INCLUDE_POINT|:HAS_TOPIC]->(kp)
        OPTIONAL MATCH (s:Stage)-[:CONTAIN_TOPIC]->(t)
        WITH kp, t, s
        OPTIONAL MATCH (kp)-[r:REQUIRES]->(p:KnowledgePoint)
        RETURN kp, t, s, collect(DISTINCT {from: kp.name, to: p.name, type: type(r)}) AS prereqRels
        """,
        params,
    )

    nodes: Dict[str, Dict[str, object]] = {}
    edges: List[Dict[str, object]] = []

    def add_node(key: str, label: str, title: str = "", node_type: str = ""):
        if not key or key in nodes:
            return
        nodes[key] = {
            "id": key,
            "key": key,
            "name": title or key,
            "label": node_type or label,
            "title": title or key,
        }

    def add_edge(src: str, tgt: str, etype: str):
        if not src or not tgt:
            return
        edges.append({"source": src, "target": tgt, "type": etype})

    for rec in records:
        kp = rec.get("kp")
        if kp:
            name = kp.get("name")
            add_node(name, "KnowledgePoint", kp.get("title") or kp.get("name"), "KnowledgePoint")
        t = rec.get("t")
        s = rec.get("s")
        if t:
            tkey = t.get("key") or t.get("id") or t.get("name")
            add_node(tkey, "Topic", t.get("title") or t.get("name"), "Topic")
        if s:
            skey = s.get("key") or s.get("id") or s.get("name")
            add_node(skey, "Stage", s.get("title") or s.get("name"), "Stage")
        if t and kp:
            add_edge(t.get("key") or t.get("id") or t.get("name"), kp.get("name"), "INCLUDE_POINT")
        if s and t:
            add_edge(s.get("key") or s.get("id") or s.get("name"), t.get("key") or t.get("id") or t.get("name"), "CONTAIN_TOPIC")
        for rel in rec.get("prereqRels") or []:
            add_edge(rel.get("from"), rel.get("to"), rel.get("type") or "REQUIRES")

    return {
        "nodes": list(nodes.values()),
        "edges": edges,
        "highlights": list(target_names),
    }
