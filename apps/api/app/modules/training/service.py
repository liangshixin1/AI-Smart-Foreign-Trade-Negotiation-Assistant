# [导读] 所属业务: 一次训练从创建到提交的生命周期。
# [导读] 业务名词: Attempt 是一次训练记录; Scenario 是该次训练的场景; Submission 是正式提交时冻
# [导读] 结的内容快照。
# [导读] 用途与原因: 作为训练业务门面协调创建、对话、正式提交和评价; 具体生命周期步骤拆到专门服
# [导读] 务, 便于独立理解和验证。
# [导读] 结构: TrainingService。
# [导读] 提醒: 重练创建新 Attempt, 重试评价沿用原提交; 场景 private 部分是对手底牌, 不得放入学生
# [导读] 响应。
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.llm.base import LLMProvider
from app.modules.auth.models import User
from app.modules.simulation.conversation_service import SimulationConversationService
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

    def __init__(
        self,
        db: Session,
        provider: LLMProvider,
        graph_store: GraphStore,
        simulation_enabled: bool = False,
        document_correction_enabled: bool = False,
        document_correction_skip_prerequisite: bool = False,
    ) -> None:
        self.db = db
        self.repository = TrainingRepository(db)
        self.creation = AttemptCreationService(
            db,
            provider,
            graph_store,
            simulation_enabled,
            document_correction_enabled,
            document_correction_skip_prerequisite,
        )
        self.conversation = ConversationService(db, provider, graph_store)
        self.simulation_conversation = SimulationConversationService(db, provider, graph_store)
        self.submission = SubmissionService(db)

    def create_attempt(
        self, student: User, data: CreateAttemptRequest, idempotency_key: str | None = None
    ) -> AttemptResponse:
        return self.creation.create(student, data, idempotency_key)

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
        attempt = owned_attempt(self.repository, student, attempt_id)
        if attempt.experience_mode == "simulation":
            return self.simulation_conversation.send(student, attempt_id, data)
        return self.conversation.send(student, attempt_id, data)

    def begin_submission(
        self, student: User, attempt_id: uuid.UUID, idempotency_key: str
    ) -> tuple[Attempt, Submission]:
        return self.submission.begin(student, attempt_id, idempotency_key)

    def begin_evaluation_retry(
        self, student: User, attempt_id: uuid.UUID
    ) -> tuple[Attempt, Submission]:
        return self.submission.retry_evaluation(student, attempt_id)
