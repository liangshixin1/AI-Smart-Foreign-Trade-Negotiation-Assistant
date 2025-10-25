"""作业、会话以及聊天相关接口。"""

from __future__ import annotations

import copy
import json
import uuid
from typing import Dict, List, Optional

from flask import Blueprint, Response, jsonify, request, stream_with_context

import database
from services.auth_service import current_user, require_role
from services.document_composer import generate_opening_message
from services.evaluation_service import evaluate_session
from services.llm_service import complete_chat, stream_chat
from services.scenario_generator import (
    DIFFICULTY_PROFILES,
    DEFAULT_DIFFICULTY,
    apply_difficulty_profile,
    assemble_scenario_from_blueprint,
    build_custom_assignment_prompts,
    generate_scenario_for_section,
    get_difficulty_profile,
    inject_difficulty_metadata,
    prepare_scenario_payload,
    render_prompts_from_section,
)
from utils.normalizers import normalize_text
from utils.validators import MissingKeyError, as_bool, require_key

bp = Blueprint("assignments", __name__)


def _serialize_assignment(record: Dict[str, object]) -> Dict[str, object]:
    scenario_data = record.get("scenario", {}) or {}
    payload = {
        "id": record["id"],
        "title": record.get("title", ""),
        "description": record.get("description", ""),
        "difficulty": record.get("difficulty", DEFAULT_DIFFICULTY),
        "chapterId": record.get("chapterId"),
        "sectionId": record.get("sectionId"),
        "blueprintId": record.get("blueprintId"),
        "scenario": prepare_scenario_payload(scenario_data),
        "createdAt": record.get("createdAt"),
        "updatedAt": record.get("updatedAt"),
        "dueAt": record.get("dueAt"),
    }
    if "assignedCount" in record:
        payload["assignedCount"] = record.get("assignedCount", 0)
    if "completedCount" in record:
        payload["completedCount"] = record.get("completedCount", 0)
    if "inProgressCount" in record:
        payload["inProgressCount"] = record.get("inProgressCount", 0)
    if "studentIds" in record and isinstance(record.get("studentIds"), list):
        payload["studentIds"] = record.get("studentIds")
    if "status" in record:
        payload["status"] = record.get("status")
    if "sessionId" in record:
        payload["sessionId"] = record.get("sessionId")
    if "submittedAt" in record:
        payload["submittedAt"] = record.get("submittedAt")
    inject_difficulty_metadata(payload)
    return payload


@bp.post("/api/start_level")
@require_role("student")
def start_level():
    """学生自由练习入口：生成即时场景并创建会话。"""
    user = current_user()
    data = request.get_json(force=True)
    chapter_id = data.get("chapterId")
    section_id = data.get("sectionId")
    difficulty_key = str(data.get("difficulty") or DEFAULT_DIFFICULTY).lower()
    if difficulty_key not in DIFFICULTY_PROFILES:
        difficulty_key = DEFAULT_DIFFICULTY

    if not chapter_id or not section_id:
        return jsonify({"error": "chapterId and sectionId are required"}), 400

    section = database.get_section_template(chapter_id, section_id)
    if not section:
        return jsonify({"error": "Invalid chapterId or sectionId"}), 404

    try:
        scenario, difficulty_profile = generate_scenario_for_section(section, difficulty_key)
    except MissingKeyError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception as exc:
        return jsonify({"error": f"Failed to generate scenario: {exc}"}), 500

    conversation_prompt, evaluation_prompt = render_prompts_from_section(
        section, scenario, difficulty_key, difficulty_profile
    )

    session_id = uuid.uuid4().hex
    database.create_session(
        session_id=session_id,
        user_id=user.id,
        chapter_id=chapter_id,
        section_id=section_id,
        system_prompt=conversation_prompt,
        evaluation_prompt=evaluation_prompt,
        scenario=scenario,
        expects_bargaining=bool(section.get("expects_bargaining")),
        difficulty=difficulty_key,
    )

    opening_message = generate_opening_message(section_id, scenario)
    if opening_message:
        database.add_message(session_id, "assistant", opening_message)

    payload = {
        "sessionId": session_id,
        "scenario": prepare_scenario_payload(scenario),
        "openingMessage": opening_message or "",
        "knowledgePoints": scenario.get("knowledge_points", []) or [],
        "chapterId": chapter_id,
        "sectionId": section_id,
        "difficulty": difficulty_key,
    }
    return jsonify(payload)


