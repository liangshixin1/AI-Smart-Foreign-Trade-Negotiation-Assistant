import copy
import json
import os
import uuid
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv
from flask import (
    Flask,
    Response,
    jsonify,
    request,
    send_from_directory,
    stream_with_context,
)
from openai import OpenAI

import database
from levels import CHAPTERS, flatten_scenario_for_template

load_dotenv()
database.init_database()
database.seed_default_levels(CHAPTERS)

DEEPSEEK_BASE = "https://api.deepseek.com"
MODEL = "deepseek-chat"

app = Flask(__name__, static_folder="static")

DEFAULT_DIFFICULTY = "balanced"
DIFFICULTY_PROFILES: Dict[str, Dict[str, str]] = {
    "friendly": {
        "label": "友好型 · 引导与鼓励",
        "description": "语气温暖，适度让步以支持学生梳理思路并建立自信。",
        "prompt_suffix": (
            "你是一位友好型的谈判对手，会主动给予积极反馈、概括要点，"
            "并在学生出现疏漏时给出提醒或示范句型。适度分享行业见解，鼓励学生提出更多澄清问题，"
            "在价格或条款上可在原底线上最多让步约 5% 以换取长期合作。"
        ),
        "tone_hint": "语气更温暖、积极，主动给予肯定与指导。",
        "bottom_line_hint": "可在原有底线上额外让步约 5%，强调合作诚意。",
    },
    "balanced": {
        "label": "默认 · 平衡博弈",
        "description": "保持专业礼貌，兼顾自身立场与合作机会。",
        "prompt_suffix": "",
        "tone_hint": "",
        "bottom_line_hint": "",
    },
    "tough": {
        "label": "强硬型 · 严守底线",
        "description": "语气坚定谨慎，强调风险控制与公司底线。",
        "prompt_suffix": (
            "你是一位强硬型的谈判对手，强调风控与底线意识。"
            "当学生尝试议价时，请要求其提供充分理由或额外让步，"
            "并重申关键条款的重要性。只有在获得确凿价值回报时才考虑微量让步。"
        ),
        "tone_hint": "语气更为坚定，明确指出风险与不可退让的条件。",
        "bottom_line_hint": "底线不可轻易突破，除非学生提供充分价值交换。",
    },
    "shrewd": {
        "label": "精明型 · 灵活试探",
        "description": "善于条件交换与试探，关注整体收益最大化。",
        "prompt_suffix": (
            "你是一位精明型的谈判对手，善于抛出条件交换并观察学生反应。"
            "请通过试探问题与设定多种方案，引导学生思考让步条件，"
            "在关键价格或条款上保持敏锐并要求对等回报。"
        ),
        "tone_hint": "语气务实敏锐，喜欢提出条件交换与方案比较。",
        "bottom_line_hint": "可根据学生的回报方案灵活调整底线范围。",
    },
}

SCENARIO_DIVERSITY_HINT = (
    "请在设计谈判情境时兼顾制造业、服务业、数字贸易、农业、电子产品业、汽车业、文化创意产业等多元行业，"
    "避免始终聚焦于一个产品、一个案例，使学生能够接触不同的外贸品类。"
)

ROLE_ENFORCEMENT_HINT = (
    "学生在本场景中必须明确扮演来自中国的买家或卖家，可根据任务设置选择进口商或出口商。"
    "请确保 student_role 字段中包含‘中国’字样，并给出行业、职位描述。"
)

CONVERSATION_DIVERSITY_HINT = (
    "在与学生的每轮对话中，选择贴合场景的行业背景示例，可结合原材料、工业品、"
    "生活消费品、服务解决方案等不同类型，刻意避免反复引用电子产品为例。"
)

ENGLISH_ENFORCEMENT_HINT = (
    "All assistant-facing outputs, including scenario briefings and conversation replies, must be written entirely in English."
    " Avoid inserting Chinese characters unless the student explicitly provides them or requests bilingual content."
)


