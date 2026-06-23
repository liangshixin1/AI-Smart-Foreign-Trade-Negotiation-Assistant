"""Build student-facing lesson subgraph."""

from __future__ import annotations

import re
from typing import Dict, Iterable, List, Optional, Set

import database
from services import graph_service
from services.graph_service import GraphUnavailableError, _execute_read


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text or "")


def build_lesson_subgraph(
    lesson_id: str,
    *,
    detected_names: Optional[Iterable[str]] = None,
) -> Dict[str, object]:
    """Return nodes/edges/highlights for a lesson.

    Runtime detection is intentionally disabled for student端性能，允许上层传入预计算的 detected_names。
    """
    lesson = database.get_theory_lesson(lesson_id, include_unpublished=False)
    if not lesson:
        return {"nodes": [], "edges": [], "highlights": []}

    linked_names: Set[str] = set()
    try:
        detail = graph_service.get_lesson_detail(lesson_id)
        for kp in detail.get("knowledgePoints") or []:
            name = (kp.get("name") or "").strip()
            if name:
                linked_names.add(name)
    except GraphUnavailableError:
        linked_names = set()

    # 学生端不再现场触发检测；预计算结果可通过 detected_names 传入
    detected_set: Set[str] = set()
    if detected_names:
        for name in detected_names:
            if not name:
                continue
            detected_set.add(str(name).strip())

    target_names = linked_names | detected_set
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


def build_lesson_network_view(
    lesson_id: str,
    *,
    snapshot: Optional[Dict[str, object]] = None,
    highlight_names: Optional[Iterable[str]] = None,
    limit: int = 800,
) -> Dict[str, object]:
    """Return filtered graph snapshot with highlight ids for a lesson (graph only)."""
    highlight = set()
    if highlight_names:
        for name in highlight_names:
            if name:
                highlight.add(str(name).strip())

    if snapshot is None:
        snapshot = graph_service.fetch_graph_snapshot(limit=limit)
    nodes_raw = snapshot.get("nodes") or []
    edges_raw = snapshot.get("edges") or []

    allowed_labels = {
        "Stage",
        "Topic",
        "KnowledgeCategory",
        "KnowledgePoint",
        "CultureDimension",
        "Skill",
        "Terminology",
        "Practice",
        "ProcessStep",
    }

    def _node_id(node: dict) -> str:
        for key in ("id", "key", "name", "title"):
            val = node.get(key)
            if val:
                return str(val)
        return ""

    def _node_label(node: dict) -> str:
        lbl = node.get("label") or node.get("nodeType")
        if lbl:
            return lbl
        lbls = node.get("labels") or []
        if isinstance(lbls, list):
            for candidate in lbls:
                if candidate in allowed_labels:
                    return candidate
        return ""

    filtered_nodes = []
    id_to_node = {}
    for n in nodes_raw:
        label = _node_label(n)
        nid = _node_id(n)
        if not nid or label not in allowed_labels:
            continue
        node_copy = dict(n)
        node_copy["nodeType"] = label
        node_copy["id"] = nid
        display = n.get("title") or n.get("name") or n.get("id") or n.get("key") or label
        node_copy["label"] = display
        node_copy["name"] = display
        id_to_node[nid] = node_copy
        filtered_nodes.append(node_copy)

    filtered_edges = []
    for e in edges_raw:
        src = str(e.get("source") or e.get("from") or "")
        tgt = str(e.get("target") or e.get("to") or "")
        if src in id_to_node and tgt in id_to_node:
            edge_copy = dict(e)
            edge_copy["source"] = src
            edge_copy["target"] = tgt
            filtered_edges.append(edge_copy)

    highlight_ids = set()
    for nid in highlight:
        if nid in id_to_node:
            highlight_ids.add(nid)
        else:
            for candidate_id, node in id_to_node.items():
                if (node.get("name") or node.get("title") or "") == nid:
                    highlight_ids.add(candidate_id)

    kept = set(highlight_ids)
    if not kept:
        stage_ids = [nid for nid, n in id_to_node.items() if n.get("nodeType") == "Stage"]
        kept.update(stage_ids)
    for _ in range(2):
        new_nodes = set()
        for e in filtered_edges:
            s = e.get("source")
            t = e.get("target")
            if s in kept or t in kept:
                new_nodes.add(s)
                new_nodes.add(t)
        kept.update(new_nodes)

    if len(kept) < 10:
        stage_ids = [nid for nid, n in id_to_node.items() if n.get("nodeType") == "Stage"]
        kept.update(stage_ids[:10])

    nodes_final = [id_to_node[nid] for nid in kept if nid in id_to_node]
    edges_final = [e for e in filtered_edges if e.get("source") in kept and e.get("target") in kept]

    return {
        "nodes": nodes_final,
        "edges": edges_final,
        "highlights": list(highlight_ids),
    }
