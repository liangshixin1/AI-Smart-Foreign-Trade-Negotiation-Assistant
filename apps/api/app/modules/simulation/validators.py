# [导读] 所属业务: 带角色演出和态势的谈判仿真。
# [导读] 业务名词: Simulation 是逐段台词演出的训练体验; Presentation 是已保存的演出; State 是按
# [导读] 证据计算的谈判态势。
# [导读] 用途与原因: 验证仿真台词长度、格式、产品事实和私有信息边界; 模型结构正确也可能违反场景
# [导读] 约束, 必须继续做语义检查。
# [导读] 结构: english_word_count、canonical_text、validate_turn、validate_opening、
# [导读] parse_turn_outpu
# [导读] t。
# [导读] 提醒: 台词、逐轮评价与态势是不同结果; 分析失败不应丢掉已保存台词, 重试需尊重训练绑定的
# [导读] 配置和规则版本。
from __future__ import annotations

import json
import re

from app.integrations.llm.base import LLMProviderError
from app.modules.simulation.schemas import SimulationBeat, SimulationTurnCandidate

WORD_PATTERN = re.compile(r"[A-Za-z0-9]+(?:[’'\-][A-Za-z0-9]+)*|(?:USD|CIF|L/C)", re.IGNORECASE)
EMAIL_FORMAT_PATTERN = re.compile(
    r"(^|\n)\s*(from|to|subject)\s*:|yours\s+(sincerely|faithfully)|dear\s+(mr|ms|sir|madam)\b",
    re.IGNORECASE,
)
PRIVATE_LEAK_PATTERN = re.compile(
    r"\b(our|seller'?s|nova\s?tech'?s)\s+(manufacturing\s+)?cost\b|"
    r"\b(bottom|floor|minimum)\s+(line|price)\b|\bBATNA\b",
    re.IGNORECASE,
)
PRODUCT_CODE_PATTERN = re.compile(r"\bNT-[A-Z0-9-]+\b", re.IGNORECASE)
UNSAFE_ACCEPTANCE_PATTERN = re.compile(
    r"\b(?:accept|agree(?:d)?|confirm(?:ed)?|offer)\b.{0,36}\bUSD\s*(\d+(?:\.\d+)?)",
    re.IGNORECASE,
)
EXPRESSIONS = {"neutral", "thinking", "pleased", "frustrated", "confused"}
ACTIONS = {"none", "nod", "head_tilt"}


def english_word_count(text: str) -> int:
    return len(WORD_PATTERN.findall(text))


def canonical_text(beats: list[SimulationBeat]) -> str:
    return "\n".join(beat.text.strip() for beat in beats)


# [导读] 除结构外再限制台词长度、格式、商品事实和私有信息, 防止模型输出破坏场景边界。
def validate_turn(candidate: SimulationTurnCandidate) -> str:
    total = 0
    for beat in candidate.beats:
        count = english_word_count(beat.text)
        if count < 1 or count > 24:
            raise ValueError("Each simulation beat must contain 1-24 English words")
        if EMAIL_FORMAT_PATTERN.search(beat.text):
            raise ValueError("Simulation dialogue must not use email headers or signatures")
        total += count
    if total > 60:
        raise ValueError("Simulation dialogue must not exceed 60 English words")
    canonical = canonical_text(candidate.beats)
    if PRIVATE_LEAK_PATTERN.search(canonical):
        raise ValueError("Simulation dialogue may not expose private commercial facts")
    if any(code.upper() != "NT-IM250" for code in PRODUCT_CODE_PATTERN.findall(canonical)):
        raise ValueError("Simulation dialogue changed the configured product")
    if any(float(amount) < 283 for amount in UNSAFE_ACCEPTANCE_PATTERN.findall(canonical)):
        raise ValueError("Simulation dialogue accepted a price below this unit's boundary")
    return canonical


def validate_opening(candidate: SimulationTurnCandidate) -> str:
    return validate_turn(candidate)


# [导读] 校验仿真台词 JSON, 并兼容本函数明确支持的响应形状; 不能把任意文本直接作为已验证演出。
def parse_turn_output(content: str) -> SimulationTurnCandidate:
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise LLMProviderError(
            "structured_output_invalid",
            "大模型输出未通过结构化数据校验。",
            retryable=True,
        ) from exc
    if isinstance(payload, dict) and isinstance(payload.get("beats"), list):
        for beat in payload["beats"]:
            if not isinstance(beat, dict):
                continue
            if beat.get("expression") not in EXPRESSIONS:
                beat["expression"] = "neutral"
            if beat.get("action") not in ACTIONS:
                beat["action"] = "none"
    try:
        return SimulationTurnCandidate.model_validate(payload)
    except ValueError as exc:
        raise LLMProviderError(
            "structured_output_invalid",
            "大模型输出未通过结构化数据校验。",
            retryable=True,
        ) from exc
