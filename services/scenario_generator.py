"""场景生成与难度配置服务。"""

from __future__ import annotations

import copy
import json
from typing import Dict, List, Optional, Tuple

from levels import CHAPTERS, flatten_scenario_for_template
from models.scenario import Scenario
from utils.normalizers import normalize_company, normalize_product, normalize_text_list
from utils.validators import MissingKeyError, extract_json_block, first_non_empty, require_key

from services.llm_service import complete_chat

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


SCENARIO_BASE_KEYS = {
    "scenario_title",
    "scenario_summary",
    "student_role",
    "student_company",
    "ai_role",
    "ai_company",
    "ai_rules",
    "product",
    "market_landscape",
    "timeline",
    "logistics",
    "risks",
    "negotiation_targets",
    "communication_tone",
    "checklist",
    "knowledge_points",
    "opening_message",
    "difficulty",
    "difficulty_key",
    "difficulty_label",
    "difficulty_description",
}

SCENARIO_FIELD_LABELS: Dict[str, str] = {
    "contact_background": "联系背景",
    "inquiry_focus": "询盘焦点",
    "inquiry_information_gaps": "信息缺口",
    "pricing_positioning": "定价定位",
    "concession_levers": "可协商让步",
    "value_add_options": "增值方案",
    "counter_offer_background": "上一轮报价背景",
    "negotiation_pressures": "谈判压力",
    "document_snapshot": "单据快照",
    "compliance_red_flags": "合规风险",
    "contract_risk_scope": "合同风险范围",
    "payment_terms_matrix": "付款条款矩阵",
    "cash_flow_constraints": "现金流约束",
    "payment_risk_alerts": "付款风险提示",
    "receivables_status": "应收账款状态",
    "collection_history": "催收历史",
    "escalation_options": "升级措施",
    "packaging_snapshot": "包装方案",
    "shipping_mark_gaps": "唛头缺失",
    "logistics_constraints": "物流限制",
    "transport_plan": "运输方案",
    "incoterms_focus": "贸易术语关注点",
    "cost_structure_hint": "成本结构提示",
    "operation_timeline": "操作时间线",
    "stakeholder_matrix": "干系人矩阵",
    "contingency_preplans": "应急预案",
    "documentation_control": "单证管控",
    "custom_variables": "特色变量",
    "customVariables": "特色变量",
}


def _format_field_label(key: str) -> str:
    if not isinstance(key, str) or not key:
        return "附加信息"
    return SCENARIO_FIELD_LABELS.get(key, key.replace("_", " ").title())


def _value_to_lines(value: object) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        stripped = value.strip()
        return [stripped] if stripped else []
    if isinstance(value, bool):
        return ["Yes" if value else "No"]
    if isinstance(value, (int, float)):
        if isinstance(value, float) and value.is_integer():
            value = int(value)
        return [str(value)]
    if isinstance(value, list):
        lines: List[str] = []
        for item in value:
            lines.extend(_value_to_lines(item))
        return lines
    if isinstance(value, dict):
        lines: List[str] = []
        for sub_key, sub_value in value.items():
            sub_lines = _value_to_lines(sub_value)
            if not sub_lines:
                continue
            label = _format_field_label(str(sub_key))
            if len(sub_lines) == 1:
                lines.append(f"{label}: {sub_lines[0]}")
            else:
                joined = "; ".join(sub_lines)
                lines.append(f"{label}: {joined}")
        if lines:
            return lines
        serialized = json.dumps(value, ensure_ascii=False)
        return [serialized] if serialized and serialized != "{}" else []
    text = str(value).strip()
    return [text] if text else []


