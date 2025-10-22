import json
import os
import uuid
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from openai import OpenAI

import database
from levels import CHAPTERS, SectionConfig, build_chapter_lookup, flatten_scenario_for_template

load_dotenv()
database.init_database()

DEEPSEEK_BASE = "https://api.deepseek.com"
MODEL = "deepseek-chat"

app = Flask(__name__, static_folder="static")

CHAPTER_LOOKUP = build_chapter_lookup()


class MissingKeyError(RuntimeError):
    pass


def _require_key(env_name: str) -> str:
    key = os.getenv(env_name)
    if not key:
        raise MissingKeyError(f"Missing environment variable: {env_name}")
    return key


def _create_client(api_key: str) -> OpenAI:
    return OpenAI(api_key=api_key, base_url=DEEPSEEK_BASE)


def _complete_chat(api_key: str, messages: List[Dict[str, str]], temperature: float = 0.7) -> str:
    client = _create_client(api_key)
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=temperature,
    )
    if not response.choices:
        raise RuntimeError("Empty response from chat completion API")
    return response.choices[0].message.content or ""


def _extract_json_block(text: str) -> Dict[str, object]:
    cleaned = text.strip().strip("`")
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("JSON block not found in response")
    json_string = cleaned[start : end + 1]
    return json.loads(json_string)


def _prepare_scenario_payload(raw: Dict[str, object]) -> Dict[str, object]:
    return {
        "title": raw.get("scenario_title", ""),
        "summary": raw.get("scenario_summary", ""),
        "studentRole": raw.get("student_role", ""),
        "studentCompany": raw.get("student_company", {}) or {},
        "aiRole": raw.get("ai_role", ""),
        "aiCompany": raw.get("ai_company", {}) or {},
        "product": raw.get("product", {}) or {},
        "marketLandscape": raw.get("market_landscape", ""),
        "timeline": raw.get("timeline", ""),
        "logistics": raw.get("logistics", ""),
        "risks": raw.get("risks", []) or [],
        "negotiationTargets": raw.get("negotiation_targets", []) or [],
        "communicationTone": raw.get("communication_tone", ""),
        "checklist": raw.get("checklist", []) or [],
        "knowledgePoints": raw.get("knowledge_points", []) or [],
    }


def _build_transcript(history: List[Dict[str, str]], scenario: Dict[str, object]) -> str:
    lines: List[str] = []
    lines.append(f"場景標題: {scenario.get('scenario_title', '')}")
    lines.append(f"場景摘要: {scenario.get('scenario_summary', '')}")
    lines.append(f"學生角色: {scenario.get('student_role', '')}")
    lines.append(f"AI 角色: {scenario.get('ai_role', '')}")
    lines.append(f"產品資訊: {json.dumps(scenario.get('product', {}), ensure_ascii=False)}")
    lines.append(f"市場與物流: {scenario.get('market_landscape', '')}；{scenario.get('logistics', '')}")
    lines.append("對話逐字稿：")

    ai_name = "AI"
    ai_company = scenario.get("ai_company", {}) or {}
    if isinstance(ai_company, dict):
        ai_company_name = ai_company.get("name")
        if isinstance(ai_company_name, str) and ai_company_name:
            ai_name = ai_company_name

    for message in history:
        role = message.get("role")
        content = message.get("content", "")
        if role == "user":
            speaker = "學生"
        elif role == "assistant":
            speaker = ai_name
        else:
            speaker = role or "系統"
        lines.append(f"{speaker}: {content}")
    return "\n".join(lines)


def _get_section(chapter_id: str, section_id: str) -> SectionConfig:
    chapter = CHAPTER_LOOKUP.get(chapter_id)
    if not chapter:
        raise KeyError("Invalid chapter id")
    for section in chapter.sections:
        if section.id == section_id:
            return section
    raise KeyError("Invalid section id")


def _extract_token() -> Optional[str]:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    token = request.headers.get("X-Auth-Token")
    if token:
        return token.strip()
    return None


def _require_user(required_role: Optional[str] = None) -> Tuple[Optional[Dict[str, object]], Optional[Tuple[Dict[str, str], int]]]:
    token = _extract_token()
    if not token:
        return None, ({"error": "Authentication required"}, 401)
    user = database.get_user_by_token(token)
    if not user:
        return None, ({"error": "Invalid or expired token"}, 401)
    if required_role and user.get("role") != required_role:
        return None, ({"error": "Forbidden"}, 403)
    return user, None


