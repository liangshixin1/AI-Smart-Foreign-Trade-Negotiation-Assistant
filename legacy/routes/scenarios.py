"""场景模板与关卡配置相关的接口。"""

from __future__ import annotations

from typing import Dict

from flask import Blueprint, jsonify, request

import database
from services.auth_service import current_user, require_role
from services.scenario_generator import (
    DIFFICULTY_PROFILES,
    DEFAULT_DIFFICULTY,
    assemble_scenario_from_blueprint,
    ensure_level_hierarchy,
    generate_scenario_for_section,
    get_difficulty_profile,
    inject_difficulty_metadata,
    prepare_scenario_payload,
)
from utils.normalizers import normalize_text
from utils.validators import MissingKeyError

bp = Blueprint("scenarios", __name__)


def _serialize_blueprint(record: Dict[str, object]) -> Dict[str, object]:
    payload = {
        "id": record["id"],
        "title": record.get("title", ""),
        "description": record.get("description", ""),
        "difficulty": record.get("difficulty", DEFAULT_DIFFICULTY),
        "blueprint": record.get("blueprint", {}),
        "createdAt": record.get("createdAt"),
        "updatedAt": record.get("updatedAt"),
        "difficultyDescription": record.get("difficultyDescription", ""),
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
    """根据手工输入或 AI 结果创建蓝图。"""
    user = current_user()
    data = request.get_json(force=True)
    blueprint_raw = data.get("blueprint") or {}
    difficulty_key = str(data.get("difficulty") or DEFAULT_DIFFICULTY).lower()
    if difficulty_key not in DIFFICULTY_PROFILES:
        difficulty_key = DEFAULT_DIFFICULTY

    scenario, profile = assemble_scenario_from_blueprint(blueprint_raw, difficulty_key)
    title = normalize_text(data.get("title")) or scenario.get("scenario_title") or "未命名关卡"
    description = normalize_text(data.get("description")) or scenario.get("scenario_summary", "")

    record = database.create_blueprint(
        owner_id=user.id,
        title=title,
        description=description,
        difficulty=difficulty_key,
        blueprint=scenario,
    )
    record["difficultyDescription"] = profile.get("description")
    return jsonify({"blueprint": _serialize_blueprint(record)}), 201


@bp.put("/api/blueprints/<blueprint_id>")
@require_role("teacher")
def update_blueprint(blueprint_id: str):
    """更新既有蓝图的内容或难度。"""
    user = current_user()
    existing = database.get_blueprint(blueprint_id)
    if not existing or int(existing.get("ownerId")) != user.id:
        return jsonify({"error": "Blueprint not found"}), 404

    data = request.get_json(force=True)
    blueprint_raw = data.get("blueprint")
    difficulty_key = str(data.get("difficulty") or existing.get("difficulty") or DEFAULT_DIFFICULTY).lower()
    if difficulty_key not in DIFFICULTY_PROFILES:
        difficulty_key = DEFAULT_DIFFICULTY
    profile = get_difficulty_profile(difficulty_key)

    updates: Dict[str, object] = {
        "title": data.get("title"),
        "description": data.get("description"),
        "difficulty": difficulty_key,
    }

    scenario = None
    if isinstance(blueprint_raw, dict):
        scenario, profile = assemble_scenario_from_blueprint(blueprint_raw, difficulty_key)
        updates["blueprint"] = scenario

    updated = database.update_blueprint(
        blueprint_id,
        title=normalize_text(updates.get("title")) if updates.get("title") is not None else None,
        description=normalize_text(updates.get("description")) if updates.get("description") is not None else None,
        difficulty=difficulty_key,
        blueprint=scenario if scenario is not None else None,
    )
    if not updated:
        return jsonify({"error": "Blueprint not found"}), 404
    updated["difficultyDescription"] = profile.get("description")
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
    """调用大模型为指定章节生成新的谈判场景。"""
    data = request.get_json(force=True)
    chapter_id = data.get("chapterId")
    section_id = data.get("sectionId")
    difficulty_key = str(data.get("difficulty") or DEFAULT_DIFFICULTY).lower()

    if not chapter_id or not section_id:
        return jsonify({"error": "chapterId and sectionId are required"}), 400

    try:
        section = database.get_section_template(chapter_id, section_id)
    except KeyError as exc:
        return jsonify({"error": str(exc)}), 404

    try:
        scenario, profile = generate_scenario_for_section(section, difficulty_key)
    except MissingKeyError as exc:
        return jsonify({"error": str(exc)}), 500
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception as exc:  # pragma: no cover - 容忍上游异常
        return jsonify({"error": f"Failed to generate scenario: {exc}"}), 500

    payload = {
        "scenario": scenario,
        "difficulty": difficulty_key,
        "difficultyLabel": profile.get("label"),
        "difficultyDescription": profile.get("description"),
        "chapterId": chapter_id,
        "sectionId": section_id,
    }
    return jsonify(payload)
