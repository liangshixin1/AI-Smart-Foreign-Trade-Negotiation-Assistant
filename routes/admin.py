"""教师端管理接口集合。"""

from __future__ import annotations

from itertools import chain
from typing import Dict, List, Optional

from flask import Blueprint, jsonify, request
from openpyxl import load_workbook

import database
from services.auth_service import require_role
from services.scenario_generator import ensure_level_hierarchy, inject_difficulty_metadata
from utils.normalizers import normalize_text
from utils.validators import as_bool

bp = Blueprint("admin", __name__)


def _normalize_student_header(value: object) -> str:
    text = normalize_text(value).lower()
    if text in {"id", "账号", "學號", "学号", "user", "userid"}:
        return "id"
    if text in {"姓名", "name", "display", "nickname"}:
        return "name"
    if text in {"password", "密码", "pass", "pwd"}:
        return "password"
    return ""


def _parse_student_records(file_storage) -> List[Dict[str, str]]:
    workbook = load_workbook(file_storage, read_only=True, data_only=True)
    sheet = workbook.active
    rows = sheet.iter_rows(values_only=True)
    try:
        first_row = next(rows)
    except StopIteration:
        return []

    headers = [_normalize_student_header(cell) for cell in (first_row or [])]
    if not any(headers):
        headers = ["id", "name", "password"]
        rows = chain([first_row], rows)

    records: List[Dict[str, str]] = []
    for row in rows:
        if not row:
            continue
        entry: Dict[str, str] = {"id": "", "name": "", "password": ""}
        for index, cell in enumerate(row):
            if index >= len(headers):
                continue
            key = headers[index]
            if not key:
                continue
            entry[key] = normalize_text(cell)
        entry["id"] = normalize_text(entry["id"])
        entry["name"] = normalize_text(entry["name"]) or entry["id"]
        entry["password"] = normalize_text(entry["password"]) or entry["id"]
        if entry["id"] and entry["password"]:
            records.append(entry)
    return records


@bp.post("/api/admin/students/import")
@require_role("teacher")
def import_students():
    """批量导入学生账号，支持 Excel 格式。"""
    current_user()
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "file is required"}), 400
    try:
        records = _parse_student_records(file)
    except Exception as exc:
        return jsonify({"error": f"Failed to parse file: {exc}"}), 400

    if not records:
        return jsonify({"error": "No valid student rows found"}), 400

    summary = database.bulk_import_students(records)
    summary["total"] = len(records)
    return jsonify({"result": summary})


@bp.post("/api/admin/students/<int:student_id>/password")
@require_role("teacher")
def reset_student_password(student_id: int):
    """教师重置学生密码，方便线下教学支援。"""
    data = request.get_json(force=True)
    new_password = normalize_text(data.get("newPassword"))
    if len(new_password) < 4:
        return jsonify({"error": "Password must be at least 4 characters"}), 400

    detail = database.get_student_detail(student_id)
    if not detail:
        return jsonify({"error": "Student not found"}), 404

    database.update_user_password(student_id, new_password)
    return jsonify({"status": "updated"})


@bp.get("/api/admin/students")
@require_role("teacher")
def list_students_progress():
    students = database.list_students_progress()
    return jsonify({"students": students})


@bp.get("/api/admin/students/<int:student_id>")
@require_role("teacher")
def get_student_detail(student_id: int):
    detail = database.get_student_detail(student_id)
    if not detail:
        return jsonify({"error": "Student not found"}), 404
    for session in detail.get("sessions", []):
        inject_difficulty_metadata(session)
    return jsonify(detail)


@bp.get("/api/admin/analytics")
@require_role("teacher")
def get_admin_analytics():
    analytics = database.get_class_analytics()
    return jsonify(analytics)


@bp.get("/api/admin/levels")
@require_role("teacher")
def get_admin_levels():
    chapters = ensure_level_hierarchy(include_prompts=True)
    return jsonify({"chapters": chapters})


@bp.post("/api/admin/chapters")
@require_role("teacher")
def create_admin_chapter():
    data = request.get_json(force=True)
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400

    description = (data.get("description") or "").strip()
    order_index = data.get("orderIndex")
    try:
        order_value = int(order_index) if order_index is not None else None
    except (TypeError, ValueError):
        return jsonify({"error": "orderIndex must be an integer"}), 400

    chapter_id = (data.get("id") or "").strip() or None
    chapter = database.create_chapter(
        title=title,
        description=description,
        order_index=order_value,
        chapter_id=chapter_id,
    )
    return jsonify({"chapter": chapter}), 201


