# [导读] 所属业务: 一次训练从创建到提交的生命周期。
# [导读] 业务名词: Attempt 是一次训练记录; Scenario 是该次训练的场景; Submission 是正式提交时冻
# [导读] 结的内容快照。
# [导读] 用途与原因: 在开始 SSE 前校验权限、消息幂等性并持久化消息上下文; 已完成回复直接重放, 仿
# [导读] 真新轮次需先取得生成租约。
# [导读] 结构: StreamContext、StreamContextBuilder。
# [导读] 提醒: 重练创建新 Attempt, 重试评价沿用原提交; 场景 private 部分是对手底牌, 不得放入学生
# [导读] 响应。
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.llm.base import LLMMessage, LLMRequest
from app.integrations.llm.prompt_renderer import render_prompt
from app.modules.auth.models import User
from app.modules.curriculum.models import TrainingUnit
from app.modules.knowledge_graph.prompt_context import KnowledgeContextProvider
from app.modules.simulation.repository import SimulationRepository
from app.modules.training.access import owned_attempt
from app.modules.training.adaptive_learning import conversation_adaptation
from app.modules.training.models import Attempt, Message
from app.modules.training.repository import TrainingRepository
from app.modules.training.schemas import MessageRequest


@dataclass
class StreamContext:
    attempt: Attempt
    unit: TrainingUnit
    student_message: Message
    assistant_message: Message
    request: LLMRequest | None
    replay: bool
    generation_owner: str | None = None


class StreamContextBuilder:
    def __init__(self, db: Session, graph_store: GraphStore) -> None:
        self.db = db
        self.repository = TrainingRepository(db)
        self.knowledge_context = KnowledgeContextProvider(db, graph_store)

    # [导读] 在响应流开始前检查归属、消息编号冲突和生成租约; 先保存学生消息, 使模型失败后仍可恢
    # [导读] 复。
    def prepare(self, student: User, attempt_id: uuid.UUID, data: MessageRequest) -> StreamContext:
        attempt = owned_attempt(self.repository, student, attempt_id)
        if attempt.content_bindings.get("workspace_kind") == "lc_correction":
            from app.modules.document_correction.profile_service import error

            raise error("structured_only", "请在信用证审改单中操作。")
        if attempt.status != "in_progress":
            raise AppError(
                code="training.message_not_allowed",
                message="当前训练状态不能继续发送消息。",
                status_code=409,
            )
        student_message = self.repository.message_by_client_id(attempt.id, data.client_message_id)
        if student_message is not None and student_message.content != data.content.strip():
            raise AppError(
                code="training.message_id_conflict",
                message="同一消息键不能用于不同内容。",
                status_code=409,
            )
        assistant_message = (
            self.repository.message_after(attempt.id, student_message.sequence_no)
            if student_message is not None
            else None
        )
        if assistant_message is not None and assistant_message.status == "completed":
            assert student_message is not None
            return StreamContext(
                attempt,
                self.repository.unit(attempt.unit_id),
                student_message,
                assistant_message,
                None,
                True,
            )
        generation_owner = None
        if attempt.experience_mode == "simulation":
            generation_owner = data.client_message_id
            if not SimulationRepository(self.db).claim_generation(attempt.id, generation_owner):
                raise AppError(
                    code="simulation.generation_in_progress",
                    message="本训练已有一轮回复正在生成，请稍候恢复。",
                    status_code=409,
                    retryable=True,
                )
        if student_message is None:
            student_message = Message(
                attempt_id=attempt.id,
                sequence_no=self.repository.next_sequence(attempt.id),
                role="student",
                content=data.content.strip(),
                status="completed",
                client_message_id=data.client_message_id,
            )
            self.db.add(student_message)
            self.db.commit()
            attempt = owned_attempt(self.repository, student, attempt.id)
        if attempt.scenario is None:
            raise AppError(
                code="training.scenario_missing",
                message="训练场景快照缺失，无法继续对话。",
                status_code=409,
            )
        unit = self.repository.unit(attempt.unit_id)
        history = [
            {"message_id": str(item.id), "role": item.role, "content": item.content}
            for item in attempt.messages
            if item.status == "completed"
        ]
        prompt = render_prompt(
            unit.conversation_prompt.body,
            {
                "scenario_private_json": json.dumps(
                    attempt.scenario.private_payload, ensure_ascii=False
                ),
                "conversation_history": json.dumps(history, ensure_ascii=False),
            },
        )
        if assistant_message is None:
            assistant_message = Message(
                attempt_id=attempt.id,
                sequence_no=self.repository.next_sequence(attempt.id),
                role="assistant",
                content="",
                status="streaming",
            )
            self.db.add(assistant_message)
        else:
            assistant_message.content = ""
            assistant_message.status = "streaming"
            assistant_message.failure_code = None
        self.db.commit()
        if attempt.experience_mode == "simulation":
            return StreamContext(
                attempt,
                unit,
                student_message,
                assistant_message,
                None,
                False,
                generation_owner,
            )
        bound_version = attempt.content_bindings.get("knowledge_graph_version")
        graph_context = self.knowledge_context.conversation(
            unit, str(bound_version) if bound_version else None
        )
        adaptive_prompt, adaptive_template = conversation_adaptation(self.repository, attempt)
        messages = [LLMMessage(role="system", content=prompt)]
        if graph_context is not None:
            messages.append(LLMMessage(role="system", content=graph_context.system_message))
        messages.append(LLMMessage(role="system", content=adaptive_prompt))
        metadata = {
            "attempt_id": str(attempt.id),
            "adaptive_prompt_template_id": adaptive_template.prompt_key,
            "adaptive_prompt_version": adaptive_template.version,
        }
        if graph_context is not None:
            metadata["knowledge_graph_version"] = graph_context.graph_version
        request = LLMRequest(
            purpose="conversation",
            prompt_template_id=unit.conversation_prompt.prompt_key,
            prompt_version=unit.conversation_prompt.version,
            correlation_id=str(uuid.uuid4()),
            messages=messages,
            metadata=metadata,
        )
        return StreamContext(attempt, unit, student_message, assistant_message, request, False)
