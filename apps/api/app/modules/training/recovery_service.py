from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.llm.base import LLMProvider
from app.modules.auth.models import User
from app.modules.training.access import owned_attempt
from app.modules.training.attempt_creation_service import AttemptCreationService
from app.modules.training.models import Attempt, AttemptDraft, AttemptRetry
from app.modules.training.presenter import present_attempt
from app.modules.training.repository import TrainingRepository
from app.modules.training.schemas import (
    AttemptHistoryItemResponse,
    AttemptResponse,
    CreateAttemptRequest,
    DraftRequest,
)


class TrainingRecoveryService:
    def __init__(self, db: Session, provider: LLMProvider, graph_store: GraphStore) -> None:
        self.db = db
        self.repository = TrainingRepository(db)
        self.creation = AttemptCreationService(db, provider, graph_store)

    def save_draft(
        self, student: User, attempt_id: uuid.UUID, data: DraftRequest
    ) -> AttemptResponse:
        attempt = owned_attempt(self.repository, student, attempt_id)
        if attempt.status != "in_progress":
            raise AppError(
                code="training.draft_not_allowed",
                message="当前训练已冻结，不能再修改草稿。",
                status_code=409,
            )
        draft = self.repository.draft(attempt.id)
        if draft is None:
            draft = AttemptDraft(attempt_id=attempt.id, content=data.content)
            self.db.add(draft)
        else:
            draft.content = data.content
        self.db.commit()
        return self._present(attempt)

    def retry(self, student: User, attempt_id: uuid.UUID, idempotency_key: str) -> AttemptResponse:
        source = owned_attempt(self.repository, student, attempt_id)
        if source.status != "completed":
            raise AppError(
                code="training.retry_not_allowed",
                message="只有已完成并取得正式评价的训练才能重练。",
                status_code=409,
            )
        existing = self.repository.retry_by_key(student.id, idempotency_key)
        if existing is not None:
            created = owned_attempt(self.repository, student, existing.created_attempt_id)
            return self._present(created)
        unit = self.repository.unit(source.unit_id)
        response = self.creation.create(
            student,
            CreateAttemptRequest(unit_id=unit.unit_key, difficulty=source.difficulty),
        )
        created = owned_attempt(self.repository, student, response.id)
        created.retry_of_attempt_id = source.id
        self.db.add(
            AttemptRetry(
                student_id=student.id,
                source_attempt_id=source.id,
                created_attempt_id=created.id,
                idempotency_key=idempotency_key,
            )
        )
        self.db.commit()
        return self._present(created)

    def history(self, student: User) -> list[AttemptHistoryItemResponse]:
        result: list[AttemptHistoryItemResponse] = []
        for attempt in self.repository.student_attempts(student.id):
            unit = self.repository.unit(attempt.unit_id)
            evaluation = self.repository.evaluation(attempt.id)
            result.append(
                AttemptHistoryItemResponse(
                    id=attempt.id,
                    unit_id=unit.unit_key,
                    unit_title=unit.title,
                    training_mode=unit.training_mode,
                    status=attempt.status,
                    overall_score=evaluation.overall_score if evaluation else None,
                    retry_of_attempt_id=attempt.retry_of_attempt_id,
                    created_at=attempt.created_at,
                    updated_at=attempt.updated_at,
                )
            )
        return result

    def _present(self, attempt: Attempt) -> AttemptResponse:
        unit = self.repository.unit(attempt.unit_id)
        return present_attempt(
            attempt,
            unit,
            self.repository.evaluation(attempt.id),
            self.repository.round_evaluations(attempt.id),
            self.repository,
        )
