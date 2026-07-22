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


class StreamContextBuilder:
    def __init__(self, db: Session, graph_store: GraphStore) -> None:
        self.db = db
        self.repository = TrainingRepository(db)
        self.knowledge_context = KnowledgeContextProvider(db, graph_store)

    def prepare(self, student: User, attempt_id: uuid.UUID, data: MessageRequest) -> StreamContext:
        attempt = owned_attempt(self.repository, student, attempt_id)
        if attempt.status != "in_progress":
            raise AppError(
                code="training.message_not_allowed",
                message="当前训练状态不能继续发送消息。",
                status_code=409,
            )
        student_message = self.repository.message_by_client_id(attempt.id, data.client_message_id)
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
        assistant_message = self.repository.message_after(attempt.id, student_message.sequence_no)
        if assistant_message is not None and assistant_message.status == "completed":
            return StreamContext(
                attempt,
                self.repository.unit(attempt.unit_id),
                student_message,
                assistant_message,
                None,
                True,
            )
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
