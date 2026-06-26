"""AI 辅助工具路由：对话 Copilot（场外援助）。"""

from __future__ import annotations

import json
from typing import Dict, List

from flask import Blueprint, Response, jsonify, request

import database
from services.auth_service import current_user, require_role
from services.llm_service import complete_chat, stream_chat
from utils.normalizers import normalize_text
from utils.validators import MissingKeyError, as_bool, require_key

bp = Blueprint("assistants", __name__)


def _format_chat_history(
    history: List[Dict[str, object]],
    student_role: str,
    ai_role: str,
    limit: int = 12,
) -> str:
    if not history:
        return ""
    trimmed = history[-limit:]
    lines = []
    for row in trimmed:
        role = row.get("role")
        content = normalize_text(row.get("content"))
        if not content:
            continue
        if role == "user":
            speaker = student_role or "Student"
        elif role == "assistant":
            speaker = ai_role or "Counterparty"
        else:
            speaker = role or "System"
        lines.append(f"{speaker}: {content}")
    return "\n".join(lines)


def _build_chat_assist_prompt(
    action: str,
    scenario: Dict[str, object],
    user_hint: str,
    history: List[Dict[str, object]],
) -> str:
    student_role = normalize_text(scenario.get("student_role")) or "Student"
    ai_role = normalize_text(scenario.get("ai_role")) or "Counterparty"
    product = scenario.get("product") or {}
    product_name = normalize_text(product.get("name")) or "product"
    specs = normalize_text(product.get("specifications")) or ""
    quantity = normalize_text(product.get("quantity_requirement")) or ""
    targets = scenario.get("negotiation_targets") or []
    targets_line = "; ".join([normalize_text(t) for t in targets if normalize_text(t)])

    history_text = _format_chat_history(history, student_role, ai_role)
    history_block = f"\nConversation so far:\n{history_text}\n" if history_text else ""

    if action == "assistant":
        return (
            "You are a live-chat copilot for trade negotiation practice. "
            "Suggest how the student can reply next: first give a short direction (one bullet) and then one concise, full reply paragraph the student can use verbatim.\n"
            f"- Student role: {student_role}\n"
            f"- AI counterpart: {ai_role}\n"
            f"- Product: {product_name} {specs} {quantity}\n"
            f"- Negotiation targets: {targets_line}\n"
            "Tone: professional, concise, actionable. Do not include meta comments.\n"
            f"{history_block}"
            f"User hint: {user_hint}"
        )

    return (
        "You are an auto-reply agent for trade negotiation training. "
        "Generate the next single-turn student reply in English. Keep it concise, professional, and aligned with negotiation context. No meta commentary.\n"
        f"- Student role: {student_role}\n"
        f"- AI counterpart: {ai_role}\n"
        f"- Product: {product_name} {specs} {quantity}\n"
        f"- Negotiation targets: {targets_line}\n"
        f"{history_block}"
        f"Hint: {user_hint}"
    )


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
    history_rows = database.get_messages(session_id)
    history: List[Dict[str, object]] = [
        {"role": row.get("role"), "content": row.get("content")} for row in history_rows
    ]
    try:
        api_key = require_key("DEEPSEEK_COPILOT_API_KEY")
    except MissingKeyError:
        api_key = require_key("DEEPSEEK_COLLAB_KEY")

    prompt = _build_chat_assist_prompt(action, scenario, user_input or "", history)
    stream_requested = as_bool(request.args.get("stream"))
    if stream_requested:

        def event_stream():
            try:
                for delta in stream_chat(api_key, [{"role": "user", "content": prompt}], temperature=0.5):
                    if not isinstance(delta, str):
                        continue
                    payload = json.dumps({"content": delta})
                    yield f"event: chunk\ndata: {payload}\n\n"
            except Exception as exc:  # pragma: no cover - 辅助接口容错
                error_payload = json.dumps({"error": f"Failed to generate suggestion: {exc}"})
                yield f"event: error\ndata: {error_payload}\n\n"
                return
            yield "event: done\ndata: {}\n\n"

        return Response(event_stream(), mimetype="text/event-stream")

    try:
        suggestion = complete_chat(api_key, [{"role": "user", "content": prompt}], temperature=0.5)
    except Exception as exc:  # pragma: no cover - 辅助接口容错
        return jsonify({"error": f"Failed to generate suggestion: {exc}"}), 500

    return jsonify({"suggestion": normalize_text(suggestion)})
