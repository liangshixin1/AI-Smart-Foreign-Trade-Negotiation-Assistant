from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.auth.models import User
from app.modules.training.access import owned_attempt
from app.modules.training.hashing import stable_hash
from app.modules.training.models import Attempt, Submission
from app.modules.training.repository import TrainingRepository
from app.modules.training.state import transition


class SubmissionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = TrainingRepository(db)

    def begin(
        self, student: User, attempt_id: uuid.UUID, idempotency_key: str
    ) -> tuple[Attempt, Submission]:
        attempt = owned_attempt(self.repository, student, attempt_id)
        existing = self.repository.submission(attempt.id)
        if existing is not None:
            if existing.idempotency_key != idempotency_key:
                raise AppError(
                    code="training.already_submitted",
                    message="该训练已经正式提交。",
                    status_code=409,
                )
            return attempt, existing
        student_messages = [item for item in attempt.messages if item.role == "student"]
        if attempt.status != "in_progress" or not student_messages or attempt.scenario is None:
            raise AppError(
                code="training.submit_not_allowed",
                message="至少完成一轮学生发言后才能正式提交。",
                status_code=409,
            )
        frozen = {
            "scenario_hash": attempt.scenario.content_hash,
            "messages": [
                {"id": str(item.id), "role": item.role, "content": item.content}
                for item in attempt.messages
                if item.status == "completed"
            ],
            "content_bindings": attempt.content_bindings,
        }
        submission = Submission(
            attempt_id=attempt.id,
            idempotency_key=idempotency_key,
            conversation_hash=stable_hash(frozen["messages"]),
            frozen_payload=frozen,
        )
        self.db.add(submission)
        self.db.add(transition(attempt, "submitted", "student_confirmed_submission"))
        attempt.submitted_at = datetime.now(UTC)
        self.db.flush()
        self.db.add(transition(attempt, "evaluating", "evaluation_started"))
        self.db.commit()
        return attempt, submission

    def retry_evaluation(self, student: User, attempt_id: uuid.UUID) -> tuple[Attempt, Submission]:
        attempt = owned_attempt(self.repository, student, attempt_id)
        submission = self.repository.submission(attempt.id)
        if attempt.status != "evaluation_failed" or submission is None:
            raise AppError(
                code="assessment.retry_not_allowed",
                message="当前训练没有可重试的失败评价。",
                status_code=409,
            )
        self.db.add(transition(attempt, "evaluating", "evaluation_retry_requested"))
        self.db.commit()
        return attempt, submission
