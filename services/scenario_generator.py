"""场景装配服务（单一固定案例 · 无难度档位 · 无随机自动生成）。

- 关卡场景为「固定场景」：``start_level`` 直接加载存储的 JSON，不再每次调用 LLM。
- ``regenerate_fixed_scenario`` 供教师按案例简报用 DEEPSEEK_GENERATOR_KEY 重新生成并固化场景。
- 学生可见 payload 绝不包含隐藏底牌（成本、价格底线、BATNA、AI 行为规则）。
"""

from __future__ import annotations

import json
from typing import Dict, List, Optional

from levels import (
    CHAPTERS,
    LEVEL_GENERATION_BRIEFS,
    SCENARIO_GENERATION_SYSTEM_PROMPT,
    STATIC_SCENARIO_MARKER,
)
from models.scenario import Scenario
from services.llm_service import complete_chat
from utils.validators import MissingKeyError, extract_json_block, require_key

# 单一标准模式：保留一个中性常量供存储/展示兼容（难度档位已废弃）。
DEFAULT_DIFFICULTY = "standard"
STANDARD_DIFFICULTY_LABEL = "标准 · 平衡博弈"

ENGLISH_ENFORCEMENT_HINT = (
    "All assistant-facing outputs, including conversation replies, must be written entirely in English."
    " Avoid inserting Chinese characters unless the student explicitly provides them or requests bilingual content."
)


# 学生可见 payload 中绝不下发的敏感字段（隐藏底牌只存在于服务端 actor 提示词）。
_HIDDEN_PRODUCT_KEYS = {"ai_bottom_line", "cost", "cost_structure", "bottom_line"}

SCENARIO_BASE_KEYS = {
    "scenario_title",
    "scenario_summary",
    "student_task",
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
    "mode",
    "difficulty",
    "difficulty_key",
    "difficulty_label",
    "difficulty_description",
}

