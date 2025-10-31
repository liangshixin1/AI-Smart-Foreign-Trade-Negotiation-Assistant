"""REST endpoints that expose the knowledge graph powered by Neo4j."""

from __future__ import annotations

from typing import Callable, Tuple
from urllib.parse import unquote

from flask import Blueprint, jsonify, request

from services import graph_service
from services import knowledge_importer
from services.auth_service import require_role


bp = Blueprint("graph", __name__)


def _graph_operation(fn: Callable[[], Tuple[dict, int]]):
    try:
        payload, status = fn()
    except graph_service.GraphUnavailableError as exc:
        status_payload = graph_service.graph_status()
        response = {"error": str(exc) or "Knowledge graph service is unavailable"}
        if status_payload.get("message"):
            response["detail"] = status_payload["message"]
        response["graphStatus"] = status_payload
        return jsonify(response), 503
    except graph_service.GraphEntityNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except graph_service.GraphValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except graph_service.GraphConflictError as exc:
        return jsonify({"error": str(exc)}), 409
    return jsonify(payload), status


@bp.get("/api/graph/knowledge-points")
@require_role("teacher")
def list_knowledge_points():
    def _handler() -> Tuple[dict, int]:
        points = graph_service.list_knowledge_points()
        return {"knowledgePoints": points}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/knowledge-categories")
@require_role("teacher")
def list_knowledge_categories():
    def _handler() -> Tuple[dict, int]:
        categories = graph_service.list_knowledge_categories()
        return {"categories": categories}, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/knowledge-categories")
@require_role("teacher")
def create_knowledge_category():
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    parent_id = (data.get("parentId") or "").strip() or None
    description = (data.get("description") or "").strip()
    order_index_raw = data.get("orderIndex")
    order_index = None
    if order_index_raw not in (None, ""):
        try:
            order_index = int(order_index_raw)
        except (TypeError, ValueError):
            return jsonify({"error": "orderIndex must be an integer"}), 400

    def _handler() -> Tuple[dict, int]:
        category = graph_service.create_knowledge_category(
            name,
            parent_id=parent_id,
            description=description,
            order_index=order_index,
        )
        return {"category": category}, 201

    return _graph_operation(_handler)


@bp.put("/api/graph/knowledge-categories/<category_id>")
@require_role("teacher")
def update_knowledge_category(category_id: str):
    data = request.get_json(force=True, silent=True) or {}
    name = data.get("name")
    description = data.get("description") if "description" in data else None
    order_index_raw = data.get("orderIndex") if "orderIndex" in data else None
    include_parent = "parentId" in data
    parent_value = (data.get("parentId") or "").strip() if include_parent else None

    order_index = None
    if order_index_raw not in (None, ""):
        try:
            order_index = int(order_index_raw)
        except (TypeError, ValueError):
            return jsonify({"error": "orderIndex must be an integer"}), 400

    def _handler() -> Tuple[dict, int]:
        kwargs = {
            "name": name,
            "description": description,
            "order_index": order_index,
        }
        if include_parent:
            kwargs["parent_id"] = parent_value or None
        category = graph_service.update_knowledge_category(category_id, **kwargs)
        return {"category": category}, 200

    return _graph_operation(_handler)


@bp.delete("/api/graph/knowledge-categories/<category_id>")
@require_role("teacher")
def delete_knowledge_category(category_id: str):
    fallback_id = request.args.get("fallbackId") or None

    def _handler() -> Tuple[dict, int]:
        graph_service.delete_knowledge_category(category_id, fallback_id=fallback_id)
        return {"status": "deleted"}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/practices/<practice_id>")
@require_role("teacher")
def get_practice_graph_detail(practice_id: str):
    def _handler() -> Tuple[dict, int]:
        detail = graph_service.get_practice_detail(practice_id)
        return {"practice": detail}, 200

    return _graph_operation(_handler)


