"""REST endpoints that expose the knowledge graph powered by Neo4j."""

from __future__ import annotations

import io
import logging
from typing import Callable, Tuple

from flask import Blueprint, jsonify, request, send_file

from services import graph_service
from services.auth_service import require_role

# 导入新的知识点管理服务
try:
    from services import knowledge_service
    from services import knowledge_importer
    ENHANCED_FEATURES_AVAILABLE = True
except ImportError:
    ENHANCED_FEATURES_AVAILABLE = False
    logging.getLogger(__name__).warning("Enhanced knowledge features not available")


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


# ============================================
# 增强的知识点管理API（新增）
# ============================================

@bp.get("/api/graph/knowledge-points/enhanced")
@require_role("teacher")
def list_enhanced_knowledge_points():
    """列出知识点（支持过滤）"""
    if not ENHANCED_FEATURES_AVAILABLE:
        return jsonify({"error": "Enhanced features not available"}), 503

    category = request.args.get("category")
    type_filter = request.args.get("type")
    difficulty = request.args.get("difficulty")
    importance = request.args.get("importance")
    keyword = request.args.get("keyword")
    limit = int(request.args.get("limit", 100))
    offset = int(request.args.get("offset", 0))

    def _handler() -> Tuple[dict, int]:
        points = knowledge_service.list_knowledge_points(
            category=category,
            type=type_filter,
            difficulty=difficulty,
            importance=importance,
            keyword=keyword,
            limit=limit,
            offset=offset,
        )
        return {
            "knowledgePoints": points,
            "total": len(points),
            "offset": offset,
            "limit": limit,
        }, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/knowledge-points")
@require_role("teacher")
def create_knowledge_point():
    """创建新知识点"""
    if not ENHANCED_FEATURES_AVAILABLE:
        return jsonify({"error": "Enhanced features not available"}), 503

    body = request.get_json(force=True, silent=True) or {}
    name = body.get("name")

    if not name:
        return jsonify({"error": "name is required"}), 400

    def _handler() -> Tuple[dict, int]:
        # 获取当前用户
        user = getattr(request, "user", None)
        created_by = user.get("username") if user else "teacher"

        point = knowledge_service.create_knowledge_point(
            name=name,
            category=body.get("category"),
            type=body.get("type", "concept"),
            difficulty=body.get("difficulty", "intermediate"),
            importance=body.get("importance", "recommended"),
            summary=body.get("summary", ""),
            description=body.get("description", ""),
            keywords=body.get("keywords", []),
            tags=body.get("tags", []),
            estimated_minutes=int(body.get("estimatedMinutes", 15)),
            image_url=body.get("imageUrl", ""),
            video_url=body.get("videoUrl", ""),
            document_url=body.get("documentUrl", ""),
            external_url=body.get("externalUrl", ""),
            created_by=created_by,
        )
        return {"knowledgePoint": point}, 201

    return _graph_operation(_handler)


@bp.get("/api/graph/knowledge-points/<name>")
@require_role("teacher")
def get_knowledge_point_detail(name: str):
    """获取知识点详情"""
    if not ENHANCED_FEATURES_AVAILABLE:
        return jsonify({"error": "Enhanced features not available"}), 503

    def _handler() -> Tuple[dict, int]:
        point = knowledge_service.get_knowledge_point(name)
        if not point:
            raise graph_service.GraphEntityNotFoundError(f"Knowledge point '{name}' not found")
        return {"knowledgePoint": point}, 200

    return _graph_operation(_handler)


@bp.put("/api/graph/knowledge-points/<name>")
@require_role("teacher")
def update_knowledge_point(name: str):
    """更新知识点"""
    if not ENHANCED_FEATURES_AVAILABLE:
        return jsonify({"error": "Enhanced features not available"}), 503

    body = request.get_json(force=True, silent=True) or {}

    def _handler() -> Tuple[dict, int]:
        point = knowledge_service.update_knowledge_point(name, **body)
        if not point:
            raise graph_service.GraphEntityNotFoundError(f"Knowledge point '{name}' not found")
        return {"knowledgePoint": point}, 200

    return _graph_operation(_handler)


@bp.delete("/api/graph/knowledge-points/<name>")
@require_role("teacher")
def delete_knowledge_point(name: str):
    """删除知识点"""
    if not ENHANCED_FEATURES_AVAILABLE:
        return jsonify({"error": "Enhanced features not available"}), 503

    def _handler() -> Tuple[dict, int]:
        success = knowledge_service.delete_knowledge_point(name)
        if not success:
            raise graph_service.GraphEntityNotFoundError(f"Knowledge point '{name}' not found")
        return {"success": True, "message": f"Knowledge point '{name}' deleted"}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/categories")
