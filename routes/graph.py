"""REST endpoints that expose the knowledge graph powered by Neo4j."""

from __future__ import annotations

from typing import Callable, Tuple

from flask import Blueprint, jsonify, request, send_file

from services import graph_service
from services.auth_service import current_user, require_role


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


@bp.get("/api/graph/initialization")
@require_role("teacher")
def get_initialization_status():
    """Return the knowledge graph initialization state."""

    def _handler() -> Tuple[dict, int]:
        status = graph_service.get_initialization_status()
        if not status.get("initialized"):
            status["defaults"] = graph_service.get_initialization_defaults_preview()
        return {"status": status}, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/initialization")
@require_role("teacher")
def initialize_graph():
    """Allow teachers to choose how to bootstrap the knowledge graph."""

    body = request.get_json(force=True, silent=True) or {}
    option = (body.get("option") or "").strip().lower()
    force = bool(body.get("force"))

    if option not in {"default", "blank", "import"}:
        return jsonify({"error": "option must be one of: default, blank, import"}), 400

    actor = current_user() or {}
    initiated_by = actor.get("username") or actor.get("display_name") or "teacher"

    def _handler() -> Tuple[dict, int]:
        try:
            status = graph_service.initialize_graph(
                option, initiated_by=initiated_by, force=force
            )
        except ValueError as exc:
            return {"error": str(exc)}, 400
        return {"status": status}, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/categories/reset")
@require_role("teacher")
def reset_categories():
    """Reset the category tree to the recommended defaults."""

    def _handler() -> Tuple[dict, int]:
        summary = graph_service.reset_knowledge_categories_to_default()
        return {"reset": summary}, 200

    return _graph_operation(_handler)


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


@bp.get("/api/graph/knowledge-points/overview")
@require_role("teacher")
def knowledge_points_overview():
    """聚合知识点列表、分类树和知识卡索引。"""

    def _handler() -> Tuple[dict, int]:
        payload = graph_service.get_knowledge_management_overview()
        return payload, 200

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


@bp.put("/api/graph/knowledge-points/<name>/category")
@require_role("teacher")
def update_knowledge_point_category(name: str):
    """通过拖拽快速调整知识点分类。"""

    body = request.get_json(force=True, silent=True) or {}
    category_path = body.get("category_path") or body.get("categoryPath") or body.get("category")
    order_index = body.get("order_index") or body.get("orderIndex")

    def _handler() -> Tuple[dict, int]:
        point = graph_service.update_knowledge_point_category(
            name,
            category_path,
            order_index=order_index,
        )
        return point, 200

    return _graph_operation(_handler)


@bp.delete("/api/graph/knowledge-points/<name>")
@require_role("teacher")
def delete_knowledge_point(name: str):
    """删除知识点"""
    def _handler() -> Tuple[dict, int]:
        graph_service.delete_knowledge_point(name)
        return {"message": f"Knowledge point '{name}' deleted successfully"}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/knowledge-points/orphans")
@require_role("teacher")
def list_orphan_knowledge_points():
    """List knowledge points that are not linked to practices or lessons."""

    def _handler() -> Tuple[dict, int]:
        orphans = graph_service.list_orphan_knowledge_points()
        return {"orphans": orphans}, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/knowledge-points/orphans/cleanup")
@require_role("teacher")
def cleanup_orphan_knowledge_points():
    """Archive or delete orphaned knowledge points."""

    body = request.get_json(force=True, silent=True) or {}
    names = body.get("names") or []
    if not isinstance(names, list):
        return jsonify({"error": "names must be a list"}), 400
    archive = bool(body.get("archive"))

    def _handler() -> Tuple[dict, int]:
        summary = graph_service.cleanup_orphan_knowledge_points(names, archive=archive)
        return {"cleanup": summary}, 200

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
    """获取知识点分类树形结构"""
    def _handler() -> Tuple[dict, int]:
        tree = graph_service.get_knowledge_categories_tree()
        return {"categories": tree}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/practices/<practice_id>")