@bp.put("/api/graph/practices/<practice_id>/knowledge")
@require_role("teacher")
def update_practice_knowledge(practice_id: str):
    body = request.get_json(force=True, silent=True) or {}
    points = body.get("knowledgePoints", [])
    if not isinstance(points, list):
        return jsonify({"error": "knowledgePoints must be a list"}), 400

    def _handler() -> Tuple[dict, int]:
        graph_service.set_practice_knowledge_points(practice_id, points)
        detail = graph_service.get_practice_detail(practice_id)
        return {"practice": detail}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/theory-lessons/<lesson_id>")
@require_role("teacher")
def get_lesson_graph_detail(lesson_id: str):
    def _handler() -> Tuple[dict, int]:
        detail = graph_service.get_lesson_detail(lesson_id)
        return {"lesson": detail}, 200

    return _graph_operation(_handler)


@bp.put("/api/graph/theory-lessons/<lesson_id>/knowledge")
@require_role("teacher")
def update_lesson_knowledge(lesson_id: str):
    body = request.get_json(force=True, silent=True) or {}
    points = body.get("knowledgePoints", [])
    if not isinstance(points, list):
        return jsonify({"error": "knowledgePoints must be a list"}), 400

    def _handler() -> Tuple[dict, int]:
        graph_service.set_lesson_knowledge_points(lesson_id, points)
        detail = graph_service.get_lesson_detail(lesson_id)
        return {"lesson": detail}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/theory-lessons/<lesson_id>/related-practices")
@require_role()
def list_related_practices(lesson_id: str):
    def _handler() -> Tuple[dict, int]:
        lesson = graph_service.get_lesson_detail(lesson_id)
        practices = graph_service.get_related_practices_for_lesson(lesson_id)
        return {"lesson": lesson, "practices": practices}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/practices/<practice_id>/related-lessons")
@require_role()
def list_related_lessons(practice_id: str):
    def _handler() -> Tuple[dict, int]:
        practice = graph_service.get_practice_detail(practice_id)
        lessons = graph_service.get_related_lessons_for_practice(practice_id)
        return {"practice": practice, "lessons": lessons}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/network")
@require_role("teacher")
def fetch_graph_network():
    try:
        limit = int(request.args.get("limit", 250))
        if limit <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "limit must be a positive integer"}), 400

    def _handler() -> Tuple[dict, int]:
        snapshot = graph_service.fetch_graph_snapshot(limit=limit)
        return snapshot, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/knowledge-points/<path:name>")
@require_role("teacher")
def fetch_knowledge_point(name: str):
    decoded_name = unquote(name or "")

    def _handler() -> Tuple[dict, int]:
        point = graph_service.get_knowledge_point(decoded_name)
        return {"knowledgePoint": point}, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/knowledge-points")
@require_role("teacher")
def create_knowledge_point():
    data = request.get_json(force=True, silent=True) or {}

    def _handler() -> Tuple[dict, int]:
        point = graph_service.save_knowledge_point(data)
        return {"knowledgePoint": point}, 201

    return _graph_operation(_handler)


@bp.put("/api/graph/knowledge-points/<path:name>")
@require_role("teacher")
def update_knowledge_point(name: str):
    data = request.get_json(force=True, silent=True) or {}
    decoded_name = unquote(name or "")

    def _handler() -> Tuple[dict, int]:
        point = graph_service.save_knowledge_point(data, previous_name=decoded_name)
        return {"knowledgePoint": point}, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/knowledge-import/excel")
@require_role("teacher")
def import_knowledge_from_excel():
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "file is required"}), 400
    if not file.filename.lower().endswith((".xlsx", ".xlsm", ".xltx", ".xltm")):
        return jsonify({"error": "仅支持 Excel 工作簿"}), 400

    def _handler() -> Tuple[dict, int]:
        records = knowledge_importer.parse_excel(file)
        summary = graph_service.bulk_import_knowledge_points(records)
        return {"summary": summary, "items": records}, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/knowledge-import/docx")
@require_role("teacher")
def import_knowledge_from_docx():
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "file is required"}), 400
    if not file.filename.lower().endswith(".docx"):
        return jsonify({"error": "仅支持 .docx 文档"}), 400

    def _handler() -> Tuple[dict, int]:
        records = knowledge_importer.parse_docx(file)
        summary = graph_service.bulk_import_knowledge_points(records)
        return {"summary": summary, "items": records}, 200

    return _graph_operation(_handler)

