from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.modules.assessment.models import Evaluation, EvaluationDimension, RoundEvaluation
from app.modules.classrooms.models import Classroom, Enrollment
from app.modules.curriculum.models import Chapter, CourseVersion, PromptTemplate, TrainingUnit
from app.modules.progress.models import ProgressRecord
from app.modules.training.models import Attempt, AttemptDraft, AttemptRetry, Message, Submission


class TrainingRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def unit_for_student(self, student_id: uuid.UUID, unit_key: str) -> TrainingUnit | None:
        statement = (
            select(TrainingUnit)
            .join(Chapter, TrainingUnit.chapter_id == Chapter.id)
            .join(CourseVersion, Chapter.course_version_id == CourseVersion.id)
            .join(Classroom, Classroom.course_version_id == CourseVersion.id)
            .join(Enrollment, Enrollment.classroom_id == Classroom.id)
            .where(
                Enrollment.student_id == student_id,
                Enrollment.status == "active",
                Classroom.status == "active",
                TrainingUnit.unit_key == unit_key,
                TrainingUnit.status == "published",
            )
            .options(
                selectinload(TrainingUnit.chapter),
                selectinload(TrainingUnit.template),
                selectinload(TrainingUnit.rubric),
                selectinload(TrainingUnit.scenario_prompt),
                selectinload(TrainingUnit.conversation_prompt),
                selectinload(TrainingUnit.round_evaluation_prompt),
                selectinload(TrainingUnit.evaluation_prompt),
            )
        )
        return self.db.scalar(statement)

    def attempt_for_student(self, student_id: uuid.UUID, attempt_id: uuid.UUID) -> Attempt | None:
        statement = (
            select(Attempt)
            .where(Attempt.id == attempt_id, Attempt.student_id == student_id)
            .execution_options(populate_existing=True)
            .options(selectinload(Attempt.scenario), selectinload(Attempt.messages))
        )
        return self.db.scalar(statement)

    def unit(self, unit_id: uuid.UUID) -> TrainingUnit:
        statement = (
            select(TrainingUnit)
            .where(TrainingUnit.id == unit_id)
            .options(
                selectinload(TrainingUnit.chapter),
                selectinload(TrainingUnit.rubric),
                selectinload(TrainingUnit.conversation_prompt),
                selectinload(TrainingUnit.round_evaluation_prompt),
                selectinload(TrainingUnit.evaluation_prompt),
            )
        )
        unit = self.db.scalar(statement)
        if unit is None:
            raise RuntimeError("Attempt references a missing training unit")
        return unit

    def next_sequence(self, attempt_id: uuid.UUID) -> int:
        current = self.db.scalar(
            select(func.max(Message.sequence_no)).where(Message.attempt_id == attempt_id)
        )
        return int(current or 0) + 1

    def message_by_client_id(self, attempt_id: uuid.UUID, client_message_id: str) -> Message | None:
        return self.db.scalar(
            select(Message).where(
                Message.attempt_id == attempt_id,
                Message.client_message_id == client_message_id,
            )
        )

    def message_after(self, attempt_id: uuid.UUID, sequence_no: int) -> Message | None:
        return self.db.scalar(
            select(Message).where(
                Message.attempt_id == attempt_id,
                Message.sequence_no == sequence_no + 1,
            )
        )

    def submission(self, attempt_id: uuid.UUID) -> Submission | None:
        return self.db.scalar(select(Submission).where(Submission.attempt_id == attempt_id))

    def draft(self, attempt_id: uuid.UUID) -> AttemptDraft | None:
        return self.db.get(AttemptDraft, attempt_id)

    def retry_by_key(self, student_id: uuid.UUID, key: str) -> AttemptRetry | None:
        return self.db.scalar(
            select(AttemptRetry).where(
                AttemptRetry.student_id == student_id,
                AttemptRetry.idempotency_key == key,
            )
        )

    def student_attempts(self, student_id: uuid.UUID) -> list[Attempt]:
        return list(
            self.db.scalars(
                select(Attempt)
                .where(Attempt.student_id == student_id)
                .order_by(Attempt.updated_at.desc())
            )
        )

    def evaluation(self, attempt_id: uuid.UUID) -> Evaluation | None:
        statement = (
            select(Evaluation)
            .where(Evaluation.attempt_id == attempt_id)
            .order_by(Evaluation.run_no.desc())
            .options(selectinload(Evaluation.dimensions).selectinload(EvaluationDimension.evidence))
        )
        return self.db.scalar(statement)

    def evaluation_count(self, attempt_id: uuid.UUID) -> int:
        count = self.db.scalar(
            select(func.count(Evaluation.id)).where(Evaluation.attempt_id == attempt_id)
        )
        return int(count or 0)

    def round_evaluations(self, attempt_id: uuid.UUID) -> list[RoundEvaluation]:
        return list(
            self.db.scalars(
                select(RoundEvaluation)
                .where(RoundEvaluation.attempt_id == attempt_id)
                .order_by(RoundEvaluation.created_at.asc())
            )
        )

    def latest_learning_diagnostic(self, student_id: uuid.UUID) -> RoundEvaluation | None:
        return self.db.scalar(
            select(RoundEvaluation)
            .join(Attempt, Attempt.id == RoundEvaluation.attempt_id)
            .where(Attempt.student_id == student_id)
            .order_by(RoundEvaluation.created_at.desc())
        )

    def published_prompt(self, prompt_key: str) -> PromptTemplate:
        prompt = self.db.scalar(
            select(PromptTemplate)
            .where(
                PromptTemplate.prompt_key == prompt_key,
                PromptTemplate.status == "published",
            )
            .order_by(PromptTemplate.version.desc())
        )
        if prompt is None:
            raise RuntimeError(f"Published prompt is missing: {prompt_key}")
        return prompt

    def round_evaluation_for_assistant(
        self, assistant_message_id: uuid.UUID
    ) -> RoundEvaluation | None:
        return self.db.scalar(
            select(RoundEvaluation).where(
                RoundEvaluation.assistant_message_id == assistant_message_id
            )
        )

    def progress(self, student_id: uuid.UUID) -> list[ProgressRecord]:
        return list(
            self.db.scalars(
                select(ProgressRecord)
                .where(ProgressRecord.student_id == student_id)
                .order_by(ProgressRecord.completed_at.desc())
            )
        )

    def progress_for_unit(
        self, student_id: uuid.UUID, course_version_id: uuid.UUID, unit_id: uuid.UUID
    ) -> ProgressRecord | None:
        return self.db.scalar(
            select(ProgressRecord).where(
                ProgressRecord.student_id == student_id,
                ProgressRecord.course_version_id == course_version_id,
                ProgressRecord.unit_id == unit_id,
            )
        )

    def completed_unit_keys(self, student_id: uuid.UUID, course_version_id: uuid.UUID) -> set[str]:
        return set(
            self.db.scalars(
                select(TrainingUnit.unit_key)
                .join(ProgressRecord, ProgressRecord.unit_id == TrainingUnit.id)
                .where(
                    ProgressRecord.student_id == student_id,
                    ProgressRecord.course_version_id == course_version_id,
                )
            )
        )
