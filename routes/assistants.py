"""AI 辅助工具路由：邮件模式 Copilot。"""

from __future__ import annotations

from typing import Dict

from flask import Blueprint, jsonify, request

import database
from services.auth_service import current_user, require_role
from services.llm_service import complete_chat
from utils.normalizers import normalize_text
from utils.validators import MissingKeyError, require_key

bp = Blueprint("assistants", __name__)


def _build_email_assist_prompt(action: str, scenario: Dict[str, object], user_hint: str) -> str:
    student_role = normalize_text(scenario.get("student_role")) or "Student"
    ai_role = normalize_text(scenario.get("ai_role")) or "Counterparty"
    product = scenario.get("product") or {}
    product_name = normalize_text(product.get("name")) or "product"
    specs = normalize_text(product.get("specifications")) or ""
    quantity = normalize_text(product.get("quantity_requirement")) or ""
    targets = scenario.get("negotiation_targets") or []
    targets_line = "; ".join([normalize_text(t) for t in targets if normalize_text(t)])

    if action == "draft":
        return (
            "You are an email copilot for international trade. "
            "Generate a concise English business email draft based on the user's intent and scenario context.\n"
            f"- Student role: {student_role}\n"
            f"- AI counterpart: {ai_role}\n"
            f"- Product: {product_name} {specs} {quantity}\n"
            f"- Negotiation targets: {targets_line}\n"
            "Format with Subject, Salutation, body paragraphs, and Closing/Signature. "
            "Keep it professional and actionable. Do not add meta explanations.\n"
            f"User intent: {user_hint}"
        )

    return (
        "You are an email editor for international trade. "
        "Polish the provided email draft while keeping meaning and commitments unchanged. "
        "Fix tone, clarity, structure (Subject, Salutation, paragraphs, Closing), and concision. "
        "Return the full revised email only.\n"
        f"- Student role: {student_role}\n"
        f"- AI counterpart: {ai_role}\n"
        f"- Product: {product_name} {specs} {quantity}\n"
        f"- Negotiation targets: {targets_line}\n"
        f"Draft:\n{user_hint}"
    )


def _build_chat_assist_prompt(action: str, scenario: Dict[str, object], user_hint: str) -> str:
    student_role = normalize_text(scenario.get("student_role")) or "Student"
    ai_role = normalize_text(scenario.get("ai_role")) or "Counterparty"
    product = scenario.get("product") or {}
    product_name = normalize_text(product.get("name")) or "product"
    specs = normalize_text(product.get("specifications")) or ""
    quantity = normalize_text(product.get("quantity_requirement")) or ""
    targets = scenario.get("negotiation_targets") or []
    targets_line = "; ".join([normalize_text(t) for t in targets if normalize_text(t)])

    if action == "assistant":
        return (
            "You are a live-chat copilot for trade negotiation practice. "
            "Suggest how the student can reply next: first give a short direction (one bullet) and then one concise, full reply paragraph the student can use verbatim.\n"
            f"- Student role: {student_role}\n"
            f"- AI counterpart: {ai_role}\n"
            f"- Product: {product_name} {specs} {quantity}\n"
            f"- Negotiation targets: {targets_line}\n"
            "Tone: professional, concise, actionable. Do not include meta comments.\n"
            f"User hint: {user_hint}"
        )

    return (
        "You are an auto-reply agent for trade negotiation training. "
        "Generate the next single-turn student reply in English. Keep it concise, professional, and aligned with negotiation context. No meta commentary.\n"
        f"- Student role: {student_role}\n"
        f"- AI counterpart: {ai_role}\n"
        f"- Product: {product_name} {specs} {quantity}\n"
        f"- Negotiation targets: {targets_line}\n"
        f"Hint: {user_hint}"
    )


@bp.post("/api/ai/email/assist")
@require_role()
def email_assist():
    user = current_user()
    data = request.get_json(force=True)
    session_id = data.get("session_id") or data.get("sessionId")
    action = (data.get("action") or "").lower()
    user_input = normalize_text(data.get("user_input") or data.get("userInput"))

    if action not in {"draft", "polish"}:
        return jsonify({"error": "Invalid action"}), 400
    if not session_id:
        return jsonify({"error": "session_id is required"}), 400

    session = database.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    if user.role == "student" and int(session["user_id"]) != user.id:
        return jsonify({"error": "Forbidden"}), 403

    scenario = session.get("scenario") or {}
    try:
        api_key = require_key("DEEPSEEK_COPILOT_API_KEY")
    except MissingKeyError:
        api_key = require_key("DEEPSEEK_COLLAB_KEY")

    prompt = _build_email_assist_prompt(action, scenario, user_input or "")
    try:
        suggestion = complete_chat(api_key, [{"role": "user", "content": prompt}], temperature=0.4)
    except Exception as exc:  # pragma: no cover - 辅助接口允许失败
        return jsonify({"error": f"Failed to generate suggestion: {exc}"}), 500

    return jsonify({"suggestion": normalize_text(suggestion)})


@bp.post("/api/ai/chat/copilot")
@require_role()
def chat_copilot():
    user = current_user()
    data = request.get_json(force=True)
    session_id = data.get("session_id") or data.get("sessionId")
    action = (data.get("action") or "").lower()
    user_input = normalize_text(data.get("user_input") or data.get("userInput"))

    if action not in {"assistant", "agent"}:
        return jsonify({"error": "Invalid action"}), 400
    if not session_id:
        return jsonify({"error": "session_id is required"}), 400

    session = database.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    if user.role == "student" and int(session["user_id"]) != user.id:
        return jsonify({"error": "Forbidden"}), 403

    scenario = session.get("scenario") or {}
    try:
        api_key = require_key("DEEPSEEK_COPILOT_API_KEY")
    except MissingKeyError:
        api_key = require_key("DEEPSEEK_COLLAB_KEY")

    prompt = _build_chat_assist_prompt(action, scenario, user_input or "")
    try:
        suggestion = complete_chat(api_key, [{"role": "user", "content": prompt}], temperature=0.5)
    except Exception as exc:  # pragma: no cover - 辅助接口容错
        return jsonify({"error": f"Failed to generate suggestion: {exc}"}), 500

    return jsonify({"suggestion": normalize_text(suggestion)})