@require_role("teacher")
def get_practice_graph_detail(practice_id: str):
    def _handler() -> Tuple[dict, int]:
        detail = graph_service.get_practice_detail(practice_id)
        return {"practice": detail}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/practices/<practice_id>/knowledge/recommendations")
@require_role("teacher")
def get_practice_recommendations(practice_id: str):
    """Expose preset knowledge suggestions for a practice."""

    def _handler() -> Tuple[dict, int]:
        payload = graph_service.get_practice_knowledge_recommendations(practice_id)
        return payload, 200

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


# ========== 智能批量导入端点（新） ==========


@bp.get("/api/graph/import/batch/template")
@require_role("teacher")
def download_batch_import_template():
    """
    下载智能批量导入模板（包含数据验证的Excel文件）

    可选参数：
    - include_existing: 是否在关系列下拉菜单中包含现有知识点（true/false）
    """
    include_existing = request.args.get('include_existing', 'true').lower() == 'true'

    try:
        from services.knowledge_graph_batch_importer import generate_smart_templates
        from services import knowledge_service, graph_service

        # 获取现有知识点列表（用于下拉菜单）
        existing_points = None
        if include_existing:
            try:
                points = knowledge_service.list_knowledge_points(limit=1000)
                existing_points = [p.get('name') for p in points if p.get('name')]
            except Exception as e:
                # 如果获取失败，不影响模板生成
                import logging
                logging.warning(f"无法获取现有知识点列表: {e}")

        # 获取现有阶段列表（用于"所属阶段"下拉菜单）
        existing_stages = None
        try:
            stages = graph_service.list_stages()
            existing_stages = [s.get('name') for s in stages if s.get('name')]
        except Exception as e:
            # 如果获取失败，使用默认阶段列表
            import logging
            logging.warning(f"无法获取现有阶段列表: {e}")

        # 生成模板
        excel_content = generate_smart_templates(existing_points, existing_stages)

        # 返回Excel文件
        import io
        return send_file(
            io.BytesIO(excel_content),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name="知识图谱批量导入模板.xlsx"
        )
    except Exception as e:
        import logging
        logging.exception("生成批量导入模板失败")
        return jsonify({"error": f"生成模板失败: {str(e)}"}), 500


@bp.post("/api/graph/import/batch")
@require_role("teacher")
def import_batch():
    """
    智能批量导入知识图谱（两表法）

    请求格式: multipart/form-data
    - points_file: 知识点主表Excel文件（必填）
    - examples_file: 案例库表Excel文件（可选）
    - mode: 导入模式，merge（合并）或replace（替换），默认为merge

    响应格式:
    {
      "success": true,
      "statistics": {
        "points": {"total": 50, "created": 45, "updated": 5, "failed": 0, "success_rate": "100%"},
        "relations": {"total": 80, "created": 80, "failed": 0, "success_rate": "100%"},
        "examples": {"total": 30, "created": 30, "failed": 0, "success_rate": "100%"}
      },
      "errors": [...],
      "warnings": [...],
      "execution_time": "2.5s"
    }
    """
    # 检查必填文件
    if 'points_file' not in request.files:
        return jsonify({"error": "缺少必填文件：知识点主表（points_file）"}), 400

    points_file = request.files['points_file']
    if points_file.filename == '':
        return jsonify({"error": "未选择知识点主表文件"}), 400

    if not points_file.filename.endswith(('.xlsx', '.xls')):
        return jsonify({"error": "知识点主表必须是Excel文件（.xlsx或.xls）"}), 400

    # 案例库表（可选）
    examples_file = request.files.get('examples_file')
    if examples_file and examples_file.filename:
        if not examples_file.filename.endswith(('.xlsx', '.xls')):
            return jsonify({"error": "案例库表必须是Excel文件（.xlsx或.xls）"}), 400
    else:
        examples_file = None

    # 导入模式
    mode = request.form.get('mode', 'merge').lower()
    if mode not in ['merge', 'replace']:
        return jsonify({"error": "mode参数必须是merge或replace"}), 400

    # 获取当前用户
    actor = current_user() or {}
    created_by = actor.get("username") or actor.get("display_name") or "teacher"

    def _handler() -> Tuple[dict, int]:
        try:
            from services.knowledge_graph_batch_importer import KnowledgeGraphBatchImporter
            from services.graph_service import GraphService

            # 创建导入器
            importer = KnowledgeGraphBatchImporter(GraphService())

            # 执行导入
            result = importer.import_from_two_tables(
                points_file=points_file.stream,
                examples_file=examples_file.stream if examples_file else None,
                mode=mode,
                created_by=created_by,
            )

            # 返回结果
            return result.to_dict(), 200

        except Exception as e:
            import logging
            logging.exception("批量导入失败")
            return {
                "success": False,
                "error": f"导入失败: {str(e)}",
                "statistics": {
                    "points": {"total": 0, "created": 0, "updated": 0, "failed": 0, "success_rate": "0%"},
                    "relations": {"total": 0, "created": 0, "failed": 0, "success_rate": "0%"},
                    "examples": {"total": 0, "created": 0, "failed": 0, "success_rate": "0%"},
                },
                "errors": [],
                "warnings": [],
                "execution_time": "0s",
            }, 500

    return _graph_operation(_handler)


