"""作业、会话以及聊天相关接口。"""

from __future__ import annotations

import json
import os
import uuid
from typing import Dict, List, Optional

from flask import Blueprint, Response, jsonify, request, stream_with_context

import database
from services import evaluation_service
from services.auth_service import current_user, require_role
from services.document_composer import compose_review_document, generate_opening_message
from services.evaluation_service import evaluate_session
from services.llm_service import complete_chat, stream_chat
from services.scenario_generator import (
    DIFFICULTY_PROFILES,
    DEFAULT_DIFFICULTY,
    generate_scenario_for_section,
    inject_difficulty_metadata,
    prepare_scenario_payload,
    render_prompts_from_section,
)
from utils.normalizers import normalize_text
from utils.language import contains_cjk, is_probably_english
from utils.validators import MissingKeyError, as_bool, require_key

bp = Blueprint("assignments", __name__)

ENGLISH_ONLY_SYSTEM_MESSAGE = (
    "You are a collaborative trade negotiation coach. Respond exclusively in English with professional business tone, "
    "even if the student uses another language unless they explicitly request a bilingual answer."
)

ENGLISH_REWRITE_SYSTEM_MESSAGE = (
    "You are a bilingual trade negotiation editor. Rewrite assistant replies into natural, professional English only. "
    "Preserve the factual content, numbers, and commitments, but remove any Chinese characters or bilingual phrasing."
)


def _ensure_english_reply(collab_key: str, reply: str) -> str:
    text = normalize_text(reply)
    if is_probably_english(text):
        return text

    rewrite_messages = [
        {"role": "system", "content": ENGLISH_REWRITE_SYSTEM_MESSAGE},
        {
            "role": "user",
            "content": (
                "Rewrite the following assistant reply so that it is entirely in English. "
                "Keep negotiation details, numbers, and commitments accurate, and avoid apologies unless present.\n\n"
                f"Reply: {text}"
            ),
        },
    ]

    try:
        rewritten = normalize_text(complete_chat(collab_key, rewrite_messages, temperature=0.2))
    except Exception:
        rewritten = ""

    if is_probably_english(rewritten):
        return rewritten

    return (
        "Apologies for the confusion. I will continue our negotiation entirely in English from this point forward. "
        "Could you please restate your last question or proposal so that I can respond precisely?"
    )


REVIEW_SECTION_IDS = {
    "chapter-4-section-1",
    "chapter-4-section-2",
    "chapter-4-section-5",
    "chapter-5-section-4",
    "chapter-6-section-1",
}


