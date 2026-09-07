from __future__ import annotations

import json
from typing import Protocol

from pydantic import TypeAdapter, ValidationError

from app.modules.assessment.schemas import (
    DIAGNOSTIC_DIMENSION_ORDER,
    ChecklistAssessmentCandidate,
    DiagnosticDimensionCandidate,
    GraphRecommendationCandidate,
    LearningDiagnosticCandidate,
    RoundEvaluationCandidate,
)
from app.modules.simulation.schemas import SimulationObservationCandidate

CHECKLIST_ADAPTER = TypeAdapter(list[ChecklistAssessmentCandidate])
RECOMMENDATION_ADAPTER = TypeAdapter(list[GraphRecommendationCandidate])


class PayloadAdapter(Protocol):
    def validate_python(self, object: object) -> object: ...


def salvage_simulation_round(
    content: str, scenario_public: dict[str, object]
) -> tuple[RoundEvaluationCandidate, list[str]]:
    """Keep valid core feedback when optional model extensions remain malformed after retry."""

    payload = json.loads(content)
    if not isinstance(payload, dict):
        raise ValueError("Round evaluation output must be a JSON object")
    degraded: list[str] = []
    _trim_core_text(payload)
    _repair_list_field(payload, "checklist_results", CHECKLIST_ADAPTER, [], degraded)
    _repair_list_field(payload, "knowledge_recommendations", RECOMMENDATION_ADAPTER, [], degraded)
    _repair_list_field(payload, "strategy_recommendations", RECOMMENDATION_ADAPTER, [], degraded)
    try:
        diagnostic = LearningDiagnosticCandidate.model_validate(payload.get("learning_diagnostic"))
    except ValidationError:
        payload["learning_diagnostic"] = _fallback_diagnostic(payload).model_dump(mode="json")
        degraded.append("learning_diagnostic")
    else:
        payload["learning_diagnostic"] = diagnostic.model_dump(mode="json")
    try:
        observation = SimulationObservationCandidate.model_validate(
            payload.get("simulation_observation")
        )
    except ValidationError:
        payload["simulation_observation"] = SimulationObservationCandidate().model_dump(mode="json")
        degraded.append("simulation_observation")
    else:
        payload["simulation_observation"] = observation.model_dump(mode="json")
    candidate = RoundEvaluationCandidate.model_validate(payload)
    expected = scenario_public.get("checklist", [])
    returned = [item.item for item in candidate.checklist_results]
    if not isinstance(expected, list) or returned != expected:
        candidate.checklist_results = []
        if "checklist_results" not in degraded:
            degraded.append("checklist_results")
    return candidate, degraded


def _repair_list_field(
    payload: dict[str, object],
    key: str,
    adapter: PayloadAdapter,
    fallback: list[object],
    degraded: list[str],
) -> None:
    try:
        payload[key] = adapter.validate_python(payload.get(key, []))
    except ValidationError:
        payload[key] = fallback
        degraded.append(key)


def _trim_core_text(payload: dict[str, object]) -> None:
    for key, limit in (
        ("pros", 240),
        ("cons", 240),
        ("detailed_evaluation", 4000),
        ("next_step_suggestion", 2000),
    ):
        value = payload.get(key)
        if isinstance(value, str):
            payload[key] = value.strip()[:limit]


def _fallback_diagnostic(payload: dict[str, object]) -> LearningDiagnosticCandidate:
    raw_score = payload.get("score", 50)
    score = float(raw_score) if isinstance(raw_score, (int, float, str)) else 50.0
    score = max(0.0, min(100.0, score))
    next_step = payload.get("next_step_suggestion")
    target = (
        str(next_step).strip()[:500]
        if next_step
        else "下一轮继续观察学生能否提出有依据的互惠方案。"
    )
    return LearningDiagnosticCandidate(
        learner_stage="developing",
        challenge_level=2,
        support_level="guided_choice",
        negotiation_style="unclear",
        adaptability_summary="模型诊断扩展未通过结构校验，当前仅保留低置信度基线。",
        dimensions=[
            DiagnosticDimensionCandidate(
                dimension_key=key,
                score=score,
                judgment="诊断扩展待后续轮次复核，当前不据此推断稳定掌握。",
                evidence=[],
            )
            for key in DIAGNOSTIC_DIMENSION_ORDER
        ],
        knowledge_mastery=[],
        next_stretch_target=target,
        mediation_strategy="下一轮采用最低充分提示，并继续收集学生独立表达证据。",
        confidence=0.2,
    )