SCENARIO_FIELD_LABELS: Dict[str, str] = {
    "document_snapshot": "单据快照",
    "document_type": "文件类别",
    "issues_to_verify": "待核查问题",
    "compliance_red_flags": "合规风险",
    "payment_terms_matrix": "付款条款矩阵",
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
        lines = []
        for sub_key, sub_value in value.items():
            sub_lines = _value_to_lines(sub_value)
            if not sub_lines:
                continue
            label = _format_field_label(str(sub_key))
            lines.append(f"{label}: {'; '.join(sub_lines)}")
        if lines:
            return lines
        serialized = json.dumps(value, ensure_ascii=False)
        return [serialized] if serialized and serialized != "{}" else []
    text = str(value).strip()
    return [text] if text else []


def _prepare_custom_fields(raw: Dict[str, object]) -> List[Dict[str, object]]:
    extra_fields: Dict[str, object] = {}
    for key, value in raw.items():
        if not isinstance(key, str) or key in SCENARIO_BASE_KEYS or value is None:
            continue
        extra_fields[key] = value

    custom_variables = raw.get("custom_variables") or raw.get("customVariables")
    if isinstance(custom_variables, dict):
        for key, value in custom_variables.items():
            if isinstance(key, str) and key not in extra_fields:
                extra_fields[key] = value

    prepared: List[Dict[str, object]] = []
    for key, value in extra_fields.items():
        items = _value_to_lines(value)
        if not items:
            continue
        prepared.append({"key": key, "label": _format_field_label(key), "items": items})
    return prepared


def _strip_hidden_fields(scenario: Dict[str, object]) -> None:
    """就地移除任何可能泄露 AI 隐藏底牌的字段（防御性）。"""
    scenario.pop("ai_rules", None)
    product = scenario.get("product")
    if isinstance(product, dict):
        price = product.get("price_expectation")
        if isinstance(price, dict):
            for key in list(price.keys()):
                if key in _HIDDEN_PRODUCT_KEYS:
                    price.pop(key, None)
            if not price:
                product.pop("price_expectation", None)


def inject_difficulty_metadata(item: Dict[str, object]) -> None:
    """单一标准模式：保证条目带有中性的难度标记，供旧前端/后台兼容。"""
    if not isinstance(item, dict):
        return
    item["difficulty"] = DEFAULT_DIFFICULTY
    item["difficultyLabel"] = STANDARD_DIFFICULTY_LABEL
    item.setdefault("difficultyDescription", "")


def ensure_level_hierarchy(include_prompts: bool = False) -> List[Dict[str, object]]:
    """加载关卡配置，必要时自动回填默认数据。"""
    from database import list_level_hierarchy, seed_default_levels  # 局部导入避免循环引用

    chapters = list_level_hierarchy(include_prompts=include_prompts)
    if chapters:
        return chapters
    seed_default_levels(CHAPTERS)
    return list_level_hierarchy(include_prompts=include_prompts)


def prepare_scenario_payload(raw: Dict[str, object]) -> Dict[str, object]:
    """构造学生可见的场景 payload（绝不含隐藏底牌、难度档位）。"""
    scenario_obj = Scenario.from_dict(raw)
    normalized = scenario_obj.to_dict()
    _strip_hidden_fields(normalized)

    payload = {
        "title": normalized.get("scenario_title", ""),
        "summary": normalized.get("scenario_summary", ""),
        "studentTask": normalized.get("student_task", ""),
        "studentRole": normalized.get("student_role", ""),
        "studentCompany": normalized.get("student_company", {}) or {},
        "aiRole": normalized.get("ai_role", ""),
        "aiCompany": normalized.get("ai_company", {}) or {},
        "product": normalized.get("product", {}) or {},
        "marketLandscape": normalized.get("market_landscape", ""),
        "timeline": normalized.get("timeline", ""),
        "logistics": normalized.get("logistics", ""),
        "risks": normalized.get("risks", []) or [],
        "negotiationTargets": normalized.get("negotiation_targets", []) or [],
        "communicationTone": normalized.get("communication_tone", ""),
        "checklist": normalized.get("checklist", []) or [],
        "knowledgePoints": normalized.get("knowledge_points", []) or [],
        "customFields": _prepare_custom_fields(normalized),
    }

    document_text = normalized.get("document_text") or normalized.get("documentText") or ""
    if document_text:
        payload["documentText"] = document_text

    review_hints = {
        "documentType": normalized.get("document_type") or normalized.get("documentType") or "",
        "issuesToVerify": normalized.get("issues_to_verify") or normalized.get("issuesToVerify") or [],
        "complianceRedFlags": normalized.get("compliance_red_flags") or normalized.get("complianceRedFlags") or [],
        "paymentTermsMatrix": normalized.get("payment_terms_matrix") or normalized.get("paymentTermsMatrix") or "",
        "documentSnapshot": normalized.get("document_snapshot") or normalized.get("documentSnapshot") or "",
    }
    if any(review_hints.values()):
        payload["reviewHints"] = review_hints

    return payload


def render_prompts_from_section(section: Dict[str, object], scenario: Dict[str, object]):
    """从关卡模板取出 actor / 评估提示词。

    actor 提示词已完整撰写（含全局人格与本关脚本），仅追加英文输出要求；
    评估提示词追加结构化输出契约（评分逻辑保持不变）。
    """
    conversation_prompt = str(section.get("conversation_prompt_template") or "").strip()
    if ENGLISH_ENFORCEMENT_HINT not in conversation_prompt:
        conversation_prompt = f"{conversation_prompt}\n\n[Language Requirement]\n{ENGLISH_ENFORCEMENT_HINT}"

    evaluation_prompt = str(section.get("evaluation_prompt_template") or "").strip()
    evaluation_prompt = (
        f"{evaluation_prompt}\n\n"
        "[结构化输出要求]\n"
        "- JSON 必须包含 highlights（1-2 条）、risks（1-3 条）、suggestions（2-4 条）三个数组字段，"
        "每项均为对象，包含 title 与 detail，句子要短且可读。\n"
        "- 继续返回 score、score_label、commentary、knowledge_points（如无本地匹配可为空数组）。\n"
        "- knowledge_points 数组元素为对象：{{\"label\": 知识点名称, \"category\": \"skill\"|\"knowledge\"|\"term\", \"summary\": 简要说明}}，"
        "优先映射本地知识点；无法映射时保持字段为空数组。\n"
        "- 避免长篇大论，只给精简可执行的信息。"
    )
    return conversation_prompt, evaluation_prompt


def assemble_scenario_from_blueprint(blueprint: Dict[str, object]) -> Dict[str, object]:
    """将教师手工/导入的蓝图规整为标准场景结构（无难度档位）。"""
    scenario_obj = Scenario.from_dict(blueprint)
    scenario = scenario_obj.to_dict()
    _strip_hidden_fields(scenario)
    return scenario


def generate_scenario_for_section(section: Dict[str, object]) -> Dict[str, object]:
    """加载关卡的固定场景（统一走静态 JSON 路径，不再随机生成）。"""
    marker = str(section.get("environment_prompt_template") or "").strip()
    raw_payload = section.get("environment_user_message")
    if marker != STATIC_SCENARIO_MARKER or not isinstance(raw_payload, str) or not raw_payload.strip():
        raise MissingKeyError("该关卡尚未配置固定场景（fixed scenario）")
    try:
        scenario_raw = json.loads(raw_payload)
    except json.JSONDecodeError as exc:
        raise MissingKeyError(f"固定场景 JSON 解析失败：{exc}") from exc
    scenario_obj = Scenario.from_dict(scenario_raw)
    scenario_dict = scenario_obj.to_dict()
    _strip_hidden_fields(scenario_dict)
    return scenario_dict


def regenerate_fixed_scenario(section: Dict[str, object]) -> Dict[str, object]:
    """教师操作：按本关「图景/案例简报」用 DEEPSEEK_GENERATOR_KEY 重新生成固定场景。"""
    generator_key = require_key("DEEPSEEK_GENERATOR_KEY")
    section_id = str(section.get("id") or "")
    brief = LEVEL_GENERATION_BRIEFS.get(section_id)
    if not brief:
        raise MissingKeyError(f"关卡 {section_id} 缺少案例简报，无法重新生成")

    messages = [
        {"role": "system", "content": SCENARIO_GENERATION_SYSTEM_PROMPT},
        {"role": "user", "content": f"{brief}\n\n请严格输出 JSON，键名采用 snake_case，且绝不包含卖方隐藏底牌。"},
    ]
    raw_response = complete_chat(generator_key, messages, temperature=0.5)
    scenario_raw = extract_json_block(raw_response)
    if not isinstance(scenario_raw, dict) or not scenario_raw:
        raise MissingKeyError("场景生成失败：模型未返回有效 JSON")
    scenario_obj = Scenario.from_dict(scenario_raw)
    scenario_dict = scenario_obj.to_dict()
    _strip_hidden_fields(scenario_dict)
    return scenario_dict