@bp.post("/api/graph/import/batch/validate")
@require_role("teacher")
def validate_batch_import():
    """
    预校验批量导入数据（不执行实际导入）

    用于用户在正式导入前检查数据质量

    请求格式: multipart/form-data
    - points_file: 知识点主表Excel文件（必填）
    - examples_file: 案例库表Excel文件（可选）

    响应格式:
    {
      "valid": true,
      "errors": [...],
      "warnings": [...],
      "preview": {
        "points_count": 50,
        "relations_count": 80,
        "examples_count": 30
      }
    }
    """
    # 检查必填文件
    if 'points_file' not in request.files:
        return jsonify({"error": "缺少必填文件：知识点主表（points_file）"}), 400

    points_file = request.files['points_file']
    if points_file.filename == '':
        return jsonify({"error": "未选择知识点主表文件"}), 400

    # 案例库表（可选）
    examples_file = request.files.get('examples_file')
    if examples_file and not examples_file.filename:
        examples_file = None

    def _handler() -> Tuple[dict, int]:
        try:
            from services.knowledge_graph_batch_importer import KnowledgeGraphBatchImporter
            from services.graph_service import GraphService

            importer = KnowledgeGraphBatchImporter(GraphService())

            # Phase 1: 解析数据
            points_data, parse_errors = importer._parse_points_table(points_file.stream)
            errors = parse_errors
            warnings = []

            examples_data = []
            if examples_file:
                examples_data, example_errors = importer._parse_examples_table(examples_file.stream)
                errors.extend(example_errors)

            # 建立知识点名称列表
            importer.known_point_names = [p["name"] for p in points_data]

            # Phase 2: 验证数据
            if points_data:
                validation_errors, validation_warnings = importer._validate_all_data(
                    points_data, examples_data
                )
                errors.extend(validation_errors)
                warnings.extend(validation_warnings)

            # 统计关系数量
            relations_count = sum(
                len(relations)
                for point in points_data
                if "_relations" in point
                for relations in point["_relations"].values()
            )

            # 返回验证结果
            return {
                "valid": not any(e.severity == "ERROR" for e in errors),
                "errors": [
                    {
                        "severity": e.severity,
                        "table": e.table,
                        "row": e.row,
                        "field": e.field,
                        "value": e.value,
                        "message": e.message,
                        "suggestion": e.suggestion,
                    }
                    for e in errors
                ],
                "warnings": [
                    {
                        "severity": w.severity,
                        "table": w.table,
                        "row": w.row,
                        "field": w.field,
                        "value": w.value,
                        "message": w.message,
                        "suggestion": w.suggestion,
                    }
                    for w in warnings
                ],
                "preview": {
                    "points_count": len(points_data),
                    "relations_count": relations_count,
                    "examples_count": len(examples_data),
                }
            }, 200

        except Exception as e:
            import logging
            logging.exception("验证失败")
            return {
                "valid": False,
                "error": f"验证失败: {str(e)}",
                "errors": [],
                "warnings": [],
                "preview": {"points_count": 0, "relations_count": 0, "examples_count": 0}
            }, 500

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