@bp.post("/api/assignments")
@require_role("teacher")
def create_assignment():
    """教师布置作业入口，可选择蓝图或自定义场景。"""
    user = current_user()
    data = request.get_json(force=True)
    blueprint_id = data.get("blueprintId")
    raw_scenario = data.get("scenario")
    blueprint_raw = data.get("blueprint")

    difficulty_key = str(
        data.get("difficulty")
        or (raw_scenario or {}).get("difficulty")
        or (blueprint_raw or {}).get("difficulty")
        or DEFAULT_DIFFICULTY
    ).lower()
    if difficulty_key not in DIFFICULTY_PROFILES:
        difficulty_key = DEFAULT_DIFFICULTY

    scenario: Optional[Dict[str, object]] = None
    profile: Dict[str, str] = get_difficulty_profile(difficulty_key)

    if blueprint_id:
        blueprint = database.get_blueprint(blueprint_id)
        if not blueprint or int(blueprint.get("ownerId")) != user.id:
            return jsonify({"error": "Blueprint not found"}), 404
        scenario = copy.deepcopy(blueprint.get("blueprint") or {})
        scenario, profile = apply_difficulty_profile(scenario, difficulty_key)
    elif isinstance(raw_scenario, dict) and "scenario_title" in raw_scenario:
        scenario = copy.deepcopy(raw_scenario)
        scenario, profile = apply_difficulty_profile(scenario, difficulty_key)
    elif isinstance(blueprint_raw, dict):
        scenario, profile = assemble_scenario_from_blueprint(blueprint_raw, difficulty_key)
    else:
        return jsonify({"error": "scenario or blueprint data is required"}), 400

    chapter_id = data.get("chapterId")
    section_id = data.get("sectionId")
    description = normalize_text(data.get("description")) or scenario.get("scenario_summary", "")
    title = normalize_text(data.get("title")) or scenario.get("scenario_title") or "统一作业"

    if chapter_id and section_id:
        section = database.get_section_template(chapter_id, section_id)
        if not section:
            return jsonify({"error": "Invalid chapterId or sectionId"}), 404
        conversation_prompt, evaluation_prompt = render_prompts_from_section(
            section, scenario, difficulty_key, profile
        )
    else:
        conversation_prompt, evaluation_prompt = build_custom_assignment_prompts(
            scenario, profile
        )

    student_ids: List[int] = []
    raw_students = data.get("studentIds") or []
    if isinstance(raw_students, list):
        for value in raw_students:
            try:
                student_ids.append(int(value))
            except (TypeError, ValueError):
                continue

    assignment_id = f"assignment-{uuid.uuid4().hex[:12]}"
    record = database.create_assignment(
        assignment_id=assignment_id,
        owner_id=user.id,
        title=title,
        description=description,
        chapter_id=chapter_id,
        section_id=section_id,
        scenario=scenario,
        conversation_prompt=conversation_prompt,
        evaluation_prompt=evaluation_prompt,
        difficulty=difficulty_key,
        blueprint_id=blueprint_id,
        due_at=data.get("dueAt"),
        student_ids=student_ids,
    )

    response_payload = _serialize_assignment(record)
    response_payload["difficultyDescription"] = profile.get("description")
    response_payload["studentIds"] = student_ids
    return jsonify({"assignment": response_payload}), 201


@bp.get("/api/assignments")
@require_role("teacher")
def list_assignments():
    user = current_user()
    records = database.list_assignments_by_teacher(user.id)
    payload = [_serialize_assignment(record) for record in records]
    return jsonify({"assignments": payload})


