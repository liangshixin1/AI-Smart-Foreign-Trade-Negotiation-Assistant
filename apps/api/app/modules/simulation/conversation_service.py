from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.llm.base import LLMProvider, LLMProviderError
from app.modules.auth.models import User
from app.modules.simulation.turn_service import SimulationTurnService
from app.modules.training.presenter import present_attempt
from app.modules.training.repository import TrainingRepository
from app.modules.training.schemas import AttemptResponse, MessageRequest
from app.modules.training.streaming_context import StreamContextBuilder


class SimulationConversationService:
    def __init__(self, db: Session, provider: LLMProvider, graph_store: GraphStore) -> None:
        self.db = db
        self.builder = StreamContextBuilder(db, graph_store)
        self.turns = SimulationTurnService(db, provider, graph_store)
        self.training_repository = TrainingRepository(db)

    def send(self, student: User, attempt_id: uuid.UUID, data: MessageRequest) -> AttemptResponse:
        context = self.builder.prepare(student, attempt_id, data)
        try:
            self.turns.generate(context)
        except (LLMProviderError, ValueError) as exc:
            self.turns.fail(context, exc)
            raise AppError(
                code="simulation.turn_invalid",
                message="你的消息已保存，但仿真回复未通过校验，可以安全重试。",
                status_code=502,
                retryable=True,
            ) from exc
        self.turns.analyze(context)
        refreshed = self.training_repository.attempt_for_student(student.id, attempt_id)
        if refreshed is None:
            raise RuntimeError("Simulation attempt disappeared after sending")
        return present_attempt(
            refreshed,
            context.unit,
            self.training_repository.evaluation(attempt_id),
            self.training_repository.round_evaluations(attempt_id),
            self.training_repository,
        )