@bp.put("/api/admin/chapters/<chapter_id>")
@require_role("teacher")
def update_admin_chapter(chapter_id: str):
    data = request.get_json(force=True)
    kwargs: Dict[str, object] = {}
    if "title" in data:
        kwargs["title"] = (data.get("title") or "").strip()
    if "description" in data:
        kwargs["description"] = (data.get("description") or "").strip()
    if "orderIndex" in data:
        try:
            kwargs["order_index"] = int(data.get("orderIndex"))
        except (TypeError, ValueError):
            return jsonify({"error": "orderIndex must be an integer"}), 400

    chapter = database.update_chapter(chapter_id, **kwargs)
    if not chapter:
        return jsonify({"error": "Chapter not found"}), 404
    return jsonify({"chapter": chapter})


@bp.delete("/api/admin/chapters/<chapter_id>")
@require_role("teacher")
def delete_admin_chapter(chapter_id: str):
    existing = database.get_chapter(chapter_id)
    if not existing:
        return jsonify({"error": "Chapter not found"}), 404
    database.delete_chapter(chapter_id)
    return ("", 204)


@bp.post("/api/admin/sections")
@require_role("teacher")
def create_admin_section():
    data = request.get_json(force=True)
    chapter_id = (data.get("chapterId") or "").strip()
    if not chapter_id:
        return jsonify({"error": "chapterId is required"}), 400

    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    env_prompt = (data.get("environmentPromptTemplate") or "").strip()
    env_user = (data.get("environmentUserMessage") or "").strip()
    convo_prompt = (data.get("conversationPromptTemplate") or "").strip()
    eval_prompt = (data.get("evaluationPromptTemplate") or "").strip()

    if not all([title, description, env_prompt, env_user, convo_prompt, eval_prompt]):
        return jsonify({"error": "title, description and all prompt templates are required"}), 400

    expects_bargaining = as_bool(data.get("expectsBargaining"), False)
    order_index = data.get("orderIndex")
    try:
        order_value = int(order_index) if order_index is not None else None
    except (TypeError, ValueError):
        return jsonify({"error": "orderIndex must be an integer"}), 400

    section_id = (data.get("id") or "").strip() or None
    section = database.create_section(
        chapter_id=chapter_id,
        title=title,
        description=description,
        environment_prompt_template=env_prompt,
        environment_user_message=env_user,
        conversation_prompt_template=convo_prompt,
        evaluation_prompt_template=eval_prompt,
        expects_bargaining=expects_bargaining,
        order_index=order_value,
        section_id=section_id,
    )
    if not section:
        return jsonify({"error": "Chapter not found"}), 404
    return jsonify({"section": section}), 201


@bp.put("/api/admin/sections/<section_id>")
@require_role("teacher")
def update_admin_section(section_id: str):
    data = request.get_json(force=True)
    kwargs: Dict[str, object] = {}
    if "chapterId" in data:
        kwargs["chapter_id"] = (data.get("chapterId") or "").strip()
    if "title" in data:
        kwargs["title"] = (data.get("title") or "").strip()
    if "description" in data:
        kwargs["description"] = (data.get("description") or "").strip()
    if "environmentPromptTemplate" in data:
        kwargs["environment_prompt_template"] = (
            data.get("environmentPromptTemplate") or ""
        ).strip()
    if "environmentUserMessage" in data:
        kwargs["environment_user_message"] = (
            data.get("environmentUserMessage") or ""
        ).strip()
    if "conversationPromptTemplate" in data:
        kwargs["conversation_prompt_template"] = (
            data.get("conversationPromptTemplate") or ""
        ).strip()
    if "evaluationPromptTemplate" in data:
        kwargs["evaluation_prompt_template"] = (
            data.get("evaluationPromptTemplate") or ""
        ).strip()
    if "expectsBargaining" in data:
        kwargs["expects_bargaining"] = as_bool(data.get("expectsBargaining"))
    if "orderIndex" in data:
        try:
            kwargs["order_index"] = int(data.get("orderIndex"))
        except (TypeError, ValueError):
            return jsonify({"error": "orderIndex must be an integer"}), 400

    section = database.update_section(section_id, **kwargs)
    if not section:
        return jsonify({"error": "Section not found"}), 404
    return jsonify({"section": section})


@bp.delete("/api/admin/sections/<section_id>")
@require_role("teacher")
def delete_admin_section(section_id: str):
    section = database.get_section(section_id)
    if not section:
        return jsonify({"error": "Section not found"}), 404
    database.delete_section(section_id)
    return ("", 204)


@bp.get("/api/admin/theory")
@require_role("teacher")
def list_admin_theory():
    include_content = as_bool(request.args.get("includeContent"), default=True)
    records = database.list_theory_hierarchy(include_content=include_content)
    return jsonify({"theory": records})