def _get_difficulty_profile(key: Optional[str]) -> Dict[str, str]:
    normalized = str(key or DEFAULT_DIFFICULTY)
    return DIFFICULTY_PROFILES.get(normalized, DIFFICULTY_PROFILES[DEFAULT_DIFFICULTY])


def _apply_difficulty_profile(
    scenario: Dict[str, object], difficulty_key: str
) -> Tuple[Dict[str, object], Dict[str, str]]:
    profile = _get_difficulty_profile(difficulty_key)
    scenario_copy: Dict[str, object] = copy.deepcopy(scenario)
    scenario_copy["difficulty_key"] = difficulty_key
    scenario_copy["difficulty_label"] = profile["label"]
    scenario_copy["difficulty_description"] = profile["description"]

    tone_hint = profile.get("tone_hint")
    if tone_hint:
        base_tone = scenario_copy.get("communication_tone", "") or ""
        if tone_hint not in base_tone:
            scenario_copy["communication_tone"] = (
                f"{base_tone}（{tone_hint}）" if base_tone else tone_hint
            )

    product = scenario_copy.get("product")
    if isinstance(product, dict):
        price_expectation = product.get("price_expectation")
        if isinstance(price_expectation, dict):
            hint = profile.get("bottom_line_hint")
            if hint:
                ai_bottom_line = price_expectation.get("ai_bottom_line")
                if isinstance(ai_bottom_line, str) and ai_bottom_line.strip():
                    if hint not in ai_bottom_line:
                        price_expectation["ai_bottom_line"] = f"{ai_bottom_line}（{hint}）"
                else:
                    price_expectation["ai_bottom_line"] = hint

    return scenario_copy, profile


def _inject_difficulty_metadata(item: Dict[str, object]) -> None:
    difficulty_key = str(item.get("difficulty") or DEFAULT_DIFFICULTY)
    profile = _get_difficulty_profile(difficulty_key)
    item["difficulty"] = difficulty_key
    item["difficultyLabel"] = profile["label"]
    if "difficultyDescription" not in item or not item["difficultyDescription"]:
        item["difficultyDescription"] = profile["description"]


def _ensure_level_hierarchy(include_prompts: bool = False) -> List[Dict[str, object]]:
    """Load level hierarchy, reseeding defaults if database is empty."""

    chapters = database.list_level_hierarchy(include_prompts=include_prompts)
    if chapters:
        return chapters

    database.seed_default_levels(CHAPTERS)
    return database.list_level_hierarchy(include_prompts=include_prompts)


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


def _stream_chat(api_key: str, messages: List[Dict[str, str]], temperature: float = 0.7):
    client = _create_client(api_key)
    stream = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=temperature,
        stream=True,
    )
    for chunk in stream:
        for choice in chunk.choices or []:
            delta = getattr(choice, "delta", None)
            if delta and getattr(delta, "content", None):
                yield delta.content


def _extract_json_block(text: str) -> Dict[str, object]:
    cleaned = text.strip().strip("`")
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("JSON block not found in response")
    json_string = cleaned[start : end + 1]
    return json.loads(json_string)


def _prepare_scenario_payload(raw: Dict[str, object]) -> Dict[str, object]:
    difficulty_key = (raw.get("difficulty_key") or DEFAULT_DIFFICULTY)
    profile = _get_difficulty_profile(difficulty_key)
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
        "difficulty": difficulty_key,
        "difficultyLabel": raw.get("difficulty_label") or profile["label"],
        "difficultyDescription": raw.get("difficulty_description")
        or profile["description"],
    }


def _infer_student_trade_role(section: Dict[str, object]) -> str:
    text_segments: List[str] = []
    for key in ("description", "environment_user_message", "title"):
        value = section.get(key)
        if isinstance(value, str):
            text_segments.append(value)
    text_blob = " ".join(text_segments)
    lowered = text_blob.lower()
    if any(keyword in text_blob for keyword in ("卖家", "出口", "供货", "供應")):
        return "seller"
    if any(keyword in lowered for keyword in ("sell", "export")):
        return "seller"
    return "buyer"


