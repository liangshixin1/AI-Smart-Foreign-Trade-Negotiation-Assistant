# [导读] 所属业务: 一次训练从创建到提交的生命周期。
# [导读] 业务名词: Attempt 是一次训练记录; Scenario 是该次训练的场景; Submission 是正式提交时冻
# [导读] 结的内容快照。
# [导读] 用途与原因: 按事件顺序发送消息增量、最终台词和评价结果; 对话、分析与图谱证据分开处理,
# [导读] 辅助失败不抹掉已完成对话。
# [导读] 结构: _round_payload、StreamingConversationService。
# [导读] 提醒: 重练创建新 Attempt, 重试评价沿用原提交; 场景 private 部分是对手底牌, 不得放入学生
# [导读] 响应。
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
from app.modules.simulation.turn_service import SimulationTurnService
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

    # [导读] 先推开始事件, 再处理增量、完整台词和评价; 只有完整回复落库后才发完成事件。
    def events(self, context: StreamContext) -> Iterator[str]:
        assistant = context.assistant_message
        yield sse_event(
            "message.started",
            {
                "message_id": str(assistant.id),
                "student_message_id": str(context.student_message.id),
            },
        )
        if context.attempt.experience_mode == "simulation":
            yield from self._simulation_events(context)
            return
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
            logger.warning(
                "Round evaluation failed attempt_id=%s assistant_message_id=%s category=%s",
                context.attempt.id,
                assistant.id,
                category,
            )
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

    # [导读] 把演出就绪和分析结果分成独立事件, 台词已保存但分析失败时显式通知前端。
    def _simulation_events(self, context: StreamContext) -> Iterator[str]:
        service = SimulationTurnService(self.db, self.provider, self.graph_store)
        yield sse_event(
            "simulation.turn.preparing",
            {
                "message_id": str(context.assistant_message.id),
                "phase": "generating" if not context.replay else "restoring",
            },
        )
        try:
            presentation = service.generate(context)
        except (AppError, LLMProviderError, ValueError) as exc:
            if not context.replay:
                service.fail(context, exc)
            category = (
                exc.category if isinstance(exc, LLMProviderError) else "invalid_simulation_turn"
            )
            yield sse_event(
                "message.failed",
                {
                    "message_id": str(context.assistant_message.id),
                    "code": category,
                    "message": "学生消息已保存，仿真回复暂未完成，可安全重试。",
                    "retryable": True,
                },
            )
            yield sse_event("stream.closed", {"status": "failed"})
            return
        yield sse_event("simulation.turn.ready", presentation.model_dump(mode="json"))
        yield sse_event(
            "message.completed",
            {
                "message_id": str(context.assistant_message.id),
                "content": presentation.canonical_content,
                "conversation_revision": presentation.conversation_revision,
            },
        )
        yield sse_event(
            "round_evaluation.started",
            {"assistant_message_id": str(context.assistant_message.id)},
        )
        analysis = service.analyze(context)
        if analysis.evaluation is not None:
            yield sse_event("round_evaluation.completed", _round_payload(analysis.evaluation))
        if analysis.state is not None:
            yield sse_event("simulation.state.updated", analysis.state.model_dump(mode="json"))
            yield sse_event(
                "stream.closed", {"status": "replayed" if context.replay else "completed"}
            )
            return
        yield sse_event(
            "simulation.state.failed",
            {
                "assistant_message_id": str(context.assistant_message.id),
                "code": analysis.error_category or "invalid_round",
                "message": "台词已保存，本轮态势暂未更新，可稍后单独重试。",
                "retryable": True,
            },
        )
        yield sse_event("stream.closed", {"status": "completed_with_analysis_error"})

    # [导读] 重发已保存回复, 缺少评价时只补评价, 避免浏览器重试导致第二次对手发言。
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
                logger.warning(
                    "Round evaluation replay failed attempt_id=%s "
                    "assistant_message_id=%s category=%s",
                    context.attempt.id,
                    assistant.id,
                    category,
                )
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

    # [导读] 图谱证据写入失败时回滚该辅助写入并记录原因, 不破坏此前已提交的对话。
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
