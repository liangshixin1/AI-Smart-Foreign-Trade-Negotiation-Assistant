# [导读] 所属业务: 一次训练从创建到提交的生命周期。
# [导读] 业务名词: Attempt 是一次训练记录; Scenario 是该次训练的场景; Submission 是正式提交时冻
# [导读] 结的内容快照。
# [导读] 用途与原因: 把训练模型、公开场景、消息和评价转换成 API 响应; 明确选择公开字段, 避免场景
# [导读] 私有底牌泄漏。
# [导读] 结构: present_attempt。
# [导读] 提醒: 重练创建新 Attempt, 重试评价沿用原提交; 场景 private 部分是对手底牌, 不得放入学生
# [导读] 响应。
from __future__ import annotations

from typing import Literal, cast

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
    simulation_summary = None
    if repository is not None and attempt.experience_mode == "simulation":
        from app.modules.simulation.repository import SimulationRepository
        from app.modules.simulation.schemas import SimulationSummaryResponse

        session = SimulationRepository(repository.db).session(attempt.id)
        if session is not None:
            simulation_summary = SimulationSummaryResponse(
                profile_id=session.profile_id,
                profile_version=session.profile_version,
                asset_pack_version=session.asset_pack_version,
                analysis_status=session.analysis_status,
                state_revision=session.latest_state_revision,
            )
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
                            source_type=evidence.source_type,
                            source_id=evidence.source_id,
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
        workspace_kind=attempt.content_bindings.get("workspace_kind"),
        id=attempt.id,
        unit_id=unit.unit_key,
        unit_title=unit.title,
        training_mode=unit.training_mode,
        experience_mode=cast(Literal["chat", "simulation"], attempt.experience_mode),
        conversation_revision=attempt.conversation_revision,
        simulation_summary=simulation_summary,
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
