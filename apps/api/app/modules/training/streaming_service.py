from __future__ import annotations

import logging
import uuid
from collections.abc import Iterator

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.llm.base import LLMProvider, LLMProviderError
from app.integrations.streaming import sse_event
from app.modules.assessment.models import RoundEvaluation
from app.modules.assessment.round_service import RoundAssessmentService
from app.modules.auth.models import User
from app.modules.knowledge_graph.learning_evidence_service import GraphLearningEvidenceService
from app.modules.training.invocations import stream_and_record
from app.modules.training.repository import TrainingRepository
from app.modules.training.schemas import MessageRequest
from app.modules.training.streaming_context import StreamContext, StreamContextBuilder

logger = logging.getLogger(__name__)


def _round_payload(evaluation: RoundEvaluation) -> dict[str, object]:
    return {
        "id": str(evaluation.id),
        "student_message_id": str(evaluation.student_message_id),
        "assistant_message_id": str(evaluation.assistant_message_id),
        "status": evaluation.status,
        "score": evaluation.score,
        "pros": evaluation.pros,
        "cons": evaluation.cons,
        "detailed_evaluation": evaluation.detailed_evaluation,
        "next_step_suggestion": evaluation.next_step_suggestion,
        "checklist_results": evaluation.checklist_results,
        "recommendations": evaluation.recommendations,
        "model_name": evaluation.model_name,
        "prompt_version": evaluation.prompt_version,
        "created_at": evaluation.created_at.isoformat(),
    }


class StreamingConversationService:
    def __init__(self, db: Session, provider: LLMProvider, graph_store: GraphStore) -> None:
        self.db = db
        self.provider = provider
        self.repository = TrainingRepository(db)
        self.context_builder = StreamContextBuilder(db, graph_store)
        self.graph_store = graph_store

    def prepare(self, student: User, attempt_id: uuid.UUID, data: MessageRequest) -> StreamContext:
        return self.context_builder.prepare(student, attempt_id, data)

    def events(self, context: StreamContext) -> Iterator[str]:
        assistant = context.assistant_message
        yield sse_event(
            "message.started",
            {
                "message_id": str(assistant.id),
                "student_message_id": str(context.student_message.id),
            },
        )
        if context.replay:
            yield from self._replay(context)
            return
        if context.request is None:
            raise RuntimeError("New stream context requires an LLM request")
        content_parts: list[str] = []
        finish_reason: str | None = None
        provider_name = "pending"
        model_name = "pending"
        try:
            for chunk in stream_and_record(self.db, self.provider, context.request):
                provider_name = chunk.provider
                model_name = chunk.model
                if chunk.delta:
                    content_parts.append(chunk.delta)
                    yield sse_event(
                        "message.delta",
                        {"message_id": str(assistant.id), "delta": chunk.delta},
                    )
                if chunk.finish_reason is not None:
                    finish_reason = chunk.finish_reason
            content = "".join(content_parts)
            if not content or finish_reason != "stop":
                raise LLMProviderError(
                    f"finish_{finish_reason or 'empty'}",
                    "DeepSeek 未返回完整流式回复。",
                    retryable=True,
                )
        except LLMProviderError as exc:
            assistant.status = "failed"
            assistant.failure_code = exc.category
            self.db.commit()
            yield sse_event(
                "message.failed",
                {
                    "message_id": str(assistant.id),
                    "code": exc.category,
                    "message": "学生消息已保存，AI 回复失败，可安全重试。",
                    "retryable": exc.retryable,
                },
            )
            yield sse_event("stream.closed", {"status": "failed"})
            return
        assistant.content = content
        assistant.status = "completed"
        assistant.provider = provider_name
        assistant.model_name = model_name
        self.db.commit()
        yield sse_event(
            "message.completed",
            {"message_id": str(assistant.id), "content": content},
        )
        yield sse_event("round_evaluation.started", {"assistant_message_id": str(assistant.id)})
        refreshed = self.repository.attempt_for_student(
            context.attempt.student_id, context.attempt.id
        )
        if refreshed is None:
            raise RuntimeError("Attempt disappeared during round evaluation")
        try:
            evaluation = RoundAssessmentService(self.db, self.provider, self.graph_store).evaluate(
                refreshed, context.unit, context.student_message, assistant
            )
        except (LLMProviderError, ValueError) as exc:
            category = exc.category if isinstance(exc, LLMProviderError) else "invalid_round"
            yield sse_event(
                "round_evaluation.failed",
                {
                    "assistant_message_id": str(assistant.id),
                    "code": category,
                    "message": "本轮即时评价失败，不影响已保存的对话。",
                    "retryable": True,
                },
            )
        else:
            self._record_graph_evidence(context, evaluation)
            yield sse_event("round_evaluation.completed", _round_payload(evaluation))
        yield sse_event("stream.closed", {"status": "completed"})

    def _replay(self, context: StreamContext) -> Iterator[str]:
        assistant = context.assistant_message
        yield sse_event(
            "message.delta", {"message_id": str(assistant.id), "delta": assistant.content}
        )
        yield sse_event(
            "message.completed",
            {"message_id": str(assistant.id), "content": assistant.content},
        )
        evaluation = self.repository.round_evaluation_for_assistant(assistant.id)
        if evaluation is None:
            yield sse_event("round_evaluation.started", {"assistant_message_id": str(assistant.id)})
            refreshed = self.repository.attempt_for_student(
                context.attempt.student_id, context.attempt.id
            )
            if refreshed is None:
                raise RuntimeError("Attempt disappeared during round evaluation replay")
            try:
                evaluation = RoundAssessmentService(
                    self.db, self.provider, self.graph_store
                ).evaluate(refreshed, context.unit, context.student_message, assistant)
            except (LLMProviderError, ValueError) as exc:
                category = exc.category if isinstance(exc, LLMProviderError) else "invalid_round"
                yield sse_event(
                    "round_evaluation.failed",
                    {
                        "assistant_message_id": str(assistant.id),
                        "code": category,
                        "message": "本轮即时评价仍未完成，可稍后再次重试。",
                        "retryable": True,
                    },
                )
            else:
                self._record_graph_evidence(context, evaluation)
                yield sse_event("round_evaluation.completed", _round_payload(evaluation))
        else:
            self._record_graph_evidence(context, evaluation)
            yield sse_event("round_evaluation.completed", _round_payload(evaluation))
        yield sse_event("stream.closed", {"status": "replayed"})

    def _record_graph_evidence(self, context: StreamContext, evaluation: RoundEvaluation) -> None:
        try:
            GraphLearningEvidenceService(self.db, self.graph_store).record(
                context.attempt,
                context.unit,
                evaluation.id,
                context.student_message.id,
                evaluation.score,
                f"Pros: {evaluation.pros}; Cons: {evaluation.cons}",
                evaluation.recommendations,
            )
        except (AppError, SQLAlchemyError) as exc:
            self.db.rollback()
            # Graph evidence is optional and must never damage a completed conversation.
            logger.warning(
                "Graph learning evidence skipped attempt_id=%s error_type=%s",
                context.attempt.id,
                type(exc).__name__,
            )
