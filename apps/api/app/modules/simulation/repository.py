# [导读] 所属业务: 带角色演出和态势的谈判仿真。
# [导读] 业务名词: Simulation 是逐段台词演出的训练体验; Presentation 是已保存的演出; State 是按
# [导读] 证据计算的谈判态势。
# [导读] 用途与原因: 集中读取仿真演出、态势快照及事件, 并用数据库条件更新申请生成租约; 租约是有
# [导读] 期限的生成占用, 防止并发轮次重复生成。
# [导读] 结构: SimulationRepository。
# [导读] 提醒: 台词、逐轮评价与态势是不同结果; 分析失败不应丢掉已保存台词, 重试需尊重训练绑定的
# [导读] 配置和规则版本。
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.modules.simulation.models import (
    AttemptCreationRequest,
    SimulationSession,
    SimulationStateEvent,
    SimulationStateSnapshot,
    SimulationTurnPresentation,
)


class SimulationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def creation_request(
        self, student_id: uuid.UUID, key: str, operation: str = "create_attempt"
    ) -> AttemptCreationRequest | None:
        return self.db.scalar(
            select(AttemptCreationRequest).where(
                AttemptCreationRequest.student_id == student_id,
                AttemptCreationRequest.operation == operation,
                AttemptCreationRequest.idempotency_key == key,
            )
        )

    def session(self, attempt_id: uuid.UUID) -> SimulationSession | None:
        return self.db.get(SimulationSession, attempt_id)

    def presentations(self, attempt_id: uuid.UUID) -> list[SimulationTurnPresentation]:
        return list(
            self.db.scalars(
                select(SimulationTurnPresentation)
                .where(SimulationTurnPresentation.attempt_id == attempt_id)
                .order_by(SimulationTurnPresentation.conversation_revision)
            )
        )

    def presentation_for_message(
        self, assistant_message_id: uuid.UUID
    ) -> SimulationTurnPresentation | None:
        return self.db.scalar(
            select(SimulationTurnPresentation).where(
                SimulationTurnPresentation.assistant_message_id == assistant_message_id
            )
        )

    def latest_snapshot(self, attempt_id: uuid.UUID) -> SimulationStateSnapshot | None:
        return self.db.scalar(
            select(SimulationStateSnapshot)
            .where(SimulationStateSnapshot.attempt_id == attempt_id)
            .order_by(SimulationStateSnapshot.state_revision.desc())
        )

    def snapshots(self, attempt_id: uuid.UUID) -> list[SimulationStateSnapshot]:
        return list(
            self.db.scalars(
                select(SimulationStateSnapshot)
                .where(SimulationStateSnapshot.attempt_id == attempt_id)
                .order_by(SimulationStateSnapshot.state_revision)
            )
        )

    def event_keys(self, attempt_id: uuid.UUID) -> set[str]:
        return set(
            self.db.scalars(
                select(SimulationStateEvent.dedupe_key).where(
                    SimulationStateEvent.attempt_id == attempt_id,
                    SimulationStateEvent.decision == "accepted",
                )
            )
        )

    # [导读] 用单条条件 UPDATE 申请两分钟生成租约, 只有空闲或过期才能取得; 提交后其他请求才能看
    # [导读] 到占用。
    def claim_generation(self, attempt_id: uuid.UUID, owner: str) -> bool:
        now = datetime.now(UTC)
        result = self.db.execute(
            update(SimulationSession)
            .where(
                SimulationSession.attempt_id == attempt_id,
                (
                    SimulationSession.generation_owner.is_(None)
                    | (SimulationSession.generation_expires_at < now)
                ),
            )
            .values(
                generation_owner=owner,
                generation_expires_at=now + timedelta(minutes=2),
                generation_revision=SimulationSession.generation_revision + 1,
            )
            .returning(SimulationSession.generation_owner)
        )
        claimed_owner = result.scalar_one_or_none()
        self.db.commit()
        return claimed_owner == owner

    # [导读] 按 owner 条件释放租约, 防止迟到的旧任务清掉新任务已经取得的占用。
    def release_generation(self, attempt_id: uuid.UUID, owner: str) -> None:
        self.db.execute(
            update(SimulationSession)
            .where(
                SimulationSession.attempt_id == attempt_id,
                SimulationSession.generation_owner == owner,
            )
            .values(generation_owner=None, generation_expires_at=None)
        )
        self.db.commit()