def _prepare_custom_fields(raw: Dict[str, object]) -> List[Dict[str, object]]:
    extra_fields: Dict[str, object] = {}
    for key, value in raw.items():
        if not isinstance(key, str):
            continue
        if key in SCENARIO_BASE_KEYS:
            continue
        if value is None:
            continue
        extra_fields[key] = value

    custom_variables = raw.get("custom_variables") or raw.get("customVariables")
    if isinstance(custom_variables, dict):
        for key, value in custom_variables.items():
            if not isinstance(key, str):
                continue
            if key in extra_fields:
                continue
            extra_fields[key] = value

    prepared: List[Dict[str, object]] = []
    for key, value in extra_fields.items():
        label_override = None
        items_source = value
        if isinstance(value, dict) and ("value" in value or "items" in value):
            if isinstance(value.get("label"), str) and value.get("label"):
                label_override = value["label"]
            items_source = value.get("items", value.get("value"))
        items = _value_to_lines(items_source)
        if not items:
            continue
        prepared.append(
            {
                "key": key,
                "label": label_override or _format_field_label(key),
                "items": items,
            }
        )
    return prepared


class TemplateContext(dict):
    def __missing__(self, key: str) -> str:  # pragma: no cover - defensive fallback
        return "{" + key + "}"


def format_template(template: object, context: Dict[str, str]) -> str:
    if not isinstance(template, str):
        return ""
    mapping = context if isinstance(context, TemplateContext) else TemplateContext(context)
    try:
        return template.format_map(mapping)
    except ValueError:  # pragma: no cover - safeguard against malformed templates
        return template


def get_difficulty_profile(key: Optional[str]) -> Dict[str, str]:
    normalized = str(key or DEFAULT_DIFFICULTY)
    return DIFFICULTY_PROFILES.get(normalized, DIFFICULTY_PROFILES[DEFAULT_DIFFICULTY])


def apply_difficulty_profile(scenario: Dict[str, object], difficulty_key: str) -> Tuple[Dict[str, object], Dict[str, str]]:
    profile = get_difficulty_profile(difficulty_key)
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


def inject_difficulty_metadata(item: Dict[str, object]) -> None:
    difficulty_key = str(item.get("difficulty") or DEFAULT_DIFFICULTY)
    profile = get_difficulty_profile(difficulty_key)
    item["difficulty"] = difficulty_key
    item["difficultyLabel"] = profile["label"]
    if "difficultyDescription" not in item or not item["difficultyDescription"]:
        item["difficultyDescription"] = profile["description"]


def ensure_level_hierarchy(include_prompts: bool = False) -> List[Dict[str, object]]:
    """加载关卡配置，必要时自动回填默认数据。"""

    from database import list_level_hierarchy, seed_default_levels  # 局部导入避免循环引用

    chapters = list_level_hierarchy(include_prompts=include_prompts)
    if chapters:
        return chapters

    seed_default_levels(CHAPTERS)
    return list_level_hierarchy(include_prompts=include_prompts)


def prepare_scenario_payload(raw: Dict[str, object]) -> Dict[str, object]:
    difficulty_key = raw.get("difficulty_key") or raw.get("difficulty") or DEFAULT_DIFFICULTY
    profile = get_difficulty_profile(difficulty_key)
    return {
        "title": raw.get("scenario_title", ""),
        "summary": raw.get("scenario_summary", ""),
        "studentRole": raw.get("student_role", ""),
        "studentCompany": raw.get("student_company", {}) or {},
        "aiRole": raw.get("ai_role", ""),
        "aiCompany": raw.get("ai_company", {}) or {},
        "aiRules": raw.get("ai_rules", []) or [],
        "product": raw.get("product", {}) or {},
        "marketLandscape": raw.get("market_landscape", ""),
        "timeline": raw.get("timeline", ""),
        "logistics": raw.get("logistics", ""),
        "risks": raw.get("risks", []) or [],
        "negotiationTargets": raw.get("negotiation_targets", []) or [],
        "communicationTone": raw.get("communication_tone", ""),
        "checklist": raw.get("checklist", []) or [],
        "knowledgePoints": raw.get("knowledge_points", []) or [],
        "customFields": _prepare_custom_fields(raw),
        "difficulty": difficulty_key,
        "difficultyLabel": raw.get("difficulty_label") or profile["label"],
        "difficultyDescription": raw.get("difficulty_description")
        or profile["description"],
    }