@bp.post("/api/admin/theory/topics")
@require_role("teacher")
def create_admin_theory_topic():
    data = request.get_json(force=True) or {}
    chapter_id = normalize_text(data.get("chapterId"))
    if not chapter_id:
        return jsonify({"error": "chapterId is required"}), 400

    title = normalize_text(data.get("title")) or "未命名理论单元"
    code = normalize_text(data.get("code")) or ""
    summary = normalize_text(data.get("summary"))
    order_index_raw = data.get("orderIndex")
    order_index: Optional[int] = None
    if order_index_raw not in (None, ""):
        try:
            order_index = int(order_index_raw)
        except (TypeError, ValueError):
            return jsonify({"error": "orderIndex must be an integer"}), 400

    record = database.create_theory_topic(
        chapter_id=chapter_id,
        title=title,
        code=code,
        summary=summary,
        order_index=order_index,
    )
    if not record:
        return jsonify({"error": "Chapter not found"}), 404
    return jsonify({"topic": record}), 201


@bp.put("/api/admin/theory/topics/<topic_id>")
@require_role("teacher")
def update_admin_theory_topic(topic_id: str):
    data = request.get_json(force=True) or {}
    updates: Dict[str, object] = {}

    if "chapterId" in data:
        updates["chapter_id"] = normalize_text(data.get("chapterId"))
    if "title" in data:
        title = normalize_text(data.get("title"))
        if not title:
            return jsonify({"error": "title is required"}), 400
        updates["title"] = title
    if "code" in data:
        updates["code"] = normalize_text(data.get("code"))
    if "summary" in data:
        updates["summary"] = normalize_text(data.get("summary"))
    if "orderIndex" in data:
        order_value = data.get("orderIndex")
        if order_value in (None, ""):
            updates["order_index"] = None
        else:
            try:
                updates["order_index"] = int(order_value)
            except (TypeError, ValueError):
                return jsonify({"error": "orderIndex must be an integer"}), 400

    topic = database.update_theory_topic(topic_id, **updates)
    if not topic:
        return jsonify({"error": "Topic not found"}), 404
    return jsonify({"topic": topic})


@bp.delete("/api/admin/theory/topics/<topic_id>")
@require_role("teacher")
def delete_admin_theory_topic(topic_id: str):
    topic = database.get_theory_topic(topic_id)
    if not topic:
        return jsonify({"error": "Topic not found"}), 404
    database.delete_theory_topic(topic_id)
    return ("", 204)


@bp.post("/api/admin/theory/lessons")
@require_role("teacher")
def create_admin_theory_lesson():
    data = request.get_json(force=True) or {}
    topic_id = normalize_text(data.get("topicId"))
    if not topic_id:
        return jsonify({"error": "topicId is required"}), 400

    title = normalize_text(data.get("title")) or "未命名知识点"
    code = normalize_text(data.get("code")) or ""
    content_html = data.get("contentHtml") or ""
    order_index_raw = data.get("orderIndex")
    order_index: Optional[int] = None
    if order_index_raw not in (None, ""):
        try:
            order_index = int(order_index_raw)
        except (TypeError, ValueError):
            return jsonify({"error": "orderIndex must be an integer"}), 400

    section_id = normalize_text(data.get("sectionId")) or None

    lesson = database.create_theory_lesson(
        topic_id=topic_id,
        title=title,
        code=code,
        content_html=content_html,
        order_index=order_index,
        section_id=section_id,
    )
    if not lesson:
        return jsonify({"error": "Unable to create lesson"}), 400
    return jsonify({"lesson": lesson}), 201


@bp.put("/api/admin/theory/lessons/<lesson_id>")
@require_role("teacher")
def update_admin_theory_lesson(lesson_id: str):
    data = request.get_json(force=True) or {}
    updates: Dict[str, object] = {}

    if "topicId" in data:
        updates["topic_id"] = normalize_text(data.get("topicId"))
    if "title" in data:
        title = normalize_text(data.get("title"))
        if not title:
            return jsonify({"error": "title is required"}), 400
        updates["title"] = title
    if "code" in data:
        updates["code"] = normalize_text(data.get("code"))
    if "contentHtml" in data:
        updates["content_html"] = data.get("contentHtml") or ""
    if "orderIndex" in data:
        order_value = data.get("orderIndex")
        if order_value in (None, ""):
            updates["order_index"] = None
        else:
            try:
                updates["order_index"] = int(order_value)
            except (TypeError, ValueError):
                return jsonify({"error": "orderIndex must be an integer"}), 400
    if "sectionId" in data:
        section_value = normalize_text(data.get("sectionId"))
        updates["section_id"] = section_value or None

    lesson = database.update_theory_lesson(lesson_id, **updates)
    if not lesson:
        return jsonify({"error": "Lesson not found"}), 404
    return jsonify({"lesson": lesson})


@bp.delete("/api/admin/theory/lessons/<lesson_id>")
@require_role("teacher")
def delete_admin_theory_lesson(lesson_id: str):
    lesson = database.get_theory_lesson(lesson_id)
    if not lesson:
        return jsonify({"error": "Lesson not found"}), 404
    database.delete_theory_lesson(lesson_id)
    return ("", 204)
