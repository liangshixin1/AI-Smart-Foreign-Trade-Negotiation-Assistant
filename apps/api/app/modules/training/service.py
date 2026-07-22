from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.llm.base import LLMProvider
from app.modules.auth.models import User
from app.modules.training.access import owned_attempt
from app.modules.training.attempt_creation_service import AttemptCreationService
from app.modules.training.conversation_service import ConversationService
from app.modules.training.models import Attempt, Submission
from app.modules.training.presenter import present_attempt
from app.modules.training.repository import TrainingRepository
from app.modules.training.schemas import AttemptResponse, CreateAttemptRequest, MessageRequest
from app.modules.training.submission_service import SubmissionService


class TrainingService:
    """Small facade that exposes the training use cases to the route layer."""

    def __init__(self, db: Session, provider: LLMProvider, graph_store: GraphStore) -> None:
        self.db = db
        self.repository = TrainingRepository(db)
        self.creation = AttemptCreationService(db, provider, graph_store)
        self.conversation = ConversationService(db, provider, graph_store)
        self.submission = SubmissionService(db)

    def create_attempt(self, student: User, data: CreateAttemptRequest) -> AttemptResponse:
        return self.creation.create(student, data)

    def get_attempt(self, student: User, attempt_id: uuid.UUID) -> AttemptResponse:
        attempt = owned_attempt(self.repository, student, attempt_id)
        unit = self.repository.unit(attempt.unit_id)
        return present_attempt(
            attempt,
            unit,
            self.repository.evaluation(attempt.id),
            self.repository.round_evaluations(attempt.id),
            self.repository,
        )

    def send_message(
        self, student: User, attempt_id: uuid.UUID, data: MessageRequest
    ) -> AttemptResponse:
        return self.conversation.send(student, attempt_id, data)

    def begin_submission(
        self, student: User, attempt_id: uuid.UUID, idempotency_key: str
    ) -> tuple[Attempt, Submission]:
        return self.submission.begin(student, attempt_id, idempotency_key)

    def begin_evaluation_retry(
        self, student: User, attempt_id: uuid.UUID
    ) -> tuple[Attempt, Submission]:
        return self.submission.retry_evaluation(student, attempt_id)