def _attach_review_document(section_id: Optional[str], scenario: Dict[str, object]) -> Optional[str]:
    """Generate and persist a review document into the scenario payload when applicable."""
    if not section_id or not scenario or section_id not in REVIEW_SECTION_IDS:
        return None
    existing = scenario.get("document_text") or scenario.get("documentText")
    if isinstance(existing, str) and existing.strip():
        return existing
    doc = compose_review_document(section_id, scenario)
    if doc:
        scenario["document_text"] = doc
    return doc


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

    scenario["mode"] = section.get("mode") or scenario.get("mode") or ""
    document_text = _attach_review_document(section_id, scenario)
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
        "documentText": document_text or scenario.get("document_text") or "",
        "reviewHints": scenario.get("review_hints") or {},
        "mode": section.get("mode") or "",
        "chapterId": chapter_id,
        "sectionId": section_id,
        "difficulty": difficulty_key,
    }
    return jsonify(payload)


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
    messages.append({"role": "system", "content": ENGLISH_ONLY_SYSTEM_MESSAGE})
    messages.extend(history)

    stream_requested = as_bool(request.args.get("stream"))

    if stream_requested:

        def event_stream():
            chunks: List[str] = []
            stream_blocked = False
            try:
                # 流式推送 AI 逐步回答，前端可即时渲染
                for delta in stream_chat(collab_key, messages, temperature=0.7):
                    if not isinstance(delta, str):
                        continue
                    chunks.append(delta)
                    if not stream_blocked and contains_cjk(delta):
                        stream_blocked = True
                    if stream_blocked:
                        continue
                    payload = json.dumps({"content": delta})
                    yield f"event: chunk\ndata: {payload}\n\n"
            except Exception as exc:
                database.remove_last_message(session_id)
                error_payload = json.dumps({"error": str(exc)})
                yield f"event: error\ndata: {error_payload}\n\n"
                return

            ai_reply_raw = "".join(chunks).strip()
            ai_reply = _ensure_english_reply(
                collab_key, ai_reply_raw or "(no valid reply received)"
            )
            database.add_message(session_id, "assistant", ai_reply)

            reply_payload = json.dumps({"reply": ai_reply})
            yield f"event: summary\ndata: {reply_payload}\n\n"

            # 流式评估：先推送分数，再推送详情
            try:
                ctx = evaluation_service.prepare_evaluation_context(session_id, session)
                # 快速知识点召回（不依赖 LLM），用于提前渲染 evaluation-knowledge
                try:
                    recalled = evaluation_service.recall_knowledge_points_from_context(ctx, limit=5)
                except Exception:
                    recalled = []
                if recalled:
                    yield f"event: knowledge\ndata: {json.dumps({'knowledgePoints': recalled, 'source': 'recall'})}\n\n"
                score_key = os.getenv("DEEPSEEK_CRITIC_SCORE_KEY") or os.getenv("DEEPSEEK_CRITIC_KEY")
                detail_key = os.getenv("DEEPSEEK_CRITIC_DETAIL_KEY") or os.getenv("DEEPSEEK_CRITIC_KEY")

                score_data, raw_score = evaluation_service.compute_score(ctx, score_key)
                score_payload = {
                    "score": score_data.get("score"),
                    "scoreLabel": evaluation_service._score_to_label(score_data.get("score")),
                    "debug": {"rawScore": raw_score, "parsedScore": score_data},
                }
                yield f"event: score\ndata: {json.dumps(score_payload)}\n\n"

                detail_data, raw_detail = evaluation_service.compute_detail(ctx, detail_key)
                evaluation = evaluation_service.build_evaluation_result(
                    ctx, session, score_data, detail_data, raw_score, raw_detail
                )
                database.save_evaluation(session_id, evaluation)
                detail_payload = json.dumps({"evaluation": evaluation})
                yield f"event: detail\ndata: {detail_payload}\n\n"
            except Exception as exc:  # pragma: no cover - fallback to avoid SSE break
                LOGGER.exception("evaluate_session streaming failed: %s", exc)
                fallback_eval = {
                    "score": None,
                    "scoreLabel": None,
                    "commentary": "評估暫時不可用，請稍後再試。",
                    "actionItems": [],
                    "knowledgePoints": session.get("scenario", {}).get("knowledge_points", []) or [],
                    "bargainingWinRate": None,
                }
                yield f"event: detail\ndata: {json.dumps({'evaluation': fallback_eval})}\n\n"

            yield "event: close\ndata: {}\n\n"

        response = Response(stream_with_context(event_stream()), mimetype="text/event-stream")
        response.headers["Cache-Control"] = "no-cache"
        return response

    try:
        raw_reply = complete_chat(collab_key, messages, temperature=0.7).strip()
    except Exception as exc:
        database.remove_last_message(session_id)
        return jsonify({"error": f"Failed to fetch assistant reply: {exc}"}), 500

    ai_reply = _ensure_english_reply(collab_key, raw_reply)
    database.add_message(session_id, "assistant", ai_reply)

    try:
        evaluation = evaluate_session(session_id, session)
    except Exception as exc:  # pragma: no cover - defensive fallback
        LOGGER.exception("evaluate_session failed: %s", exc)
        evaluation = {
            "score": None,
            "scoreLabel": None,
            "commentary": "評估暫時不可用，請稍後再試。",
            "actionItems": [],
            "knowledgePoints": session.get("scenario", {}).get("knowledge_points", []) or [],
            "bargainingWinRate": None,
        }
    latest_evaluation = database.get_latest_evaluation(session_id)
    if latest_evaluation:
        merged = {**latest_evaluation, **evaluation}
        if evaluation.get("debug"):
            merged["debug"] = evaluation.get("debug")
        evaluation = merged

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
    scenario_raw = session["scenario"]
    _attach_review_document(session.get("section_id"), scenario_raw)

    payload = {
        "session": {
            "id": session["id"],
            "chapterId": session["chapter_id"],
            "sectionId": session["section_id"],
            "scenario": prepare_scenario_payload(scenario_raw),
            "expectsBargaining": session["expects_bargaining"],
            "difficulty": session.get("difficulty"),
            "mode": scenario_raw.get("mode") or "",
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
    _attach_review_document(session.get("section_id"), scenario)
    opening_message = generate_opening_message(session.get("section_id"), scenario)
    if opening_message:
        database.add_message(session_id, "assistant", opening_message)

    payload = {
        "sessionId": session_id,
        "scenario": prepare_scenario_payload(scenario),
        "openingMessage": opening_message or "",
        "knowledgePoints": scenario.get("knowledge_points", []) or [],
        "documentText": scenario.get("document_text") or "",
        "reviewHints": scenario.get("review_hints") or {},
        "chapterId": session["chapter_id"],
        "sectionId": session["section_id"],
        "difficulty": session.get("difficulty") or DEFAULT_DIFFICULTY,
        "mode": scenario.get("mode") or "",
    }
    return jsonify(payload)