# ========== 多节点类型架构端点 (Multi-Node Types API) ==========


@bp.post("/api/graph/migrations/multi-node-types/run")
@require_role("teacher")
def run_multi_node_types_migration():
    """
    运行多节点类型架构迁移

    创建 Stage, Skill, Terminology 等专用节点类型
    """
    actor = current_user() or {}
    initiated_by = actor.get("username") or actor.get("display_name") or "teacher"

    def _handler() -> Tuple[dict, int]:
        try:
            stats = graph_service.run_multi_node_types_migration(initiated_by=initiated_by)
            return {"success": True, "statistics": stats}, 200
        except Exception as e:
            return {"success": False, "error": str(e)}, 500

    return _graph_operation(_handler)


@bp.get("/api/graph/migrations/multi-node-types/status")
@require_role("teacher")
def get_multi_node_types_migration_status():
    """获取多节点类型迁移的状态"""
    def _handler() -> Tuple[dict, int]:
        status = graph_service.get_multi_node_types_migration_status()
        return {"status": status}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/flow")
@require_role()
def get_process_flow():
    """
    获取外贸谈判流程骨架

    返回所有 Stage 节点及其 PRECEDES 关系,用于前端渲染流程图
    """
    def _handler() -> Tuple[dict, int]:
        flow = graph_service.get_process_flow()
        return flow, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/stages")
@require_role()
def list_stages():
    """
    获取所有 Stage (阶段) 列表

    查询参数:
    - include_topics: 是否包含每个阶段的知识点列表 (true/false)
    """
    include_topics = request.args.get("include_topics", "false").lower() == "true"

    def _handler() -> Tuple[dict, int]:
        stages = graph_service.list_stages(include_topics=include_topics)
        return {"stages": stages}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/stages/<name>")
@require_role()
def get_stage(name: str):
    """获取单个 Stage 的详细信息"""
    def _handler() -> Tuple[dict, int]:
        stage = graph_service.get_stage(name)
        return {"stage": stage}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/terminology")
@require_role()
def list_terminology():
    """
    获取术语列表

    查询参数:
    - category: 可选的分类过滤 (如 "Incoterms", "Payment")
    """
    category = request.args.get("category")

    def _handler() -> Tuple[dict, int]:
        terms = graph_service.list_terminology(category=category)
        return {"terminology": terms}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/terminology/<name>")
@require_role()
def get_terminology(name: str):
    """获取单个术语的详细信息"""
    def _handler() -> Tuple[dict, int]:
        term = graph_service.get_terminology(name)
        return {"term": term}, 200

    return _graph_operation(_handler)


@bp.post("/api/graph/stages/<stage_name>/knowledge-points/<knowledge_point_name>")
@require_role("teacher")
def link_knowledge_point_to_stage(stage_name: str, knowledge_point_name: str):
    """将知识点关联到某个流程阶段"""
    def _handler() -> Tuple[dict, int]:
        stage = graph_service.link_knowledge_point_to_stage(knowledge_point_name, stage_name)
        return {"stage": stage}, 200

    return _graph_operation(_handler)


@bp.delete("/api/graph/stages/<stage_name>/knowledge-points/<knowledge_point_name>")
@require_role("teacher")
def unlink_knowledge_point_from_stage(stage_name: str, knowledge_point_name: str):
    """移除知识点与流程阶段的关联"""
    def _handler() -> Tuple[dict, int]:
        stage = graph_service.unlink_knowledge_point_from_stage(knowledge_point_name, stage_name)
        return {"stage": stage}, 200

    return _graph_operation(_handler)


