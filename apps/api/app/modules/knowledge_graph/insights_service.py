from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.knowledge_graph.base import GraphStore
from app.modules.classrooms.models import Classroom, Enrollment
from app.modules.knowledge_graph.consumption_service import KnowledgeGraphConsumptionService
from app.modules.knowledge_graph.insight_aggregation import KnowledgeInsightAggregator
from app.modules.knowledge_graph.schemas import TeacherKnowledgeInsightsResponse


class KnowledgeGraphInsightsService:
    """校验可见范围后, 用真实轮次证据生成图谱学情。"""

    def __init__(self, db: Session, graph_store: GraphStore) -> None:
        self.db = db
        self.consumption = KnowledgeGraphConsumptionService(db, graph_store)
        self.aggregator = KnowledgeInsightAggregator(db, self.consumption)

    def classroom(
        self, teacher_id: uuid.UUID, classroom_id: uuid.UUID
    ) -> TeacherKnowledgeInsightsResponse:
        base = self.consumption.classroom_insights(teacher_id, classroom_id)
        classroom = self.db.get(Classroom, classroom_id)
        assert classroom is not None
        student_ids = tuple(
            self.db.scalars(
                select(Enrollment.student_id).where(
                    Enrollment.classroom_id == classroom_id,
                    Enrollment.status == "active",
                )
            ).all()
        )
        return self.aggregator.enrich(base, student_ids, (classroom.course_version_id,))

    def student(
        self, teacher_id: uuid.UUID, student_id: uuid.UUID
    ) -> TeacherKnowledgeInsightsResponse:
        base = self.consumption.student_insights(teacher_id, student_id)
        versions = tuple(
            self.db.scalars(
                select(Classroom.course_version_id)
                .join(Enrollment, Enrollment.classroom_id == Classroom.id)
                .where(
                    Enrollment.student_id == student_id,
                    Enrollment.status == "active",
                    Classroom.owner_teacher_id == teacher_id,
                    Classroom.status == "active",
                )
            ).all()
        )
        return self.aggregator.enrich(base, (student_id,), versions)

    def own(self, student_id: uuid.UUID) -> TeacherKnowledgeInsightsResponse:
        enrollment = self.db.execute(
            select(Enrollment.classroom_id, Classroom.course_version_id)
            .join(Classroom, Classroom.id == Enrollment.classroom_id)
            .where(
                Enrollment.student_id == student_id,
                Enrollment.status == "active",
                Classroom.status == "active",
            )
            .order_by(Enrollment.joined_at.desc())
        ).first()
        if enrollment is None:
            graph = self.consumption.teacher_graph()
            return TeacherKnowledgeInsightsResponse(
                scope="student",
                scope_id=student_id,
                graph_version=graph.graph_version,
                completed_attempts=0,
                average_score=None,
                weak_units=[],
            )
        classroom_id, course_version_id = enrollment
        classroom = self.db.get(Classroom, classroom_id)
        assert classroom is not None
        base = self.consumption.student_insights(classroom.owner_teacher_id, student_id)
        return self.aggregator.enrich(base, (student_id,), (course_version_id,))
