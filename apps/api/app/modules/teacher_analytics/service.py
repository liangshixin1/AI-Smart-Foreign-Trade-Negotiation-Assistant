# [导读] 所属业务: 教师班级管理、学情统计与训练回放。
# [导读] 业务名词: 学情是学生学习和训练的证据汇总; Replay 是历史训练回放; Enrollment 用来证明学
# [导读] 生属于哪个班级。
# [导读] 用途与原因: 在教师班级权限范围内读取学生详情与单次训练回放; 历史证据标签按各自图谱版本
# [导读] 还原。
# [导读] 结构: TeacherAnalyticsService。
# [导读] 提醒: 教师身份不是查看全部学生的权限; 查询应保留班级归属、成员有效状态及相应课程范围。
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore
from app.modules.assessment.schemas import LearningDiagnosticCandidate
from app.modules.auth.models import User
from app.modules.classrooms.models import Classroom, Enrollment
from app.modules.knowledge_graph.consumption_service import KnowledgeGraphConsumptionService
from app.modules.knowledge_graph.models import (
    GraphLearningEvidence,
    KnowledgeScaffoldInteraction,
)
from app.modules.knowledge_graph.schemas import (
    GraphLearningEvidenceResponse,
    ScaffoldInteractionResponse,
)
from app.modules.simulation.presenter import present_simulation
from app.modules.simulation.repository import SimulationRepository
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
    def __init__(
        self, db: Session, teacher_id: uuid.UUID, graph_store: GraphStore | None = None
    ) -> None:
        self.db = db
        self.teacher_id = teacher_id
        self.graph_store = graph_store

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
                    experience_mode=attempt.experience_mode,
                    workspace_kind=attempt.content_bindings.get("workspace_kind"),
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

    # [导读] 通过教师拥有的有效班级关系校验访问, 再组装历史快照、对话与证据, 避免仅凭训练编号访
    # [导读] 问。
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
        simulation = None
        if attempt.experience_mode == "simulation":
            simulation_session = SimulationRepository(self.db).session(attempt.id)
            if simulation_session is not None:
                simulation = present_simulation(self.db, simulation_session)
        return AttemptReplay(
            attempt=present_attempt(
                attempt,
                repository.unit(attempt.unit_id),
                evaluation,
                round_evaluations,
                repository,
            ),
            course_version_id=attempt.course_version_id,
            content_bindings=attempt.content_bindings,
            submission_created_at=submission.created_at if submission else None,
            frozen_submission=submission.frozen_payload if submission else None,
            scaffold_interactions=[
                ScaffoldInteractionResponse.model_validate(item) for item in scaffold_interactions
            ],
            graph_learning_evidence=self._present_graph_evidence(graph_evidence),
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
            simulation=simulation,
        )

    # [导读] 按每条历史证据的 graph_version 读取标签, 不能统一用当前图谱重新解释旧证据。
    def _present_graph_evidence(
        self, evidence: list[GraphLearningEvidence]
    ) -> list[GraphLearningEvidenceResponse]:
        labels_by_version: dict[str, dict[str, str]] = {}
        if self.graph_store is not None:
            consumption = KnowledgeGraphConsumptionService(self.db, self.graph_store)
            for version in {item.graph_version for item in evidence}:
                graph = consumption.graph_by_version(version)
                labels_by_version[version] = {
                    node.id: node.short_label
                    for node in consumption.node_responses(version, graph.nodes)
                }
        return [
            GraphLearningEvidenceResponse.model_validate(item).model_copy(
                update={"node_labels": labels_by_version.get(item.graph_version, {})}
            )
            for item in evidence
        ]

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
