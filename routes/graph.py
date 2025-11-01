"""REST endpoints that expose the knowledge graph powered by Neo4j."""

from __future__ import annotations

from typing import Callable, Tuple

from flask import Blueprint, jsonify, request, send_file

from services import graph_service, knowledge_service
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
    """
    获取知识点列表（旧版API，向后兼容）
    支持通过查询参数进行过滤：search, category, difficulty
    """
    # 检查是否有过滤参数，如果有则使用enhanced版本
    search = request.args.get("search")
    category = request.args.get("category")
    difficulty = request.args.get("difficulty")

    def _handler() -> Tuple[dict, int]:
        if search or category or difficulty:
            # 使用enhanced版本
            points = graph_service.list_knowledge_points_enhanced(
                search=search,
                category=category,
                difficulty=difficulty
            )
        else:
            # 使用旧版本
            points = graph_service.list_knowledge_points()
        return {"knowledgePoints": points}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/knowledge-points/enhanced")
@require_role("teacher")
def list_knowledge_points_enhanced():
    """获取知识点列表（增强版），支持过滤"""
    search = request.args.get("search")
    category = request.args.get("category")
    difficulty = request.args.get("difficulty")

    def _handler() -> Tuple[dict, int]:
        points = graph_service.list_knowledge_points_enhanced(
            search=search,
            category=category,
            difficulty=difficulty
        )
        return {"knowledge_points": points}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/knowledge-points/<name>")
@require_role("teacher")
def get_knowledge_point(name: str):
    """获取单个知识点的详细信息"""
    def _handler() -> Tuple[dict, int]:
        point = graph_service.get_knowledge_point(name)
        return point, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/knowledge-points")
@require_role("teacher")
def create_knowledge_point():
    """创建新的知识点"""
    body = request.get_json(force=True, silent=True) or {}

    required_fields = ["name"]
    for field in required_fields:
        if not body.get(field):
            return jsonify({"error": f"Missing required field: {field}"}), 400

    def _handler() -> Tuple[dict, int]:
        try:
            point = graph_service.create_knowledge_point(body)
            return point, 201
        except ValueError as exc:
            return {"error": str(exc)}, 400

    return _graph_operation(_handler)


@bp.put("/api/graph/knowledge-points/<name>")
@require_role("teacher")
def update_knowledge_point(name: str):
    """更新知识点信息"""
    body = request.get_json(force=True, silent=True) or {}

    def _handler() -> Tuple[dict, int]:
        try:
            point = graph_service.update_knowledge_point(name, body)
            return point, 200
        except ValueError as exc:
            return {"error": str(exc)}, 400

    return _graph_operation(_handler)


@bp.delete("/api/graph/knowledge-points/<name>")
@require_role("teacher")
def delete_knowledge_point(name: str):
    """删除知识点"""
    def _handler() -> Tuple[dict, int]:
        graph_service.delete_knowledge_point(name)
        return {"message": f"Knowledge point '{name}' deleted successfully"}, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/knowledge-points/<name>/prerequisites")
@require_role("teacher")
def add_prerequisite(name: str):
    """为知识点添加前置依赖"""
    body = request.get_json(force=True, silent=True) or {}
    prerequisite_name = body.get("prerequisite_name")

    if not prerequisite_name:
        return jsonify({"error": "prerequisite_name is required"}), 400

    def _handler() -> Tuple[dict, int]:
        try:
            point = graph_service.add_knowledge_prerequisite(name, prerequisite_name)
            return point, 200
        except ValueError as exc:
            return {"error": str(exc)}, 400

    return _graph_operation(_handler)


@bp.delete("/api/graph/knowledge-points/<name>/prerequisites/<prerequisite_name>")
@require_role("teacher")
def remove_prerequisite(name: str, prerequisite_name: str):
    """移除知识点的前置依赖"""
    def _handler() -> Tuple[dict, int]:
        point = graph_service.remove_knowledge_prerequisite(name, prerequisite_name)
        return point, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/knowledge-points/<name>/relations")
@require_role("teacher")
def add_relation(name: str):
    """为知识点添加关联关系"""
    body = request.get_json(force=True, silent=True) or {}
    related_name = body.get("related_name")
    relation_type = body.get("relationship_type", "RELATED_TO")

    if not related_name:
        return jsonify({"error": "related_name is required"}), 400

    def _handler() -> Tuple[dict, int]:
        try:
            point = graph_service.add_knowledge_relation(name, related_name, relation_type)
            return point, 200
        except ValueError as exc:
            return {"error": str(exc)}, 400

    return _graph_operation(_handler)


