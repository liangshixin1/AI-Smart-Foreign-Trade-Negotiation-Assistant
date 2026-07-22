from __future__ import annotations

import json
import uuid

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.llm.base import LLMMessage, LLMProvider, LLMProviderError, LLMRequest
from app.integrations.llm.prompt_renderer import render_prompt
from app.modules.assessment.round_service import RoundAssessmentService
from app.modules.auth.models import User
from app.modules.curriculum.models import TrainingUnit
from app.modules.knowledge_graph.prompt_context import KnowledgeContextProvider
from app.modules.training.access import owned_attempt
from app.modules.training.adaptive_learning import conversation_adaptation
from app.modules.training.invocations import invoke_and_record
from app.modules.training.models import Attempt, Message
from app.modules.training.presenter import present_attempt
from app.modules.training.repository import TrainingRepository
from app.modules.training.schemas import AttemptResponse, MessageRequest


class ConversationService:
    def __init__(self, db: Session, provider: LLMProvider, graph_store: GraphStore) -> None:
        self.db = db
        self.provider = provider
        self.graph_store = graph_store
        self.repository = TrainingRepository(db)
        self.knowledge_context = KnowledgeContextProvider(db, graph_store)

    def send(self, student: User, attempt_id: uuid.UUID, data: MessageRequest) -> AttemptResponse:
        attempt = owned_attempt(self.repository, student, attempt_id)
        if attempt.status != "in_progress":
            raise AppError(
                code="training.message_not_allowed",
                message="当前训练状态不能继续发送消息。",
                status_code=409,
            )
        existing_student_message = self.repository.message_by_client_id(
            attempt.id, data.client_message_id
        )
        if existing_student_message:
            unit = self.repository.unit(attempt.unit_id)
            assistant_message = self.repository.message_after(
                attempt.id, existing_student_message.sequence_no
            )
            if (
                assistant_message is not None
                and assistant_message.status == "completed"
                and self.repository.round_evaluation_for_assistant(assistant_message.id) is None
            ):
                self._evaluate_round(attempt, unit, existing_student_message, assistant_message)
            return present_attempt(
                attempt,
                unit,
                self.repository.evaluation(attempt.id),
                self.repository.round_evaluations(attempt.id),
            )
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
        attempt = owned_attempt(self.repository, student, attempt_id)
        unit = self.repository.unit(attempt.unit_id)
        if attempt.scenario is None:
            raise AppError(
                code="training.scenario_missing",
                message="训练场景快照缺失，无法继续对话。",
                status_code=409,
            )
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
        try:
            response = invoke_and_record(self.db, self.provider, request)
        except LLMProviderError as exc:
            self.db.add(
                Message(
                    attempt_id=attempt.id,
                    sequence_no=self.repository.next_sequence(attempt.id),
                    role="assistant",
                    content="",
                    status="failed",
                    failure_code=exc.category,
                )
            )
            self.db.commit()
            raise AppError(
                code=f"llm.{exc.category}",
                message="你的消息已保存，但 AI 对手回复失败，可以安全重试。",
                status_code=502,
                retryable=exc.retryable,
            ) from exc
        assistant_message = Message(
            attempt_id=attempt.id,
            sequence_no=self.repository.next_sequence(attempt.id),
            role="assistant",
            content=response.content,
            status="completed",
            provider=response.provider,
            model_name=response.model,
        )
        self.db.add(assistant_message)
        self.db.commit()
        refreshed = owned_attempt(self.repository, student, attempt.id)
        self._evaluate_round(refreshed, unit, student_message, assistant_message)
        return present_attempt(refreshed, unit, None, self.repository.round_evaluations(attempt.id))

    def _evaluate_round(
        self,
        attempt: Attempt,
        unit: TrainingUnit,
        student_message: Message,
        assistant_message: Message,
    ) -> None:
        """非流式兼容接口也必须留下与流式接口一致的隐式形成性诊断。"""
        try:
            RoundAssessmentService(self.db, self.provider, self.graph_store).evaluate(
                attempt, unit, student_message, assistant_message
            )
        except (LLMProviderError, ValueError) as exc:
            raise AppError(
                code="assessment.round_evaluation_failed",
                message="AI 对手回复已保存，但本轮学习诊断失败；可用同一消息安全重试。",
                status_code=502,
                retryable=True,
            ) from exc
