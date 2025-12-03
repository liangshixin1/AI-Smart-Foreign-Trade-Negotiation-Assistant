"""理论学习内容相关接口。"""

from __future__ import annotations

from flask import Blueprint, jsonify, request
from typing import Dict, List

import database
from services import graph_service
from services.graph_service import GraphUnavailableError
from services.auth_service import require_role
from utils.validators import as_bool

bp = Blueprint("theory", __name__)


@bp.get("/api/theory")
@require_role()
def list_theory_content():
    """返回理论学习的章节树结构。"""
    include_content = as_bool(request.args.get("includeContent"), default=False)
    records = database.list_theory_hierarchy(
        include_content=include_content, published_only=True
    )
    return jsonify({"theory": records})


@bp.get("/api/theory/lessons/<lesson_id>")
@require_role()
def get_theory_lesson(lesson_id: str):
    """查询指定理论学习小节的详细内容。"""
    lesson = database.get_theory_lesson(lesson_id, include_unpublished=False)
    if not lesson:
        return jsonify({"error": "Lesson not found"}), 404
    # 组合：手工关联 + 自动检测 + 前置关系
    linked_kp: List[Dict[str, object]] = []
    prereq_map: Dict[str, List[str]] = {}
    try:
        detail = graph_service.get_lesson_detail(lesson_id)
        linked_kp = detail.get("knowledgePoints") or []
        prereq_map = graph_service.get_knowledge_prerequisite_map()
    except GraphUnavailableError:
        linked_kp = []
        prereq_map = {}

    cached = graph_service.get_cached_lesson_graph_payload(lesson_id) or {}
    detected_kp: List[Dict[str, object]] = cached.get("detected") or []
    # 运行时检测已停用，避免学生端高并发拖垮服务器

    merged: Dict[str, Dict[str, object]] = {}

    def _merge_item(item: Dict[str, object], source: str) -> None:
        name = (item.get("name") or "").strip()
        if not name:
            return
        base = merged.get(name, {"name": name})
        base.update(item)
        base["source"] = source
        base["prerequisites"] = item.get("prerequisites") or prereq_map.get(name) or []
        merged[name] = base

    for kp in linked_kp:
        _merge_item(kp, "linked")
    for kp in detected_kp:
        if kp.get("name") in merged:
            # Keep linked as primary; just ensure prereqs are merged if missing
            if not merged[kp["name"]].get("prerequisites"):
                merged[kp["name"]]["prerequisites"] = kp.get("prerequisites") or []
            continue
        _merge_item(kp, "detected")

    lesson["knowledgePoints"] = list(merged.values())
    return jsonify({"lesson": lesson})
