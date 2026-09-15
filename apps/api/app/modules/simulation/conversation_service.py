# [导读] 所属业务: 带角色演出和态势的谈判仿真。
# [导读] 业务名词: Simulation 是逐段台词演出的训练体验; Presentation 是已保存的演出; State 是按
# [导读] 证据计算的谈判态势。
# [导读] 用途与原因: 连接普通训练接口与仿真轮次生成、分析和返回; 复用已有训练记录, 避免两套训练
# [导读] 历史分叉。
# [导读] 结构: SimulationConversationService。
# [导读] 提醒: 台词、逐轮评价与态势是不同结果; 分析失败不应丢掉已保存台词, 重试需尊重训练绑定的
# [导读] 配置和规则版本。
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