@bp.get("/api/student/assignments")
@require_role("student")
def list_student_assignments():
    user = current_user()
    records = database.list_assignments_for_student(user.id)
    payload = [_serialize_assignment(record) for record in records]
    return jsonify({"assignments": payload})


@bp.post("/api/assignments/<assignment_id>/start")
@require_role("student")
def start_assignment(assignment_id: str):
    user = current_user()
    record = database.get_assignment_for_student(assignment_id, user.id)
    if not record:
        return jsonify({"error": "Assignment not found"}), 404

    scenario = record.get("scenario") or {}
    difficulty_key = record.get("difficulty") or DEFAULT_DIFFICULTY
    if record.get("sessionId"):
        session = database.get_session(record["sessionId"])
        if session and int(session["user_id"]) == user.id:
            evaluation = database.get_latest_evaluation(session["id"])
            if evaluation:
                inject_difficulty_metadata(evaluation)
            payload = {
                "sessionId": session["id"],
                "scenario": prepare_scenario_payload(scenario),
                "assignmentId": assignment_id,
                "knowledgePoints": scenario.get("knowledge_points", []) or [],
                "openingMessage": record.get("openingMessage", ""),
                "difficulty": difficulty_key,
            }
            inject_difficulty_metadata(payload)
            return jsonify(payload)

    session_id = uuid.uuid4().hex
    expects_bargaining = False
    product = scenario.get("product") if isinstance(scenario, dict) else {}
    if isinstance(product, dict):
        price_expectation = product.get("price_expectation") or {}
        expects_bargaining = bool(
            isinstance(price_expectation, dict)
            and (
                normalize_text(price_expectation.get("student_target"))
                or normalize_text(price_expectation.get("ai_bottom_line"))
            )
        )

    database.create_session(
        session_id=session_id,
        user_id=user.id,
        chapter_id=record.get("chapterId"),
        section_id=record.get("sectionId"),
        system_prompt=record.get("conversationPrompt"),
        evaluation_prompt=record.get("evaluationPrompt"),
        scenario=scenario,
        expects_bargaining=expects_bargaining,
        difficulty=difficulty_key,
        assignment_id=assignment_id,
    )
    database.link_assignment_session(assignment_id, user.id, session_id)

    opening_message = generate_opening_message(record.get("sectionId"), scenario)
    if opening_message:
        database.add_message(session_id, "assistant", opening_message)

    payload = {
        "sessionId": session_id,
        "scenario": prepare_scenario_payload(scenario),
        "assignmentId": assignment_id,
        "knowledgePoints": scenario.get("knowledge_points", []) or [],
        "openingMessage": opening_message or "",
        "difficulty": difficulty_key,
    }
    inject_difficulty_metadata(payload)
    return jsonify(payload), 201


