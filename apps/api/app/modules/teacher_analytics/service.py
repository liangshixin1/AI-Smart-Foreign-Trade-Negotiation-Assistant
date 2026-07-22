from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import AppError
from app.modules.assessment.schemas import LearningDiagnosticCandidate
from app.modules.auth.models import User
from app.modules.classrooms.models import Classroom, Enrollment
from app.modules.knowledge_graph.models import (
    GraphLearningEvidence,
    KnowledgeScaffoldInteraction,
)
from app.modules.knowledge_graph.schemas import (
    GraphLearningEvidenceResponse,
    ScaffoldInteractionResponse,
)
from app.modules.teacher_analytics.competency import competency_summaries
from app.modules.teacher_analytics.schemas import (
    AttemptReplay,
    AttemptSummary,
    RoundLearningDiagnostic,
    StudentDetail,
    StudentItem,
)
from app.modules.teacher_analytics.student_metrics import student_item
from app.modules.training.models import Attempt, Submission
from app.modules.training.presenter import present_attempt
from app.modules.training.repository import TrainingRepository


class TeacherAnalyticsService:
    def __init__(self, db: Session, teacher_id: uuid.UUID) -> None:
        self.db = db
        self.teacher_id = teacher_id

    def classroom(self, classroom_id: uuid.UUID) -> Classroom:
        item = self.db.scalar(
            select(Classroom).where(
                Classroom.id == classroom_id,
                Classroom.owner_teacher_id == self.teacher_id,
                Classroom.status == "active",
            )
        )
        if item is None:
            raise AppError(
                code="teacher.classroom_not_found",
                message="班级不存在或无权访问。",
                status_code=404,
            )
        return item

    def students(self, classroom_id: uuid.UUID) -> list[StudentItem]:
        classroom = self.classroom(classroom_id)
        users = list(
            self.db.scalars(
                select(User)
                .join(Enrollment, Enrollment.student_id == User.id)
                .where(Enrollment.classroom_id == classroom_id, Enrollment.status == "active")
                .order_by(User.student_no)
            )
        )
        return [student_item(self.db, user, classroom.course_version_id) for user in users]

    def student_detail(self, student_id: uuid.UUID) -> StudentDetail:
        user = self._student_for_teacher(student_id)
        repository = TrainingRepository(self.db)
        attempts = list(
            self.db.scalars(
                select(Attempt)
                .where(Attempt.student_id == student_id)
                .order_by(Attempt.created_at.desc())
            )
        )
        summaries: list[AttemptSummary] = []
        for attempt in attempts:
            unit = repository.unit(attempt.unit_id)
            evaluation = repository.evaluation(attempt.id)
            summaries.append(
                AttemptSummary(
                    id=attempt.id,
                    unit_id=unit.unit_key,
                    unit_title=unit.title,
                    status=attempt.status,
                    overall_score=evaluation.overall_score if evaluation else None,
                    created_at=attempt.created_at,
                    completed_at=attempt.completed_at,
                )
            )
        course_version_id = self.db.scalar(
            select(Classroom.course_version_id)
            .join(Enrollment, Enrollment.classroom_id == Classroom.id)
            .where(
                Enrollment.student_id == student_id,
                Classroom.owner_teacher_id == self.teacher_id,
                Enrollment.status == "active",
            )
        )
        if course_version_id is None:
            raise RuntimeError("Student enrollment has no course version")
        return StudentDetail(
            student=student_item(self.db, user, course_version_id),
            attempts=summaries,
            competencies=competency_summaries(
                self.db,
                student_ids=[student_id],
                course_version_id=course_version_id,
                include_trend=True,
            ),
        )

    def attempt_replay(self, attempt_id: uuid.UUID) -> AttemptReplay:
        attempt = self.db.scalar(
            select(Attempt)
            .join(Enrollment, Enrollment.student_id == Attempt.student_id)
            .join(Classroom, Classroom.id == Enrollment.classroom_id)
            .where(
                Attempt.id == attempt_id,
                Classroom.owner_teacher_id == self.teacher_id,
                Enrollment.status == "active",
            )
            .options(selectinload(Attempt.scenario), selectinload(Attempt.messages))
        )
        if attempt is None:
            raise AppError(
                code="teacher.attempt_not_found",
                message="训练记录不存在或无权查看。",
                status_code=404,
            )
        repository = TrainingRepository(self.db)
        submission = self.db.scalar(select(Submission).where(Submission.attempt_id == attempt.id))
        scaffold_interactions = list(
            self.db.scalars(
                select(KnowledgeScaffoldInteraction)
                .where(KnowledgeScaffoldInteraction.attempt_id == attempt.id)
                .order_by(KnowledgeScaffoldInteraction.created_at)
            )
        )
        graph_evidence = list(
            self.db.scalars(
                select(GraphLearningEvidence)
                .where(GraphLearningEvidence.attempt_id == attempt.id)
                .order_by(GraphLearningEvidence.created_at)
            )
        )
        round_evaluations = repository.round_evaluations(attempt.id)
        evaluation = repository.evaluation(attempt.id)
        return AttemptReplay(
            attempt=present_attempt(
                attempt,
                repository.unit(attempt.unit_id),
                evaluation,
                round_evaluations,
            ),
            course_version_id=attempt.course_version_id,
            content_bindings=attempt.content_bindings,
            submission_created_at=submission.created_at if submission else None,
            frozen_submission=submission.frozen_payload if submission else None,
            scaffold_interactions=[
                ScaffoldInteractionResponse.model_validate(item) for item in scaffold_interactions
            ],
            graph_learning_evidence=[
                GraphLearningEvidenceResponse.model_validate(item) for item in graph_evidence
            ],
            round_learning_diagnostics=[
                RoundLearningDiagnostic(
                    round_evaluation_id=item.id,
                    student_message_id=item.student_message_id,
                    created_at=item.created_at,
                    diagnostic=LearningDiagnosticCandidate.model_validate(item.learning_diagnostic),
                )
                for item in round_evaluations
                if item.learning_diagnostic
            ],
            final_learning_diagnostic=(
                LearningDiagnosticCandidate.model_validate(evaluation.learning_diagnostic)
                if evaluation is not None and evaluation.learning_diagnostic
                else None
            ),
        )

    def _student_for_teacher(self, student_id: uuid.UUID) -> User:
        user = self.db.scalar(
            select(User)
            .join(Enrollment, Enrollment.student_id == User.id)
            .join(Classroom, Classroom.id == Enrollment.classroom_id)
            .where(
                User.id == student_id,
                Classroom.owner_teacher_id == self.teacher_id,
                Enrollment.status == "active",
            )
        )
        if user is None:
            raise AppError(
                code="teacher.student_not_found",
                message="学生不存在或无权查看。",
                status_code=404,
            )
        return user
