"""理论学习内容相关接口。"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

import database
from services.auth_service import require_role
from utils.validators import as_bool

bp = Blueprint("theory", __name__)


@bp.get("/api/theory")
@require_role()
def list_theory_content():
    """返回理论学习的章节树结构。"""
    include_content = as_bool(request.args.get("includeContent"), default=False)
    records = database.list_theory_hierarchy(include_content=include_content)
    return jsonify({"theory": records})


@bp.get("/api/theory/lessons/<lesson_id>")
@require_role()
def get_theory_lesson(lesson_id: str):
    """查询指定理论学习小节的详细内容。"""
    lesson = database.get_theory_lesson(lesson_id)
    if not lesson:
        return jsonify({"error": "Lesson not found"}), 404
    return jsonify({"lesson": lesson})
