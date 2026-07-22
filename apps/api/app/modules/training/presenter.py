from __future__ import annotations

from app.modules.assessment.models import Evaluation, RoundEvaluation
from app.modules.curriculum.models import TrainingUnit
from app.modules.training.models import Attempt
from app.modules.training.repository import TrainingRepository
from app.modules.training.schemas import (
    AttemptResponse,
    ChecklistAssessmentResponse,
    DimensionResponse,
    EvaluationResponse,
    EvidenceResponse,
    GraphRecommendationResponse,
    MessageResponse,
    RoundEvaluationResponse,
    ScenarioPublic,
)


def present_attempt(
    attempt: Attempt,
    unit: TrainingUnit,
    evaluation: Evaluation | None,
    round_evaluations: list[RoundEvaluation] | None = None,
    repository: TrainingRepository | None = None,
) -> AttemptResponse:
    draft = repository.draft(attempt.id) if repository else None
    evaluation_response = None
    if evaluation is not None:
        evaluation_response = EvaluationResponse(
            id=evaluation.id,
            overall_score=evaluation.overall_score,
            level=evaluation.level,
            summary=evaluation.summary,
            strengths=evaluation.strengths,
            improvements=evaluation.improvements,
            next_actions=evaluation.next_actions,
            knowledge_tags=evaluation.knowledge_tags,
            model_name=evaluation.model_name,
            prompt_version=evaluation.prompt_version,
            evaluation_status=evaluation.evaluation_status,
            created_at=evaluation.created_at,
            dimensions=[
                DimensionResponse(
                    dimension_key=dimension.dimension_key,
                    label=dimension.label,
                    score=dimension.score,
                    weight=dimension.weight,
                    comment=dimension.comment,
                    evidence=[
                        EvidenceResponse(
                            message_id=evidence.message_id,
                            quote=evidence.quote,
                            reason=evidence.reason,
                        )
                        for evidence in dimension.evidence
                    ],
                )
                for dimension in evaluation.dimensions
            ],
        )
    return AttemptResponse(
        id=attempt.id,
        unit_id=unit.unit_key,
        unit_title=unit.title,
        training_mode=unit.training_mode,
        status=attempt.status,
        difficulty=attempt.difficulty,
        scenario=(
            ScenarioPublic.model_validate(attempt.scenario.public_payload)
            if attempt.scenario is not None
            else None
        ),
        messages=[
            MessageResponse(
                id=message.id,
                sequence_no=message.sequence_no,
                role=message.role,
                content=message.content,
                status=message.status,
                created_at=message.created_at,
            )
            for message in attempt.messages
        ],
        round_evaluations=[
            RoundEvaluationResponse(
                id=item.id,
                student_message_id=item.student_message_id,
                assistant_message_id=item.assistant_message_id,
                status=item.status,
                score=item.score,
                pros=item.pros,
                cons=item.cons,
                detailed_evaluation=item.detailed_evaluation,
                next_step_suggestion=item.next_step_suggestion,
                checklist_results=[
                    ChecklistAssessmentResponse.model_validate(result)
                    for result in item.checklist_results
                ],
                recommendations=[
                    GraphRecommendationResponse.model_validate(value)
                    for value in item.recommendations
                ],
                model_name=item.model_name,
                prompt_version=item.prompt_version,
                created_at=item.created_at,
            )
            for item in round_evaluations or []
        ],
        evaluation=evaluation_response,
        draft_content=draft.content if draft else "",
        retry_of_attempt_id=attempt.retry_of_attempt_id,
        created_at=attempt.created_at,
        updated_at=attempt.updated_at,
    )