@app.route("/")
def index() -> str:
    return send_from_directory(app.static_folder, "index.html")


@app.post("/api/login")
def login():
    data = request.get_json(force=True)
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    user = database.authenticate_user(username, password)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    token = database.issue_auth_token(int(user["id"]))
    payload = {"token": token, "user": user}
    return jsonify(payload)


@app.get("/api/levels")
def list_levels():
    chapters_payload = []
    for chapter in CHAPTERS:
        chapters_payload.append(
            {
                "id": chapter.id,
                "title": chapter.title,
                "sections": [
                    {
                        "id": section.id,
                        "title": section.title,
                        "description": section.description,
                    }
                    for section in chapter.sections
                ],
            }
        )
    return jsonify({"chapters": chapters_payload})


@app.post("/api/start_level")
def start_level():
    user, error = _require_user(required_role="student")
    if error:
        body, status = error
        return jsonify(body), status

    try:
        collab_key = _require_key("DEEPSEEK_COLLAB_KEY")
    except MissingKeyError as exc:  # pragma: no cover - runtime environment guard
        return jsonify({"error": str(exc)}), 500

    data = request.get_json(force=True)
    chapter_id = data.get("chapterId")
    section_id = data.get("sectionId")

    if not chapter_id or not section_id:
        return jsonify({"error": "chapterId and sectionId are required"}), 400

    try:
        section = _get_section(chapter_id, section_id)
    except KeyError as exc:
        return jsonify({"error": str(exc)}), 404

    messages = [
        {"role": "system", "content": section.environment_prompt_template},
        {"role": "user", "content": section.environment_user_message},
    ]

    try:
        raw_response = _complete_chat(collab_key, messages, temperature=0.8)
        scenario = _extract_json_block(raw_response)
    except Exception as exc:  # pragma: no cover - protects against LLM format variance
        return (
            jsonify(
                {
                    "error": "Failed to generate scenario",
                    "details": str(exc),
                }
            ),
            500,
        )

    flat_context = flatten_scenario_for_template(scenario)
    if not flat_context.get("knowledge_points_hint"):
        flat_context["knowledge_points_hint"] = (
            "報盤結構, 議價策略, 跨文化溝通"
            if section.expects_bargaining
            else "英文商務函電寫作, 信息提取, 跨文化表達"
        )
    conversation_prompt = section.conversation_prompt_template.format_map(flat_context)
    evaluation_prompt = section.evaluation_prompt_template.format_map(flat_context)

    session_id = uuid.uuid4().hex

    database.create_session(
        session_id=session_id,
        user_id=int(user["id"]),
        chapter_id=chapter_id,
        section_id=section_id,
        system_prompt=conversation_prompt,
        evaluation_prompt=evaluation_prompt,
        scenario=scenario,
        expects_bargaining=section.expects_bargaining,
    )

    opening_message = scenario.get("opening_message")
    if isinstance(opening_message, str) and opening_message.strip():
        database.add_message(session_id, "assistant", opening_message.strip())

    payload = {
        "sessionId": session_id,
        "scenario": _prepare_scenario_payload(scenario),
        "openingMessage": opening_message or "",
        "knowledgePoints": scenario.get("knowledge_points", []) or [],
    }
    return jsonify(payload)


@app.post("/api/chat")
def chat():
    user, error = _require_user(required_role="student")
    if error:
        body, status = error
        return jsonify(body), status

    try:
        collab_key = _require_key("DEEPSEEK_COLLAB_KEY")
    except MissingKeyError as exc:  # pragma: no cover
        return jsonify({"error": str(exc)}), 500

    data = request.get_json(force=True)
    session_id = data.get("sessionId")
    user_message = (data.get("message") or "").strip()

    if not session_id or not user_message:
        return jsonify({"error": "sessionId and message are required"}), 400

    session = database.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    if int(user["id"]) != int(session["user_id"]):
        return jsonify({"error": "Forbidden"}), 403

    database.add_message(session_id, "user", user_message)

    history_rows = database.get_messages(session_id)
    history: List[Dict[str, str]] = [{"role": row["role"], "content": row["content"]} for row in history_rows]

    messages = [{"role": "system", "content": session["system_prompt"]}]
    messages.extend(history)

    try:
        ai_reply = _complete_chat(collab_key, messages, temperature=0.7).strip()
    except Exception as exc:  # pragma: no cover
        database.remove_last_message(session_id)
        return jsonify({"error": f"Failed to fetch assistant reply: {exc}"}), 500

    database.add_message(session_id, "assistant", ai_reply)

    evaluation = _evaluate_session(session_id, session)

    latest_evaluation = database.get_latest_evaluation(session_id)
    if latest_evaluation:
        evaluation = latest_evaluation

    return jsonify(
        {
            "reply": ai_reply,
            "evaluation": evaluation,
        }
    )