def _ensure_chinese_student_role(scenario: Dict[str, object], trade_role: str) -> None:
    student_role = scenario.get("student_role")
    normalized = student_role.strip() if isinstance(student_role, str) else ""
    if "中国" not in normalized:
        normalized = f"中国{normalized}" if normalized else "中国外贸业务代表"

    if trade_role == "seller":
        if not any(keyword in normalized for keyword in ("卖", "出口", "供货", "供应")):
            normalized = f"中国卖家代表（{normalized}）"
    else:
        if not any(keyword in normalized for keyword in ("买", "采购", "进口")):
            normalized = f"中国买家代表（{normalized}）"

    scenario["student_role"] = normalized


def _generate_scenario_for_section(
    section: Dict[str, object], difficulty_key: str
) -> Tuple[Dict[str, object], Dict[str, str]]:
    try:
        generator_key = _require_key("DEEPSEEK_GENERATOR_KEY")
    except MissingKeyError as exc:
        raise RuntimeError(str(exc)) from exc

    messages = [
        {"role": "system", "content": section["environment_prompt_template"]},
        {"role": "system", "content": SCENARIO_DIVERSITY_HINT},
        {"role": "system", "content": ROLE_ENFORCEMENT_HINT},
        {"role": "system", "content": ENGLISH_ENFORCEMENT_HINT},
        {"role": "user", "content": section["environment_user_message"]},
    ]

    raw_response = _complete_chat(generator_key, messages, temperature=0.85)
    scenario = _extract_json_block(raw_response)
    trade_role = _infer_student_trade_role(section)
    _ensure_chinese_student_role(scenario, trade_role)
    scenario, profile = _apply_difficulty_profile(scenario, difficulty_key)
    return scenario, profile


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


def _get_section(chapter_id: str, section_id: str) -> Dict[str, object]:
    section = database.get_section_template(chapter_id, section_id)
    if not section:
        raise KeyError("Invalid section id")
    return section


def _extract_token() -> Optional[str]:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    token = request.headers.get("X-Auth-Token")
    if token:
        return token.strip()
    return None