@bp.get("/api/graph/visualization/enhanced")
@require_role("teacher")
def get_enhanced_graph_visualization():
    """
    获取增强的图谱可视化数据,支持多节点类型

    查询参数:
    - node_types: 要包含的节点类型,用逗号分隔 (如 "Stage,KnowledgePoint,Terminology")
    - max_nodes: 最大节点数量限制 (默认100)
    """
    node_types_param = request.args.get("node_types")
    node_types = node_types_param.split(",") if node_types_param else None

    try:
        max_nodes = int(request.args.get("max_nodes", 100))
        if max_nodes <= 0 or max_nodes > 500:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "max_nodes must be between 1 and 500"}), 400

    def _handler() -> Tuple[dict, int]:
        data = graph_service.get_enhanced_graph_visualization(
            node_types=node_types,
            max_nodes=max_nodes,
        )
        return data, 200

    return _graph_operation(_handler)

@bp.post("/api/graph/import/three-sheets")
@require_role("teacher")
def import_three_sheets():
    """
    三表联动导入知识图谱（新版，支持多节点类型）

    请求格式: multipart/form-data
    - excel_file: 包含三个sheet的Excel文件（必填）
        - Sheet 1: 谈判流程
        - Sheet 2: 知识点主表（支持"所属阶段"）
        - Sheet 3: 案例库（可选）
    - mode: 导入模式，merge（合并）或replace（替换），默认为merge

    响应格式:
    {
      "success": true,
      "statistics": {
        "stages": {"total": 10, "created": 10, "updated": 0, "failed": 0},
        "points": {"total": 50, "created": 45, "updated": 5, "failed": 0},
        "relations": {"total": 80, "created": 80, "failed": 0},
        "examples": {"total": 30, "created": 30, "failed": 0}
      },
      "errors": [...],
      "warnings": [...],
      "execution_time": "3.5s"
    }
    """
    # 检查必填文件
    if 'excel_file' not in request.files:
        return jsonify({"error": "缺少必填文件：excel_file"}), 400

    excel_file = request.files['excel_file']
    if excel_file.filename == '':
        return jsonify({"error": "未选择Excel文件"}), 400

    if not excel_file.filename.endswith(('.xlsx', '.xls')):
        return jsonify({"error": "必须是Excel文件（.xlsx或.xls）"}), 400

    # 导入模式
    mode = request.form.get('mode', 'merge').lower()
    if mode not in ['merge', 'replace']:
        return jsonify({"error": "mode参数必须是merge或replace"}), 400

    # 获取当前用户
    actor = current_user() or {}
    created_by = actor.get("username") or actor.get("display_name") or "teacher"

    def _handler() -> Tuple[dict, int]:
        try:
            from services.knowledge_graph_batch_importer import KnowledgeGraphBatchImporter
            from services.graph_service import GraphService

            # 创建导入器
            importer = KnowledgeGraphBatchImporter(GraphService())

            # 执行三表联动导入
            result = importer.import_from_three_sheets(
                excel_file=excel_file.stream,
                mode=mode,
                created_by=created_by,
            )

            # 返回结果
            return result.to_dict(), 200

        except Exception as e:
            import logging
            logging.exception("三表导入失败")
            return {
                "success": False,
                "error": f"导入失败: {str(e)}",
                "statistics": {
                    "stages": {"total": 0, "created": 0, "updated": 0, "failed": 0},
                    "points": {"total": 0, "created": 0, "updated": 0, "failed": 0},
                    "relations": {"total": 0, "created": 0, "failed": 0},
                    "examples": {"total": 0, "created": 0, "failed": 0},
                },
                "errors": [],
                "warnings": [],
                "execution_time": "0s",
            }, 500

    return _graph_operation(_handler)
