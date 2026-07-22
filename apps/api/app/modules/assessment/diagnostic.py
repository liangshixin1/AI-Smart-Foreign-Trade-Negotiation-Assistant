from __future__ import annotations

from typing import Literal

from app.modules.assessment.models import RoundEvaluation
from app.modules.assessment.schemas import (
    DIAGNOSTIC_DIMENSION_ORDER,
    DiagnosticDimensionCandidate,
    EvaluationCandidate,
    LearningDiagnosticCandidate,
)
from app.modules.training.models import Message

LearnerStage = Literal["foundation", "developing", "competent", "advanced"]
SupportLevel = Literal["explicit_model", "guided_choice", "implicit_prompt", "independent"]


def bind_diagnostic_evidence(
    diagnostic: LearningDiagnosticCandidate, student_messages: list[Message]
) -> None:
    """Bind diagnostic evidence to real student messages and prevent fabricated quotes."""
    if not student_messages:
        raise ValueError("Learning diagnostic requires student evidence")
    content_by_id = {item.id: item.content for item in student_messages}
    fallback = student_messages[-1]
    evidence_groups = [item.evidence for item in diagnostic.dimensions]
    evidence_groups.extend(item.evidence for item in diagnostic.knowledge_mastery)
    for evidence_group in evidence_groups:
        for evidence in evidence_group:
            content = content_by_id.get(evidence.message_id)
            if content is None or evidence.quote not in content:
                evidence.message_id = fallback.id
                evidence.quote = fallback.content[:600]


def resolve_final_learning_diagnostic(
    candidate: EvaluationCandidate,
    round_evaluations: list[RoundEvaluation],
) -> LearningDiagnosticCandidate:
    """优先采用终结诊断, 缺失时聚合已经过 Schema 校验的逐轮诊断。"""
    if candidate.learning_diagnostic is not None:
        return candidate.learning_diagnostic
    rounds = [
        LearningDiagnosticCandidate.model_validate(item.learning_diagnostic)
        for item in round_evaluations
        if item.learning_diagnostic
    ]
    if rounds:
        latest = rounds[-1]
        dimensions = []
        for key in DIAGNOSTIC_DIMENSION_ORDER:
            observations = [
                dimension
                for diagnostic in rounds
                for dimension in diagnostic.dimensions
                if dimension.dimension_key == key
            ]
            last = observations[-1]
            dimensions.append(
                DiagnosticDimensionCandidate(
                    dimension_key=key,
                    score=round(sum(item.score for item in observations) / len(observations), 1),
                    judgment=last.judgment,
                    evidence=last.evidence,
                )
            )
        mastery = {
            item.knowledge_point: item
            for diagnostic in rounds
            for item in diagnostic.knowledge_mastery
        }
        return LearningDiagnosticCandidate(
            learner_stage=latest.learner_stage,
            challenge_level=latest.challenge_level,
            support_level=latest.support_level,
            negotiation_style=latest.negotiation_style,
            adaptability_summary=(
                "终结诊断字段未通过模型校验；当前画像由已校验的逐轮动态诊断聚合。"
                f"{latest.adaptability_summary}"
            ),
            dimensions=dimensions,
            knowledge_mastery=list(mastery.values())[:12],
            next_stretch_target=latest.next_stretch_target,
            mediation_strategy=latest.mediation_strategy,
            confidence=round(min(item.confidence for item in rounds) * 0.8, 2),
        )
    average = sum(item.score for item in candidate.dimensions) / len(candidate.dimensions)
    stage: LearnerStage
    support: SupportLevel
    if average < 60:
        stage, challenge, support = "foundation", 1, "explicit_model"
    elif average < 75:
        stage, challenge, support = "developing", 2, "guided_choice"
    elif average < 90:
        stage, challenge, support = "competent", 3, "implicit_prompt"
    else:
        stage, challenge, support = "advanced", 4, "independent"
    return LearningDiagnosticCandidate(
        learner_stage=stage,
        challenge_level=challenge,
        support_level=support,
        negotiation_style="unclear",
        adaptability_summary="终结诊断字段未通过模型校验，暂无足够逐轮数据，需教师复核。",
        dimensions=[
            DiagnosticDimensionCandidate(
                dimension_key=key,
                score=round(average, 1),
                judgment="暂以正式评价维度均值形成低置信度基线，需后续训练继续观察。",
                evidence=[],
            )
            for key in DIAGNOSTIC_DIMENSION_ORDER
        ],
        knowledge_mastery=[],
        next_stretch_target=candidate.next_actions[0],
        mediation_strategy="下一次训练先采用引导选择，并根据学生独立表现逐步撤除提示。",
        confidence=0.2,
    )