def infer_student_trade_role(section: Dict[str, object]) -> str:
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


def render_prompts_from_section(
    section: Dict[str, object],
    scenario: Dict[str, object],
    difficulty_key: str,
    difficulty_profile: Dict[str, str],
) -> Tuple[str, str]:
    flat_context = TemplateContext(flatten_scenario_for_template(scenario))
    if not flat_context.get("knowledge_points_hint"):
        flat_context["knowledge_points_hint"] = (
            "報盤結構, 議價策略, 跨文化溝通"
            if section.get("expects_bargaining")
            else "英文商務函電寫作, 信息提取, 跨文化表達"
        )

    conversation_prompt = format_template(
        section.get("conversation_prompt_template"), flat_context
    )
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

    evaluation_prompt = format_template(
        section.get("evaluation_prompt_template"), flat_context
    )
    return conversation_prompt, evaluation_prompt


def build_custom_assignment_prompts(
    scenario: Dict[str, object], difficulty_profile: Dict[str, str]
) -> Tuple[str, str]:
    flat = flatten_scenario_for_template(scenario)
    ai_rules = scenario.get("ai_rules", []) or []
    rules_block = "\n".join(
        f"- {rule}" for rule in ai_rules if isinstance(rule, str) and rule.strip()
    )
    if not rules_block:
        rules_block = "- Maintain consistency with the scenario details and protect your company's interests."
    tone = flat.get("communication_tone") or "Professional and courteous business English"
    conversation_prompt = f"""
You are {flat.get('ai_role') or 'the supplier representative'} from {flat.get('ai_company_name') or 'the partner company'}.
The student is {flat.get('student_role') or 'a Chinese trade professional'} representing {flat.get('student_company_name') or 'their company'}.

Scenario briefing:
- Product focus: {flat.get('product_name') or 'N/A'} ({flat.get('product_specs') or 'specifications TBD'}).
- Quantity / capacity: {flat.get('product_quantity') or 'Discuss with the student'}.
- Market situation: {flat.get('market_landscape') or 'Use industry-relevant details'}.
- Logistics & timeline: {flat.get('logistics') or 'Negotiate feasible terms'}.
- Negotiation targets: {scenario.get('negotiation_targets') or []}.

Ground rules:
{rules_block}

Conduct the negotiation entirely in English. Adopt a tone that is {tone}. Guide the student to articulate clear proposals, ask clarifying questions, and explore win-win trade-offs. Reference real-world trade considerations whenever helpful.
""".strip()
    suffix = difficulty_profile.get("prompt_suffix")
    if suffix:
        conversation_prompt = f"{conversation_prompt}\n\n[Difficulty]\n{suffix}"
    if ENGLISH_ENFORCEMENT_HINT not in conversation_prompt:
        conversation_prompt = f"{conversation_prompt}\n\n[Language Requirement]\n{ENGLISH_ENFORCEMENT_HINT}"
    if ROLE_ENFORCEMENT_HINT not in conversation_prompt:
        conversation_prompt = f"{conversation_prompt}\n\n[Role Reminder]\n{ROLE_ENFORCEMENT_HINT}"

    scenario_obj = Scenario.from_dict(scenario)
    knowledge_hint = scenario_obj.knowledge_points_hint()
    evaluation_prompt = f"""
You are an experienced trade negotiation coach. Review the scenario summary and the dialogue transcript to evaluate the student's performance. Respond in JSON with:
{{
  "score": integer 0-100,
  "score_label": "Short label summarizing performance",
  "commentary": "Detailed Chinese feedback highlighting strengths and improvements",
  "action_items": ["3 concrete next steps"],
  "knowledge_points": ["Key knowledge points, prefer: {knowledge_hint}"],
  "bargaining_win_rate": "0-100 if bargaining outcome is discussed, else null"
}}

Focus on language quality, clarity of negotiation strategy, data support for proposals, and etiquette.
""".strip()
    return conversation_prompt, evaluation_prompt