@bp.post("/api/chat")
@require_role("student")
def chat():
    user = current_user()
    try:
        collab_key = require_key("DEEPSEEK_COLLAB_KEY")
    except MissingKeyError as exc:
        return jsonify({"error": str(exc)}), 500

    data = request.get_json(force=True)
    session_id = data.get("sessionId")
    user_message = (data.get("message") or "").strip()

    if not session_id or not user_message:
        return jsonify({"error": "sessionId and message are required"}), 400

    session = database.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    if int(session["user_id"]) != user.id:
        return jsonify({"error": "Forbidden"}), 403

    database.add_message(session_id, "user", user_message)

    history_rows = database.get_messages(session_id)
    history: List[Dict[str, str]] = [
        {"role": row["role"], "content": row["content"]} for row in history_rows
    ]

    messages = [{"role": "system", "content": session["system_prompt"]}]
    messages.extend(history)

    stream_requested = as_bool(request.args.get("stream"))

    if stream_requested:

        def event_stream():
            chunks: List[str] = []
            try:
                # 流式推送 AI 逐步回答，前端可即时渲染
                for delta in stream_chat(collab_key, messages, temperature=0.7):
                    chunks.append(delta)
                    payload = json.dumps({"content": delta})
                    yield f"event: chunk\ndata: {payload}\n\n"
            except Exception as exc:
                database.remove_last_message(session_id)
                error_payload = json.dumps({"error": str(exc)})
                yield f"event: error\ndata: {error_payload}\n\n"
                return

            ai_reply = "".join(chunks).strip() or "(no valid reply received)"
            database.add_message(session_id, "assistant", ai_reply)

            evaluation = evaluate_session(session_id, session)
            latest_evaluation = database.get_latest_evaluation(session_id)
            if latest_evaluation:
                evaluation = latest_evaluation

            reply_payload = json.dumps({"reply": ai_reply})
            yield f"event: summary\ndata: {reply_payload}\n\n"

            evaluation_payload = json.dumps({"evaluation": evaluation})
            yield f"event: evaluation\ndata: {evaluation_payload}\n\n"

            yield "event: done\ndata: {}\n\n"

        response = Response(stream_with_context(event_stream()), mimetype="text/event-stream")
        response.headers["Cache-Control"] = "no-cache"
        return response

    try:
        ai_reply = complete_chat(collab_key, messages, temperature=0.7).strip()
    except Exception as exc:
        database.remove_last_message(session_id)
        return jsonify({"error": f"Failed to fetch assistant reply: {exc}"}), 500

    database.add_message(session_id, "assistant", ai_reply)

    evaluation = evaluate_session(session_id, session)
    latest_evaluation = database.get_latest_evaluation(session_id)
    if latest_evaluation:
        evaluation = latest_evaluation

    return jsonify({"reply": ai_reply, "evaluation": evaluation})


@bp.get("/api/sessions")
@require_role()
def list_sessions():
    user = current_user()
    target_user_id = user.id
    if user.role == "teacher":
        query_param = request.args.get("userId")
        if not query_param:
            return jsonify({"error": "userId is required for teacher queries"}), 400
        target_user_id = int(query_param)

    sessions = database.list_sessions_for_user(target_user_id)
    for session in sessions:
        inject_difficulty_metadata(session)
    return jsonify({"sessions": sessions})


@bp.get("/api/student/dashboard")
@require_role("student")
def get_student_dashboard():
    user = current_user()
    dashboard = database.get_student_dashboard(user.id)
    for entry in dashboard.get("timeline", []):
        inject_difficulty_metadata(entry)
    return jsonify(dashboard)


@bp.get("/api/sessions/<session_id>")
@require_role()
def get_session_detail(session_id: str):
    user = current_user()
    session = database.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    if user.role == "student" and int(session["user_id"]) != user.id:
        return jsonify({"error": "Forbidden"}), 403

    history = database.get_messages(session_id)
    evaluation = database.get_latest_evaluation(session_id)

    payload = {
        "session": {
            "id": session["id"],
            "chapterId": session["chapter_id"],
            "sectionId": session["section_id"],
            "scenario": prepare_scenario_payload(session["scenario"]),
            "expectsBargaining": session["expects_bargaining"],
            "difficulty": session.get("difficulty"),
        },
        "messages": history,
        "evaluation": evaluation,
    }
    inject_difficulty_metadata(payload["session"])
    return jsonify(payload)


@bp.post("/api/sessions/<session_id>/reset")
@require_role("student")
def reset_session(session_id: str):
    user = current_user()
    session = database.get_session(session_id)
    if not session or int(session["user_id"]) != user.id:
        return jsonify({"error": "Session not found"}), 404

    database.reset_session(session_id)
    scenario = session["scenario"]
    opening_message = generate_opening_message(session.get("section_id"), scenario)
    if opening_message:
        database.add_message(session_id, "assistant", opening_message)

    payload = {
        "sessionId": session_id,
        "scenario": prepare_scenario_payload(scenario),
        "openingMessage": opening_message or "",
        "knowledgePoints": scenario.get("knowledge_points", []) or [],
        "chapterId": session["chapter_id"],
        "sectionId": session["section_id"],
        "difficulty": session.get("difficulty") or DEFAULT_DIFFICULTY,
    }
    return jsonify(payload)
