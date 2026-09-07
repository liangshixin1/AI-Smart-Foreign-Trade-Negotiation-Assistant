from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.llm.base import LLMProvider
from app.modules.auth.models import User
from app.modules.classrooms.models import Classroom, Enrollment
from app.modules.simulation.presenter import present_simulation
from app.modules.simulation.repository import SimulationRepository
from app.modules.simulation.schemas import SimulationResponse
from app.modules.simulation.turn_service import SimulationTurnService
from app.modules.training.access import owned_attempt
from app.modules.training.models import Attempt, Message
from app.modules.training.repository import TrainingRepository
from app.modules.training.streaming_context import StreamContext


class SimulationService:
    def __init__(
        self,
        db: Session,
        provider: LLMProvider | None = None,
        graph_store: GraphStore | None = None,
    ) -> None:
        self.db = db
        self.provider = provider
        self.graph_store = graph_store
        self.repository = SimulationRepository(db)
        self.training_repository = TrainingRepository(db)

    def student_get(self, student: User, attempt_id: uuid.UUID) -> SimulationResponse:
        attempt = owned_attempt(self.training_repository, student, attempt_id)
        return self._read(attempt)

    def teacher_get(self, teacher_id: uuid.UUID, attempt_id: uuid.UUID) -> SimulationResponse:
        attempt = self.db.scalar(
            select(Attempt)
            .join(Enrollment, Enrollment.student_id == Attempt.student_id)
            .join(Classroom, Classroom.id == Enrollment.classroom_id)
            .where(
                Attempt.id == attempt_id,
                Classroom.owner_teacher_id == teacher_id,
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
        return self._read(attempt)

    def retry_analysis(
        self, student: User, attempt_id: uuid.UUID, assistant_message_id: uuid.UUID
    ) -> SimulationResponse:
        attempt = owned_attempt(self.training_repository, student, attempt_id)
        if attempt.experience_mode != "simulation" or attempt.status != "in_progress":
            raise AppError(
                code="simulation.analysis_retry_not_allowed",
                message="当前记录不能补做态势分析。",
                status_code=409,
            )
        presentation = self.repository.presentation_for_message(assistant_message_id)
        if presentation is None or presentation.attempt_id != attempt.id:
            raise AppError(
                code="simulation.presentation_not_found",
                message="本轮仿真台词不存在。",
                status_code=404,
            )
        if presentation.student_message_id is None:
            raise AppError(
                code="simulation.opening_analysis_not_applicable",
                message="开场台词没有逐轮态势分析。",
                status_code=409,
            )
        student_message = self.db.get(Message, presentation.student_message_id)
        assistant_message = self.db.get(Message, presentation.assistant_message_id)
        if student_message is None or assistant_message is None:
            raise RuntimeError("Presentation references missing messages")
        if self.provider is None or self.graph_store is None:
            raise RuntimeError("Analysis retry requires model and graph providers")
        context = StreamContext(
            attempt=attempt,
            unit=self.training_repository.unit(attempt.unit_id),
            student_message=student_message,
            assistant_message=assistant_message,
            request=None,
            replay=True,
        )
        result = SimulationTurnService(self.db, self.provider, self.graph_store).analyze(context)
        if result.error_category is not None:
            raise AppError(
                code=f"simulation.{result.error_category}",
                message="态势分析仍未完成，已保存台词不受影响。",
                status_code=502,
                retryable=True,
            )
        return self._read(attempt)

    def _read(self, attempt: Attempt) -> SimulationResponse:
        if attempt.experience_mode != "simulation":
            raise AppError(
                code="simulation.not_applicable",
                message="该训练记录使用对话模式。",
                status_code=409,
            )
        session = self.repository.session(attempt.id)
        if session is None:
            raise AppError(
                code="simulation.session_missing",
                message="仿真会话记录缺失。",
                status_code=409,
            )
        return present_simulation(self.db, session)