@bp.delete("/api/graph/knowledge-points/<name>/relations/<related_name>")
@require_role("teacher")
def remove_relation(name: str, related_name: str):
    """移除知识点的关联关系"""
    def _handler() -> Tuple[dict, int]:
        point = graph_service.remove_knowledge_relation(name, related_name)
        return point, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/categories")
@require_role("teacher")
def list_categories():
    """获取所有知识点分类列表"""
    def _handler() -> Tuple[dict, int]:
        categories = graph_service.list_knowledge_categories()
        return {"categories": categories}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/categories/tree")
@require_role("teacher")
def get_categories_tree():
    """获取知识点分类树形结构（不含知识点）"""
    def _handler() -> Tuple[dict, int]:
        tree = knowledge_service.get_category_tree()
        return {"categories": tree}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/categories/tree/with-knowledge")
@require_role("teacher")
def get_categories_tree_with_knowledge():
    """获取知识点分类树形结构（包含知识点）"""
    def _handler() -> Tuple[dict, int]:
        tree = knowledge_service.get_category_tree_with_knowledge_points()
        return {"categories": tree}, 200

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


# ========== Excel/CSV 导入导出端点 ==========


@bp.get("/api/graph/import/template")
@require_role("teacher")
def download_import_template():
    """下载Excel导入模板"""
    def _handler() -> Tuple[dict, int]:
        excel_file = graph_service.export_knowledge_points_to_excel()
        return send_file(
            excel_file,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name="knowledge_points_template.xlsx"
        ), 200

    # 不使用_graph_operation包装，因为send_file有特殊的返回类型
    try:
        excel_file = graph_service.export_knowledge_points_to_excel()
        return send_file(
            excel_file,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name="knowledge_points_template.xlsx"
        )
    except graph_service.GraphUnavailableError as exc:
        status_payload = graph_service.graph_status()
        response = {"error": str(exc) or "Knowledge graph service is unavailable"}
        if status_payload.get("message"):
            response["detail"] = status_payload["message"]
        response["graphStatus"] = status_payload
        return jsonify(response), 503


@bp.post("/api/graph/import/excel")
@require_role("teacher")
def import_excel():
    """从Excel文件导入知识点"""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.endswith(('.xlsx', '.xls')):
        return jsonify({"error": "File must be an Excel file (.xlsx or .xls)"}), 400

    def _handler() -> Tuple[dict, int]:
        file_content = file.read()
        stats = graph_service.import_knowledge_points_from_excel(file_content)
        return stats, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/import/csv")
@require_role("teacher")
def import_csv():
    """从CSV文件导入知识点"""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.endswith('.csv'):
        return jsonify({"error": "File must be a CSV file (.csv)"}), 400

    def _handler() -> Tuple[dict, int]:
        file_content = file.read().decode('utf-8')
        stats = graph_service.import_knowledge_points_from_csv(file_content)
        return stats, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/export/excel")
@require_role("teacher")
def export_excel():
    """导出所有知识点为Excel文件"""
    try:
        excel_file = graph_service.export_knowledge_points_to_excel()
        return send_file(
            excel_file,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=f"knowledge_points.xlsx"
        )
    except graph_service.GraphUnavailableError as exc:
        status_payload = graph_service.graph_status()
        response = {"error": str(exc) or "Knowledge graph service is unavailable"}
        if status_payload.get("message"):
            response["detail"] = status_payload["message"]
        response["graphStatus"] = status_payload
        return jsonify(response), 503


@bp.get("/api/graph/export/csv")
@require_role("teacher")
def export_csv():
    """导出所有知识点为CSV文件"""
    def _handler() -> Tuple[dict, int]:
        csv_content = graph_service.export_knowledge_points_to_csv()
        # 使用send_file返回CSV
        from io import BytesIO
        output = BytesIO(csv_content.encode('utf-8-sig'))  # 使用utf-8-sig以支持Excel打开
        output.seek(0)
        return send_file(
            output,
            mimetype="text/csv",
            as_attachment=True,
            download_name=f"knowledge_points.csv"
        ), 200

    # 不使用_graph_operation包装
    try:
        csv_content = graph_service.export_knowledge_points_to_csv()
        from io import BytesIO
        output = BytesIO(csv_content.encode('utf-8-sig'))
        output.seek(0)
        return send_file(
            output,
            mimetype="text/csv",
            as_attachment=True,
            download_name=f"knowledge_points.csv"
        )
    except graph_service.GraphUnavailableError as exc:
        status_payload = graph_service.graph_status()
        response = {"error": str(exc) or "Knowledge graph service is unavailable"}
        if status_payload.get("message"):
            response["detail"] = status_payload["message"]
        response["graphStatus"] = status_payload
        return jsonify(response), 503


# ========== 知识分类管理端点 ==========