@require_role("teacher")
def list_categories():
    """获取知识分类列表"""
    if not ENHANCED_FEATURES_AVAILABLE:
        return jsonify({"error": "Enhanced features not available"}), 503

    level = request.args.get("level", type=int)
    parent_id = request.args.get("parentId")

    def _handler() -> Tuple[dict, int]:
        categories = knowledge_service.list_knowledge_categories(
            level=level,
            parent_id=parent_id,
        )
        return {"categories": categories}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/categories/tree")
@require_role("teacher")
def get_category_tree():
    """获取完整分类树"""
    if not ENHANCED_FEATURES_AVAILABLE:
        return jsonify({"error": "Enhanced features not available"}), 503

    def _handler() -> Tuple[dict, int]:
        tree = knowledge_service.get_category_tree()
        return {"categoryTree": tree}, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/knowledge-points/<name>/prerequisites")
@require_role("teacher")
def add_prerequisite(name: str):
    """添加前置依赖"""
    if not ENHANCED_FEATURES_AVAILABLE:
        return jsonify({"error": "Enhanced features not available"}), 503

    body = request.get_json(force=True, silent=True) or {}
    prerequisite = body.get("prerequisite")

    if not prerequisite:
        return jsonify({"error": "prerequisite is required"}), 400

    def _handler() -> Tuple[dict, int]:
        success = knowledge_service.add_knowledge_prerequisite(
            knowledge_name=name,
            prerequisite_name=prerequisite,
            is_strict=body.get("isStrict", True),
            reason=body.get("reason", ""),
        )
        if not success:
            return {"error": "Failed to add prerequisite"}, 400
        return {"success": True}, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/knowledge-points/<name>/relations")
@require_role("teacher")
def add_relation(name: str):
    """添加知识点关联"""
    if not ENHANCED_FEATURES_AVAILABLE:
        return jsonify({"error": "Enhanced features not available"}), 503

    body = request.get_json(force=True, silent=True) or {}
    related = body.get("related")

    if not related:
        return jsonify({"error": "related is required"}), 400

    def _handler() -> Tuple[dict, int]:
        success = knowledge_service.add_knowledge_relation(
            knowledge_name1=name,
            knowledge_name2=related,
            relation_type=body.get("relationType", "similar"),
            strength=float(body.get("strength", 0.5)),
            description=body.get("description", ""),
        )
        if not success:
            return {"error": "Failed to add relation"}, 400
        return {"success": True}, 200

    return _graph_operation(_handler)


# ============================================
# Excel 导入导出API
# ============================================

@bp.get("/api/graph/import/template")
@require_role("teacher")
def download_import_template():
    """下载Excel导入模板"""
    if not ENHANCED_FEATURES_AVAILABLE:
        return jsonify({"error": "Enhanced features not available"}), 503

    try:
        template = knowledge_importer.generate_excel_template()
        return send_file(
            io.BytesIO(template),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name="知识点导入模板.xlsx",
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.post("/api/graph/import/excel")
@require_role("teacher")
def import_from_excel():
    """从Excel导入知识点"""
    if not ENHANCED_FEATURES_AVAILABLE:
        return jsonify({"error": "Enhanced features not available"}), 503

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.endswith((".xlsx", ".xls")):
        return jsonify({"error": "Only Excel files (.xlsx, .xls) are supported"}), 400

    try:
        user = getattr(request, "user", None)
        created_by = user.get("username") if user else "excel-import"

        result = knowledge_importer.import_from_excel(file, created_by=created_by)
        return jsonify(result), 200 if result.get("success") else 400
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


@bp.post("/api/graph/import/csv")
@require_role("teacher")
def import_from_csv():
    """从CSV导入知识点"""
    if not ENHANCED_FEATURES_AVAILABLE:
        return jsonify({"error": "Enhanced features not available"}), 503

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.endswith(".csv"):
        return jsonify({"error": "Only CSV files are supported"}), 400

    try:
        user = getattr(request, "user", None)
        created_by = user.get("username") if user else "csv-import"

        result = knowledge_importer.import_from_csv(file, created_by=created_by)
        return jsonify(result), 200 if result.get("success") else 400
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


@bp.get("/api/graph/export/excel")
@require_role("teacher")
def export_to_excel():
    """导出知识点为Excel"""
    if not ENHANCED_FEATURES_AVAILABLE:
        return jsonify({"error": "Enhanced features not available"}), 503

    category = request.args.get("category")
    difficulty = request.args.get("difficulty")
    importance = request.args.get("importance")

    try:
        excel_data = knowledge_importer.export_to_excel(
            category=category,
            difficulty=difficulty,
            importance=importance,
        )
        return send_file(
            io.BytesIO(excel_data),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name="知识点导出.xlsx",
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