def _evaluate_session(session_id: str, session: Dict[str, object]) -> Dict[str, object]:
    try:
        critic_key = _require_key("DEEPSEEK_CRITIC_KEY")
    except MissingKeyError:
        scenario = session.get("scenario", {}) if session else {}
        return {
            "score": None,
            "scoreLabel": None,
            "commentary": "未配置批判評估 API Key。",
            "actionItems": [],
            "knowledgePoints": scenario.get("knowledge_points", []) or [],
            "bargainingWinRate": None,
        }

    scenario = session.get("scenario", {})
    scenario_knowledge = scenario.get("knowledge_points", []) or []
    history_rows = database.get_messages(session_id)
    transcript_history = [{"role": row["role"], "content": row["content"]} for row in history_rows]
    transcript = _build_transcript(transcript_history, scenario)
    evaluation_prompt = session.get("evaluation_prompt", "")

    messages = [
        {"role": "system", "content": str(evaluation_prompt)},
        {
            "role": "user",
            "content": transcript,
        },
    ]

    try:
        raw = _complete_chat(critic_key, messages, temperature=0.2)
        data = _extract_json_block(raw)
    except Exception:  # pragma: no cover - tolerate evaluation failures
        return {
            "score": None,
            "scoreLabel": None,
            "commentary": "評估暫時無法提供，請稍後再試。",
            "actionItems": [],
            "knowledgePoints": scenario_knowledge,
            "bargainingWinRate": None,
        }

    score = data.get("score")
    score_label = data.get("score_label")
    action_items = data.get("action_items", []) or []
    knowledge_points = data.get("knowledge_points", []) or scenario_knowledge
    if not isinstance(action_items, list):
        action_items = [action_items]
    if not isinstance(knowledge_points, list):
        knowledge_points = [knowledge_points] if knowledge_points else []
    bargaining_win_rate = data.get("bargaining_win_rate") if session.get("expects_bargaining") else None

    result = {
        "score": score,
        "scoreLabel": score_label,
        "commentary": data.get("commentary", ""),
        "actionItems": action_items,
        "knowledgePoints": knowledge_points,
        "bargainingWinRate": bargaining_win_rate,
    }

    database.save_evaluation(session_id, result)
    return result


@app.get("/api/sessions")
def list_sessions_for_user_endpoint():
    user, error = _require_user()
    if error:
        body, status = error
        return jsonify(body), status

    target_user_id = int(user["id"])
    if user["role"] == "teacher":
        query_param = request.args.get("userId")
        if not query_param:
            return jsonify({"error": "userId is required for teacher queries"}), 400
        target_user_id = int(query_param)

    sessions = database.list_sessions_for_user(target_user_id)
    return jsonify({"sessions": sessions})


@app.get("/api/sessions/<session_id>")
def get_session_detail(session_id: str):
    user, error = _require_user()
    if error:
        body, status = error
        return jsonify(body), status

    session = database.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    if user["role"] == "student" and int(session["user_id"]) != int(user["id"]):
        return jsonify({"error": "Forbidden"}), 403

    history = database.get_messages(session_id)
    evaluation = database.get_latest_evaluation(session_id)

    payload = {
        "session": {
            "id": session["id"],
            "chapterId": session["chapter_id"],
            "sectionId": session["section_id"],
            "scenario": _prepare_scenario_payload(session["scenario"]),
            "expectsBargaining": session["expects_bargaining"],
        },
        "messages": history,
        "evaluation": evaluation,
    }
    return jsonify(payload)


@app.get("/api/admin/students")
def list_students_progress_endpoint():
    user, error = _require_user(required_role="teacher")
    if error:
        body, status = error
        return jsonify(body), status

    students = database.list_students_progress()
    return jsonify({"students": students})


@app.get("/api/admin/students/<int:student_id>")
def get_student_detail_endpoint(student_id: int):
    user, error = _require_user(required_role="teacher")
    if error:
        body, status = error
        return jsonify(body), status

    detail = database.get_student_detail(student_id)
    if not detail:
        return jsonify({"error": "Student not found"}), 404
    return jsonify(detail)


if __name__ == "__main__":  # pragma: no cover
    app.run(debug=True)