def _as_bool(value: object, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        return normalized in {"1", "true", "yes", "on", "y"}
    return default


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
    chapters = _ensure_level_hierarchy(include_prompts=False)
    return jsonify({"chapters": chapters})


@app.post("/api/generator/scenario")
def generator_scenario():
    user, error = _require_user()
    if error:
        body, status = error
        return jsonify(body), status

    data = request.get_json(force=True)
    chapter_id = data.get("chapterId")
    section_id = data.get("sectionId")
    difficulty_key = str(data.get("difficulty") or DEFAULT_DIFFICULTY).lower()
    if difficulty_key not in DIFFICULTY_PROFILES:
        difficulty_key = DEFAULT_DIFFICULTY

    if not chapter_id or not section_id:
        return jsonify({"error": "chapterId and sectionId are required"}), 400

    try:
        section = _get_section(chapter_id, section_id)
    except KeyError as exc:
        return jsonify({"error": str(exc)}), 404

    try:
        scenario, profile = _generate_scenario_for_section(section, difficulty_key)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception as exc:  # pragma: no cover - tolerate upstream variance
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


@app.post("/api/start_level")
def start_level():
    user, error = _require_user(required_role="student")
    if error:
        body, status = error
        return jsonify(body), status

    data = request.get_json(force=True)
    chapter_id = data.get("chapterId")
    section_id = data.get("sectionId")
    difficulty_key = str(data.get("difficulty") or DEFAULT_DIFFICULTY).lower()
    if difficulty_key not in DIFFICULTY_PROFILES:
        difficulty_key = DEFAULT_DIFFICULTY

    if not chapter_id or not section_id:
        return jsonify({"error": "chapterId and sectionId are required"}), 400

    try:
        section = _get_section(chapter_id, section_id)
    except KeyError as exc:
        return jsonify({"error": str(exc)}), 404

    try:
        scenario, difficulty_profile = _generate_scenario_for_section(
            section, difficulty_key
        )
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
            if section.get("expects_bargaining")
            else "英文商務函電寫作, 信息提取, 跨文化表達"
        )
    conversation_prompt = section["conversation_prompt_template"].format_map(flat_context)
    prompt_suffix = difficulty_profile.get("prompt_suffix")
    if prompt_suffix:
        conversation_prompt = f"{conversation_prompt}\n\n[難度設定]\n{prompt_suffix}"
    if CONVERSATION_DIVERSITY_HINT not in conversation_prompt:
        conversation_prompt = (
            f"{conversation_prompt}\n\n[案例多样性提醒]\n{CONVERSATION_DIVERSITY_HINT}"
        )
    if ROLE_ENFORCEMENT_HINT not in conversation_prompt:
        conversation_prompt = (
            f"{conversation_prompt}\n\n[角色约束]\n请始终以学生为中国买家或中国卖家来组织对话，"
            "在回应中适时引用中国市场或供应链视角。"
        )
    if ENGLISH_ENFORCEMENT_HINT not in conversation_prompt:
        conversation_prompt = (
            f"{conversation_prompt}\n\n[Language Requirement]\n{ENGLISH_ENFORCEMENT_HINT}"
        )
    evaluation_prompt = section["evaluation_prompt_template"].format_map(flat_context)

    session_id = uuid.uuid4().hex

    database.create_session(
        session_id=session_id,
        user_id=int(user["id"]),
        chapter_id=chapter_id,
        section_id=section_id,
        system_prompt=conversation_prompt,
        evaluation_prompt=evaluation_prompt,
        scenario=scenario,
        expects_bargaining=bool(section.get("expects_bargaining")),
        difficulty=difficulty_key,
    )

    opening_message = scenario.get("opening_message")
    if isinstance(opening_message, str) and opening_message.strip():
        database.add_message(session_id, "assistant", opening_message.strip())

    payload = {
        "sessionId": session_id,
        "scenario": _prepare_scenario_payload(scenario),
        "openingMessage": opening_message or "",
        "knowledgePoints": scenario.get("knowledge_points", []) or [],
        "chapterId": chapter_id,
        "sectionId": section_id,
        "difficulty": difficulty_key,
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
    history: List[Dict[str, str]] = [
        {"role": row["role"], "content": row["content"]} for row in history_rows
    ]

    messages = [{"role": "system", "content": session["system_prompt"]}]
    messages.extend(history)

    stream_requested = _as_bool(request.args.get("stream"))

    if stream_requested:

        def event_stream():
            chunks: List[str] = []
            try:
                for delta in _stream_chat(collab_key, messages, temperature=0.7):
                    chunks.append(delta)
                    payload = json.dumps({"content": delta})
                    yield f"event: chunk\ndata: {payload}\n\n"
            except Exception as exc:  # pragma: no cover - tolerate upstream errors
                database.remove_last_message(session_id)
                error_payload = json.dumps({"error": str(exc)})
                yield f"event: error\ndata: {error_payload}\n\n"
                return

            ai_reply = "".join(chunks).strip()
            if not ai_reply:
                ai_reply = "(no valid reply received)"

            database.add_message(session_id, "assistant", ai_reply)

            evaluation = _evaluate_session(session_id, session)
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
        ai_reply = _complete_chat(collab_key, messages, temperature=0.7).strip()
    except Exception as exc:  # pragma: no cover
        database.remove_last_message(session_id)
        return jsonify({"error": f"Failed to fetch assistant reply: {exc}"}), 500

    database.add_message(session_id, "assistant", ai_reply)

    evaluation = _evaluate_session(session_id, session)

    latest_evaluation = database.get_latest_evaluation(session_id)
    if latest_evaluation:
        evaluation = latest_evaluation

    return jsonify({"reply": ai_reply, "evaluation": evaluation})


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
    for session in sessions:
        _inject_difficulty_metadata(session)
    return jsonify({"sessions": sessions})


@app.get("/api/student/dashboard")
def get_student_dashboard_endpoint():
    user, error = _require_user(required_role="student")
    if error:
        body, status = error
        return jsonify(body), status

    dashboard = database.get_student_dashboard(int(user["id"]))
    for entry in dashboard.get("timeline", []):
        _inject_difficulty_metadata(entry)
    return jsonify(dashboard)


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
            "difficulty": session.get("difficulty"),
        },
        "messages": history,
        "evaluation": evaluation,
    }
    _inject_difficulty_metadata(payload["session"])
    return jsonify(payload)