def assemble_scenario_from_blueprint(
    blueprint: Dict[str, object], difficulty_key: str
) -> Tuple[Dict[str, object], Dict[str, str]]:
    scenario = {
        "scenario_title": first_non_empty(
            blueprint, ["scenarioTitle", "title", "name"]
        ),
        "scenario_summary": first_non_empty(
            blueprint, ["scenarioSummary", "summary", "description"]
        ),
        "student_role": first_non_empty(
            blueprint, ["studentRole", "student_role", "student"]
        ),
        "student_company": normalize_company(
            blueprint.get("studentCompany") or blueprint.get("student_company")
        ),
        "ai_role": first_non_empty(
            blueprint, ["aiRole", "assistantRole", "ai_role"]
        ),
        "ai_company": normalize_company(
            blueprint.get("aiCompany") or blueprint.get("ai_company")
        ),
        "ai_rules": normalize_text_list(
            blueprint.get("aiRules") or blueprint.get("ai_rules")
        ),
        "product": normalize_product(
            blueprint.get("product") or blueprint.get("productInfo")
        ),
        "market_landscape": first_non_empty(
            blueprint, ["marketLandscape", "market_landscape", "market"]
        ),
        "timeline": first_non_empty(
            blueprint, ["timeline", "delivery", "schedule"]
        ),
        "logistics": first_non_empty(
            blueprint, ["logistics", "tradeTerms", "shipping"]
        ),
        "risks": normalize_text_list(blueprint.get("risks")),
        "negotiation_targets": normalize_text_list(
            blueprint.get("negotiationTargets") or blueprint.get("negotiation_targets")
        ),
        "communication_tone": first_non_empty(
            blueprint, ["communicationTone", "communication_tone", "tone"]
        ),
        "checklist": normalize_text_list(
            blueprint.get("checklist") or blueprint.get("taskChecklist")
        ),
        "knowledge_points": normalize_text_list(
            blueprint.get("knowledgePoints") or blueprint.get("knowledge_points")
        ),
        "opening_message": first_non_empty(
            blueprint, ["openingMessage", "opening_message", "opening"]
        ),
    }
    scenario, profile = apply_difficulty_profile(scenario, difficulty_key)
    return scenario, profile


def generate_scenario_for_section(section: Dict[str, object], difficulty_key: str) -> Tuple[Dict[str, object], Dict[str, str]]:
    generator_key = require_key("DEEPSEEK_GENERATOR_KEY")
    system_prompt = section.get("environment_prompt_template")
    user_prompt = section.get("environment_user_message")
    if not system_prompt or not user_prompt:
        raise MissingKeyError("Section is missing prompt templates")

    messages = [
        {"role": "system", "content": str(system_prompt)},
        {
            "role": "user",
            "content": "\n".join(
                [
                    str(user_prompt),
                    "\n".join(
                        [
                            "[请遵循以下附加要求]",
                            SCENARIO_DIVERSITY_HINT,
                            ROLE_ENFORCEMENT_HINT,
                            "请严格输出 JSON，键名采用 snake_case。",
                        ]
                    ),
                ]
            ),
        },
    ]
    raw_response = complete_chat(generator_key, messages, temperature=0.8)
    scenario = extract_json_block(raw_response)
    trade_role = infer_student_trade_role(section)
    scenario_obj = Scenario.from_dict(scenario)
    scenario_obj.ensure_chinese_role(trade_role)
    scenario_dict = scenario_obj.to_dict()
    scenario_dict, profile = apply_difficulty_profile(scenario_dict, difficulty_key)
    return scenario_dict, profile
