"""场景模板与关卡配置相关的接口（单一固定案例 · 无难度档位）。"""

from __future__ import annotations

from typing import Dict

from flask import Blueprint, jsonify, request

import database
from services.auth_service import current_user, require_role
from services.scenario_generator import (
    DEFAULT_DIFFICULTY,
    assemble_scenario_from_blueprint,
    ensure_level_hierarchy,
    generate_scenario_for_section,
    inject_difficulty_metadata,
    prepare_scenario_payload,
    regenerate_fixed_scenario,
)
from utils.normalizers import normalize_text
from utils.validators import MissingKeyError

bp = Blueprint("scenarios", __name__)


def _serialize_blueprint(record: Dict[str, object]) -> Dict[str, object]:
    payload = {
        "id": record["id"],
        "title": record.get("title", ""),
        "description": record.get("description", ""),
        "blueprint": record.get("blueprint", {}),
        "createdAt": record.get("createdAt"),
        "updatedAt": record.get("updatedAt"),
    }
    inject_difficulty_metadata(payload)
    blueprint_data = payload.get("blueprint", {})
    if isinstance(blueprint_data, dict):
        payload["scenarioPreview"] = prepare_scenario_payload(blueprint_data)
    else:
        payload["scenarioPreview"] = {}
    return payload


@bp.get("/api/levels")
def list_levels():
    """查询关卡层级结构，用于前端渲染目录。"""
    chapters = ensure_level_hierarchy(include_prompts=False)
    return jsonify({"chapters": chapters})


@bp.get("/api/blueprints")
@require_role("teacher")
def list_blueprints():
    """教师查询本人创建的场景蓝图。"""
    user = current_user()
    records = database.list_blueprints(user.id)
    payload = [_serialize_blueprint(record) for record in records]
    return jsonify({"blueprints": payload})


@bp.post("/api/blueprints")
@require_role("teacher")
def create_blueprint():
    """根据手工输入或导入结果创建蓝图。"""
    user = current_user()
    data = request.get_json(force=True)
    blueprint_raw = data.get("blueprint") or {}

    scenario = assemble_scenario_from_blueprint(blueprint_raw)
    title = normalize_text(data.get("title")) or scenario.get("scenario_title") or "未命名关卡"
    description = normalize_text(data.get("description")) or scenario.get("scenario_summary", "")

    record = database.create_blueprint(
        owner_id=user.id,
        title=title,
        description=description,
        difficulty=DEFAULT_DIFFICULTY,
        blueprint=scenario,
    )
    return jsonify({"blueprint": _serialize_blueprint(record)}), 201


@bp.put("/api/blueprints/<blueprint_id>")
@require_role("teacher")
def update_blueprint(blueprint_id: str):
    """更新既有蓝图的内容。"""
    user = current_user()
    existing = database.get_blueprint(blueprint_id)
    if not existing or int(existing.get("ownerId")) != user.id:
        return jsonify({"error": "Blueprint not found"}), 404

    data = request.get_json(force=True)
    blueprint_raw = data.get("blueprint")

    scenario = None
    if isinstance(blueprint_raw, dict):
        scenario = assemble_scenario_from_blueprint(blueprint_raw)

    updated = database.update_blueprint(
        blueprint_id,
        title=normalize_text(data.get("title")) if data.get("title") is not None else None,
        description=normalize_text(data.get("description")) if data.get("description") is not None else None,
        difficulty=DEFAULT_DIFFICULTY,
        blueprint=scenario if scenario is not None else None,
    )
    if not updated:
        return jsonify({"error": "Blueprint not found"}), 404
    return jsonify({"blueprint": _serialize_blueprint(updated)})


@bp.delete("/api/blueprints/<blueprint_id>")
@require_role("teacher")
def delete_blueprint(blueprint_id: str):
    """删除蓝图，避免堆积历史版本。"""
    user = current_user()
    existing = database.get_blueprint(blueprint_id)
    if not existing or int(existing.get("ownerId")) != user.id:
        return jsonify({"error": "Blueprint not found"}), 404

    database.delete_blueprint(blueprint_id)
    return jsonify({"status": "deleted"})


@bp.post("/api/generator/scenario")
@require_role()
def generate_scenario():
    """返回指定关卡的固定场景（不再随机自动生成）。"""
    data = request.get_json(force=True)
    chapter_id = data.get("chapterId")
    section_id = data.get("sectionId")

    if not chapter_id or not section_id:
        return jsonify({"error": "chapterId and sectionId are required"}), 400

    section = database.get_section_template(chapter_id, section_id)
    if not section:
        return jsonify({"error": "Invalid chapterId or sectionId"}), 404

    try:
        scenario = generate_scenario_for_section(section)
    except MissingKeyError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception as exc:  # pragma: no cover - 容忍上游异常
        return jsonify({"error": f"Failed to load scenario: {exc}"}), 500

    return jsonify(
        {
            "scenario": scenario,
            "scenarioPreview": prepare_scenario_payload(scenario),
            "chapterId": chapter_id,
            "sectionId": section_id,
        }
    )


@bp.post("/api/levels/<chapter_id>/<section_id>/regenerate")
@require_role("teacher")
def regenerate_level_scenario(chapter_id: str, section_id: str):
    """教师操作：按本关案例简报用 DeepSeek 重新生成固定场景并固化存储。"""
    section = database.get_section_template(chapter_id, section_id)
    if not section:
        return jsonify({"error": "Invalid chapterId or sectionId"}), 404

    try:
        scenario = regenerate_fixed_scenario(section)
    except MissingKeyError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:  # pragma: no cover - 容忍上游异常
        return jsonify({"error": f"Failed to regenerate scenario: {exc}"}), 500

    import json

    database.update_section_scenario(
        chapter_id,
        section_id,
        json.dumps(scenario, ensure_ascii=False, indent=2),
    )

    return jsonify(
        {
            "scenario": scenario,
            "scenarioPreview": prepare_scenario_payload(scenario),
            "chapterId": chapter_id,
            "sectionId": section_id,
        }
    )
