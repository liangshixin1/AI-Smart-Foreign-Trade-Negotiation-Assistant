from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.integrations.llm.base import LLMMessage, LLMProvider, LLMProviderError, LLMRequest
from app.integrations.llm.prompt_renderer import render_prompt
from app.modules.assessment.diagnostic import (
    bind_diagnostic_evidence,
    resolve_final_learning_diagnostic,
)
from app.modules.assessment.models import CompetencyEvidence, Evaluation, EvaluationDimension
from app.modules.assessment.schemas import RubricDimensionSpec
from app.modules.assessment.structured_evaluation import request_validated_evaluation
from app.modules.auth.models import User
from app.modules.progress.models import ProgressRecord
from app.modules.training.adaptive_learning import final_diagnostic_extension
from app.modules.training.models import Attempt, Submission
from app.modules.training.presenter import present_attempt
from app.modules.training.repository import TrainingRepository
from app.modules.training.schemas import AttemptResponse
from app.modules.training.state import transition


class AssessmentService:
    def __init__(self, db: Session, provider: LLMProvider) -> None:
        self.db = db
        self.provider = provider
        self.repository = TrainingRepository(db)

    def evaluate(self, student: User, attempt: Attempt, submission: Submission) -> AttemptResponse:
        if attempt.status != "evaluating":
            raise AppError(
                code="assessment.not_evaluating",
                message="当前训练不处于待评价状态。",
                status_code=409,
            )
        unit = self.repository.unit(attempt.unit_id)
        student_messages = [item for item in attempt.messages if item.role == "student"]
        if not student_messages or attempt.scenario is None:
            raise AppError(
                code="assessment.evidence_missing",
                message="正式提交缺少学生消息或场景快照。",
                status_code=409,
            )
        messages_payload = [
            {"message_id": str(item.id), "content": item.content} for item in student_messages
        ]
        prompt = render_prompt(
            unit.evaluation_prompt.body,
            {
                "scenario_public_json": json.dumps(
                    attempt.scenario.public_payload, ensure_ascii=False
                ),
                "student_messages": json.dumps(messages_payload, ensure_ascii=False),
                "rubric_json": json.dumps(unit.rubric.dimensions, ensure_ascii=False),
            },
        )
        diagnostic_instruction, diagnostic_template = final_diagnostic_extension(
            self.repository, attempt
        )
        prompt += diagnostic_instruction
        first_message = student_messages[0]
        specs = [RubricDimensionSpec.model_validate(item) for item in unit.rubric.dimensions]
        request = LLMRequest(
            purpose="evaluation",
            prompt_template_id=unit.evaluation_prompt.prompt_key,
            prompt_version=unit.evaluation_prompt.version,
            correlation_id=str(uuid.uuid4()),
            messages=[LLMMessage(role="system", content=prompt)],
            json_output=True,
            max_output_tokens=8192,
            metadata={
                "attempt_id": str(attempt.id),
                "evidence_message_id": str(first_message.id),
                "evidence_quote": first_message.content[:180],
                "rubric_keys": json.dumps([item.key for item in specs]),
                "diagnostic_prompt_template_id": diagnostic_template.prompt_key,
                "diagnostic_prompt_version": diagnostic_template.version,
            },
        )
        try:
            response, candidate, correlation_id = request_validated_evaluation(
                self.db, self.provider, request, specs, student_messages
            )
        except (LLMProviderError, ValueError) as exc:
            category = exc.category if isinstance(exc, LLMProviderError) else "evidence_invalid"
            self.db.add(transition(attempt, "evaluation_failed", category))
            self.db.commit()
            raise AppError(
                code=f"assessment.{category}",
                message="提交内容已保留，但 AI 评价未通过校验，可以重试评价。",
                status_code=502,
                retryable=True,
            ) from exc
        spec_by_key = {item.key: item for item in specs}
        learning_diagnostic = resolve_final_learning_diagnostic(
            candidate, self.repository.round_evaluations(attempt.id)
        )
        bind_diagnostic_evidence(learning_diagnostic, student_messages)
        weighted_score = round(
            sum(
                item.score * spec_by_key[item.dimension_key].weight for item in candidate.dimensions
            ),
            2,
        )
        evaluation = Evaluation(
            attempt_id=attempt.id,
            submission_id=submission.id,
            run_no=self.repository.evaluation_count(attempt.id) + 1,
            evaluation_status="completed",
            overall_score=weighted_score,
            level=candidate.level,
            summary=candidate.summary,
            strengths=candidate.strengths,
            improvements=candidate.improvements,
            next_actions=candidate.next_actions,
            knowledge_tags=candidate.knowledge_tags,
            learning_diagnostic=learning_diagnostic.model_dump(mode="json"),
            provider=response.provider,
            model_name=response.model,
            prompt_template_id=unit.evaluation_prompt.prompt_key,
            prompt_version=unit.evaluation_prompt.version,
            raw_output_reference=f"llm-invocation:{correlation_id}",
        )
        for dimension in candidate.dimensions:
            spec = spec_by_key[dimension.dimension_key]
            stored_dimension = EvaluationDimension(
                dimension_key=dimension.dimension_key,
                label=spec.label,
                score=dimension.score,
                weight=spec.weight,
                comment=dimension.comment,
            )
            stored_dimension.evidence = [
                CompetencyEvidence(
                    message_id=evidence.message_id,
                    quote=evidence.quote,
                    reason=evidence.reason,
                )
                for evidence in dimension.evidence
            ]
            evaluation.dimensions.append(stored_dimension)
        self.db.add(evaluation)
        progress = self.repository.progress_for_unit(
            student.id, attempt.course_version_id, attempt.unit_id
        )
        now = datetime.now(UTC)
        if progress is None:
            progress = ProgressRecord(
                student_id=student.id,
                course_version_id=attempt.course_version_id,
                unit_id=attempt.unit_id,
                completed_attempt_id=attempt.id,
                latest_score=weighted_score,
                best_score=weighted_score,
                completed_at=now,
            )
            self.db.add(progress)
        else:
            progress.completed_attempt_id = attempt.id
            progress.latest_score = weighted_score
            progress.best_score = max(progress.best_score, weighted_score)
            progress.completed_at = now
        attempt.completed_at = now
        self.db.add(transition(attempt, "completed", "evaluation_validated"))
        self.db.commit()
        return present_attempt(
            attempt,
            unit,
            evaluation,
            self.repository.round_evaluations(attempt.id),
        )