@bp.post("/api/graph/categories")
@require_role("teacher")
def create_category():
    """创建知识分类"""
    body = request.get_json(force=True, silent=True) or {}

    required_fields = ["id", "name"]
    for field in required_fields:
        if not body.get(field):
            return jsonify({"error": f"Missing required field: {field}"}), 400

    def _handler() -> Tuple[dict, int]:
        category = knowledge_service.create_knowledge_category(
            id=body["id"],
            name=body["name"],
            code=body.get("code", ""),
            level=body.get("level", 1),
            order_index=body.get("orderIndex", 0),
            icon=body.get("icon", "📁"),
            color=body.get("color", "#6B7280"),
            description=body.get("description", ""),
            parent_id=body.get("parentId"),
        )
        return category, 201

    return _graph_operation(_handler)


@bp.put("/api/graph/categories/<category_id>")
@require_role("teacher")
def update_category(category_id: str):
    """更新知识分类"""
    body = request.get_json(force=True, silent=True) or {}

    def _handler() -> Tuple[dict, int]:
        category = knowledge_service.update_category(category_id, **body)
        if not category:
            return {"error": f"Category {category_id} not found"}, 404
        return category, 200

    return _graph_operation(_handler)


@bp.delete("/api/graph/categories/<category_id>")
@require_role("teacher")
def delete_category(category_id: str):
    """删除知识分类（软删除）"""
    def _handler() -> Tuple[dict, int]:
        success = knowledge_service.delete_category(category_id)
        if not success:
            return {"error": f"Category {category_id} not found"}, 404
        return {"message": f"Category '{category_id}' deleted successfully"}, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/categories/reorder")
@require_role("teacher")
def reorder_categories():
    """批量更新分类排序

    请求体示例:
    {
        "orders": [
            {"id": "category1", "orderIndex": 0},
            {"id": "category2", "orderIndex": 1}
        ]
    }
    """
    body = request.get_json(force=True, silent=True) or {}
    orders = body.get("orders", [])

    if not isinstance(orders, list):
        return jsonify({"error": "orders must be a list"}), 400

    def _handler() -> Tuple[dict, int]:
        success = knowledge_service.reorder_categories(orders)
        return {"message": "Categories reordered successfully", "count": len(orders)}, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/categories/<category_id>/move")
@require_role("teacher")
def move_category(category_id: str):
    """移动分类到新的父分类下

    请求体示例:
    {
        "newParentId": "parent_category_id",  // null表示移动到根级别
        "orderIndex": 0
    }
    """
    body = request.get_json(force=True, silent=True) or {}
    new_parent_id = body.get("newParentId")
    order_index = body.get("orderIndex", 0)

    def _handler() -> Tuple[dict, int]:
        success = knowledge_service.move_category(
            category_id=category_id,
            new_parent_id=new_parent_id,
            new_order_index=order_index
        )
        return {"message": f"Category '{category_id}' moved successfully"}, 200

    return _graph_operation(_handler)


# ========== 知识点拖拽排序端点 ==========


@bp.post("/api/graph/knowledge-points/reorder")
@require_role("teacher")
def reorder_knowledge_points():
    """批量更新知识点在某个分类下的排序

    请求体示例:
    {
        "categoryId": "category1",
        "orders": [
            {"name": "FOB", "orderIndex": 0},
            {"name": "CIF", "orderIndex": 1}
        ]
    }
    """
    body = request.get_json(force=True, silent=True) or {}
    category_id = body.get("categoryId")
    orders = body.get("orders", [])

    if not category_id:
        return jsonify({"error": "categoryId is required"}), 400
    if not isinstance(orders, list):
        return jsonify({"error": "orders must be a list"}), 400

    def _handler() -> Tuple[dict, int]:
        success = knowledge_service.reorder_knowledge_points_in_category(
            category_id=category_id,
            knowledge_point_orders=orders
        )
        return {"message": "Knowledge points reordered successfully", "count": len(orders)}, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/knowledge-points/<name>/move")
@require_role("teacher")
def move_knowledge_point(name: str):
    """将知识点移动到新的分类

    请求体示例:
    {
        "newCategoryId": "category2",
        "orderIndex": 0
    }
    """
    body = request.get_json(force=True, silent=True) or {}
    new_category_id = body.get("newCategoryId")
    order_index = body.get("orderIndex", 0)

    if not new_category_id:
        return jsonify({"error": "newCategoryId is required"}), 400

    def _handler() -> Tuple[dict, int]:
        success = knowledge_service.move_knowledge_point_to_category(
            knowledge_name=name,
            new_category_id=new_category_id,
            order_index=order_index,
            updated_by="teacher"
        )
        return {"message": f"Knowledge point '{name}' moved successfully"}, 200

    return _graph_operation(_handler)