@app.post("/api/sessions/<session_id>/reset")
def reset_session_endpoint(session_id: str):
    user, error = _require_user(required_role="student")
    if error:
        body, status = error
        return jsonify(body), status

    session = database.get_session(session_id)
    if not session or int(session["user_id"]) != int(user["id"]):
        return jsonify({"error": "Session not found"}), 404

    database.reset_session(session_id)
    scenario = session["scenario"]
    opening_message = scenario.get("opening_message")
    if isinstance(opening_message, str) and opening_message.strip():
        database.add_message(session_id, "assistant", opening_message.strip())

    payload = {
        "sessionId": session_id,
        "scenario": _prepare_scenario_payload(scenario),
        "openingMessage": opening_message or "",
        "knowledgePoints": scenario.get("knowledge_points", []) or [],
        "chapterId": session["chapter_id"],
        "sectionId": session["section_id"],
        "difficulty": session.get("difficulty") or DEFAULT_DIFFICULTY,
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
    for session in detail.get("sessions", []):
        _inject_difficulty_metadata(session)
    return jsonify(detail)


@app.get("/api/admin/analytics")
def get_admin_analytics_endpoint():
    user, error = _require_user(required_role="teacher")
    if error:
        body, status = error
        return jsonify(body), status

    analytics = database.get_class_analytics()
    return jsonify(analytics)


@app.get("/api/admin/levels")
def get_admin_levels():
    user, error = _require_user(required_role="teacher")
    if error:
        body, status = error
        return jsonify(body), status

    chapters = _ensure_level_hierarchy(include_prompts=True)
    return jsonify({"chapters": chapters})


@app.post("/api/admin/chapters")
def create_admin_chapter():
    user, error = _require_user(required_role="teacher")
    if error:
        body, status = error
        return jsonify(body), status

    data = request.get_json(force=True)
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400

    description = (data.get("description") or "").strip()
    order_index = data.get("orderIndex")
    try:
        order_value = int(order_index) if order_index is not None else None
    except (TypeError, ValueError):
        return jsonify({"error": "orderIndex must be an integer"}), 400

    chapter_id = (data.get("id") or "").strip() or None
    chapter = database.create_chapter(
        title=title,
        description=description,
        order_index=order_value,
        chapter_id=chapter_id,
    )
    return jsonify({"chapter": chapter}), 201


@app.put("/api/admin/chapters/<chapter_id>")
def update_admin_chapter(chapter_id: str):
    user, error = _require_user(required_role="teacher")
    if error:
        body, status = error
        return jsonify(body), status

    data = request.get_json(force=True)
    kwargs: Dict[str, object] = {}
    if "title" in data:
        kwargs["title"] = (data.get("title") or "").strip()
    if "description" in data:
        kwargs["description"] = (data.get("description") or "").strip()
    if "orderIndex" in data:
        try:
            kwargs["order_index"] = int(data.get("orderIndex"))
        except (TypeError, ValueError):
            return jsonify({"error": "orderIndex must be an integer"}), 400

    chapter = database.update_chapter(chapter_id, **kwargs)
    if not chapter:
        return jsonify({"error": "Chapter not found"}), 404
    return jsonify({"chapter": chapter})


@app.delete("/api/admin/chapters/<chapter_id>")
def delete_admin_chapter(chapter_id: str):
    user, error = _require_user(required_role="teacher")
    if error:
        body, status = error
        return jsonify(body), status

    existing = database.get_chapter(chapter_id)
    if not existing:
        return jsonify({"error": "Chapter not found"}), 404
    database.delete_chapter(chapter_id)
    return ("", 204)


@app.post("/api/admin/sections")
def create_admin_section():
    user, error = _require_user(required_role="teacher")
    if error:
        body, status = error
        return jsonify(body), status

    data = request.get_json(force=True)
    chapter_id = (data.get("chapterId") or "").strip()
    if not chapter_id:
        return jsonify({"error": "chapterId is required"}), 400

    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    env_prompt = (data.get("environmentPromptTemplate") or "").strip()
    env_user = (data.get("environmentUserMessage") or "").strip()
    convo_prompt = (data.get("conversationPromptTemplate") or "").strip()
    eval_prompt = (data.get("evaluationPromptTemplate") or "").strip()

    if not all([title, description, env_prompt, env_user, convo_prompt, eval_prompt]):
        return jsonify({"error": "title, description and all prompt templates are required"}), 400

    expects_bargaining = _as_bool(data.get("expectsBargaining"), False)
    order_index = data.get("orderIndex")
    try:
        order_value = int(order_index) if order_index is not None else None
    except (TypeError, ValueError):
        return jsonify({"error": "orderIndex must be an integer"}), 400

    section_id = (data.get("id") or "").strip() or None
    section = database.create_section(
        chapter_id=chapter_id,
        title=title,
        description=description,
        environment_prompt_template=env_prompt,
        environment_user_message=env_user,
        conversation_prompt_template=convo_prompt,
        evaluation_prompt_template=eval_prompt,
        expects_bargaining=expects_bargaining,
        order_index=order_value,
        section_id=section_id,
    )
    if not section:
        return jsonify({"error": "Chapter not found"}), 404
    return jsonify({"section": section}), 201


@app.put("/api/admin/sections/<section_id>")
def update_admin_section(section_id: str):
    user, error = _require_user(required_role="teacher")
    if error:
        body, status = error
        return jsonify(body), status

    data = request.get_json(force=True)
    kwargs: Dict[str, object] = {}
    if "chapterId" in data:
        kwargs["chapter_id"] = (data.get("chapterId") or "").strip()
    if "title" in data:
        kwargs["title"] = (data.get("title") or "").strip()
    if "description" in data:
        kwargs["description"] = (data.get("description") or "").strip()
    if "environmentPromptTemplate" in data:
        kwargs["environment_prompt_template"] = (
            data.get("environmentPromptTemplate") or ""
        ).strip()
    if "environmentUserMessage" in data:
        kwargs["environment_user_message"] = (
            data.get("environmentUserMessage") or ""
        ).strip()
    if "conversationPromptTemplate" in data:
        kwargs["conversation_prompt_template"] = (
            data.get("conversationPromptTemplate") or ""
        ).strip()
    if "evaluationPromptTemplate" in data:
        kwargs["evaluation_prompt_template"] = (
            data.get("evaluationPromptTemplate") or ""
        ).strip()
    if "expectsBargaining" in data:
        kwargs["expects_bargaining"] = _as_bool(data.get("expectsBargaining"))
    if "orderIndex" in data:
        try:
            kwargs["order_index"] = int(data.get("orderIndex"))
        except (TypeError, ValueError):
            return jsonify({"error": "orderIndex must be an integer"}), 400

    section = database.update_section(section_id, **kwargs)
    if not section:
        return jsonify({"error": "Section not found"}), 404
    return jsonify({"section": section})


@app.delete("/api/admin/sections/<section_id>")
def delete_admin_section(section_id: str):
    user, error = _require_user(required_role="teacher")
    if error:
        body, status = error
        return jsonify(body), status

    section = database.get_section(section_id)
    if not section:
        return jsonify({"error": "Section not found"}), 404
    database.delete_section(section_id)
    return ("", 204)


if __name__ == "__main__":  # pragma: no cover
    app.run(debug=True)
