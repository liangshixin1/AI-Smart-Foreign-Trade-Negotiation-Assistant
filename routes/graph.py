"""REST endpoints that expose the knowledge graph powered by Neo4j."""

from __future__ import annotations

from typing import Callable, Tuple

from flask import Blueprint, jsonify, request

from services import graph_service
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
    return jsonify(payload), status


@bp.get("/api/graph/knowledge-points")
@require_role("teacher")
def list_knowledge_points():
    def _handler() -> Tuple[dict, int]:
        points = graph_service.list_knowledge_points()
        return {"knowledgePoints": points}, 200

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

