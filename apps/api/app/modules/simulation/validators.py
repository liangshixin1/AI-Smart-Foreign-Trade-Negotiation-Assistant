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
