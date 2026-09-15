# [导读] 所属业务: 一次训练从创建到提交的生命周期。
# [导读] 业务名词: Attempt 是一次训练记录; Scenario 是该次训练的场景; Submission 是正式提交时冻
# [导读] 结的内容快照。
# [导读] 用途与原因: 冻结正式提交的消息、场景和版本绑定, 并启动评价状态; 同一提交键可重放结果,
# [导读] 不同键不能重复提交同一训练。
# [导读] 结构: SubmissionService。
# [导读] 提醒: 重练创建新 Attempt, 重试评价沿用原提交; 场景 private 部分是对手底牌, 不得放入学生
# [导读] 响应。
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.auth.models import User
from app.modules.simulation.repository import SimulationRepository
from app.modules.training.access import owned_attempt
from app.modules.training.hashing import stable_hash
from app.modules.training.models import Attempt, Submission
from app.modules.training.repository import TrainingRepository
from app.modules.training.state import transition


class SubmissionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = TrainingRepository(db)

    # [导读] 冻结已完成消息、场景摘要和版本绑定; 仿真生成租约仍有效时拒绝提交, 避免少冻结一轮内
    # [导读] 容。
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
        simulation_payload = None
        if attempt.experience_mode == "simulation":
            simulation_repository = SimulationRepository(self.db)
            session = simulation_repository.session(attempt.id)
            if session is None:
                raise AppError(
                    code="simulation.session_missing",
                    message="仿真会话缺失，暂不能正式提交。",
                    status_code=409,
                )
            generation_expires_at = session.generation_expires_at
            if generation_expires_at is not None and generation_expires_at.tzinfo is None:
                generation_expires_at = generation_expires_at.replace(tzinfo=UTC)
            if (
                session.generation_owner is not None
                and generation_expires_at is not None
                and generation_expires_at > datetime.now(UTC)
            ):
                raise AppError(
                    code="simulation.generation_in_progress",
                    message="本轮对手回复仍在生成，完成后才能提交。",
                    status_code=409,
                    retryable=True,
                )
            presentations = simulation_repository.presentations(attempt.id)
            simulation_payload = {
                "experience_mode": "simulation",
                "profile_id": session.profile_id,
                "profile_version": session.profile_version,
                "rules_version": attempt.content_bindings.get("state_rules_version"),
                "asset_pack_version": session.asset_pack_version,
                "briefing_hash": session.briefing_hash,
                "presentation_hash": stable_hash(
                    [item.canonical_text_hash for item in presentations]
                ),
                "state_revision": session.latest_state_revision,
                "state_hash": stable_hash(session.latest_state_payload),
                "analysis_status": session.analysis_status,
                "analysis_missing": session.analysis_status != "ready",
            }
        frozen = {
            "scenario_hash": attempt.scenario.content_hash,
            "messages": [
                {"id": str(item.id), "role": item.role, "content": item.content}
                for item in attempt.messages
                if item.status == "completed"
            ],
            "content_bindings": attempt.content_bindings,
            "simulation": simulation_payload,
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

    # [导读] 只允许有冻结提交的失败评价重新进入 evaluating, 不能绕过正式提交流程。
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
