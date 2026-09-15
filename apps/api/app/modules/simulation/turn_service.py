# [导读] 所属业务: 带角色演出和态势的谈判仿真。
# [导读] 业务名词: Simulation 是逐段台词演出的训练体验; Presentation 是已保存的演出; State 是按
# [导读] 证据计算的谈判态势。
# [导读] 用途与原因: 生成并保存演出, 再运行逐轮评价与态势分析; 写入前后核对生成租约, 过期调用结
# [导读] 果不能覆盖新轮次。
# [导读] 结构: AnalysisResult、SimulationTurnService。
# [导读] 提醒: 台词、逐轮评价与态势是不同结果; 分析失败不应丢掉已保存台词, 重试需尊重训练绑定的
# [导读] 配置和规则版本。
from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.llm.base import LLMMessage, LLMProvider, LLMProviderError, LLMRequest
from app.integrations.llm.prompt_renderer import render_prompt
from app.modules.assessment.models import RoundEvaluation
from app.modules.assessment.round_service import RoundAssessmentService
from app.modules.knowledge_graph.learning_evidence_service import GraphLearningEvidenceService
from app.modules.knowledge_graph.prompt_context import KnowledgeContextProvider
from app.modules.simulation.models import SimulationTurnPresentation
from app.modules.simulation.profile_service import load_profile_version, load_simulation_prompt
from app.modules.simulation.repository import SimulationRepository
from app.modules.simulation.schemas import (
    SimulationBeat,
    SimulationPresentationResponse,
    SimulationStateResponse,
)
from app.modules.simulation.state_service import SimulationStateService
from app.modules.simulation.validators import parse_turn_output, validate_turn
from app.modules.training.adaptive_learning import conversation_adaptation
from app.modules.training.hashing import stable_hash
from app.modules.training.invocations import invoke_and_record
from app.modules.training.repository import TrainingRepository
from app.modules.training.streaming_context import StreamContext

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AnalysisResult:
    evaluation: RoundEvaluation | None
    state: SimulationStateResponse | None
    error_category: str | None


class SimulationTurnService:
    def __init__(self, db: Session, provider: LLMProvider, graph_store: GraphStore) -> None:
        self.db = db
        self.provider = provider
        self.graph_store = graph_store
        self.repository = SimulationRepository(db)
        self.training_repository = TrainingRepository(db)
        self.state = SimulationStateService(db)
        self.knowledge_context = KnowledgeContextProvider(db, graph_store)

    # [导读] 优先重放已保存演出; 新生成前后检查租约所有权, 过期模型结果不能回写会话。
    def generate(self, context: StreamContext) -> SimulationPresentationResponse:
        existing = self.repository.presentation_for_message(context.assistant_message.id)
        if context.replay:
            if existing is None:
                raise ValueError("Completed simulation message is missing its presentation")
            return self.present(existing, context.assistant_message.content)
        if context.attempt.scenario is None or context.generation_owner is None:
            raise ValueError("Simulation generation context is incomplete")
        session = self.repository.session(context.attempt.id)
        if session is None or session.generation_owner != context.generation_owner:
            raise AppError(
                code="simulation.generation_lease_lost",
                message="本轮生成租约已经失效，请恢复后重试。",
                status_code=409,
                retryable=True,
            )
        profile = load_profile_version(session.profile_id, session.profile_version)
        history = [
            {"message_id": str(item.id), "role": item.role, "content": item.content}
            for item in context.attempt.messages
            if item.status == "completed"
        ]
        simulation_prompt = render_prompt(
            load_simulation_prompt("conversation"),
            {
                "scenario_private_json": json.dumps(
                    context.attempt.scenario.private_payload, ensure_ascii=False
                ),
                "simulation_state_json": json.dumps(
                    session.latest_state_payload, ensure_ascii=False
                ),
                "conversation_history": json.dumps(history, ensure_ascii=False),
            },
        )
        # The published IM prompt requires an email salutation/signature and 3-5 sentences.
        # Reusing it here conflicts with the concise structured AVG contract, so simulation
        # uses its separately versioned prompt and the same bound scenario facts instead.
        messages = [LLMMessage(role="system", content=simulation_prompt)]
        bound_version = context.attempt.content_bindings.get("knowledge_graph_version")
        graph_context = self.knowledge_context.conversation(
            context.unit, str(bound_version) if bound_version else None
        )
        if graph_context is not None:
            messages.append(LLMMessage(role="system", content=graph_context.system_message))
        adaptive_prompt, adaptive_template = conversation_adaptation(
            self.training_repository, context.attempt
        )
        messages.append(LLMMessage(role="system", content=adaptive_prompt))
        current_state = SimulationStateResponse.model_validate(session.latest_state_payload)
        request = LLMRequest(
            purpose="conversation",
            prompt_template_id=profile.conversation_prompt_id,
            prompt_version=profile.conversation_prompt_version,
            correlation_id=str(uuid.uuid4()),
            messages=messages,
            json_output=True,
            max_output_tokens=512,
            metadata={
                "attempt_id": str(context.attempt.id),
                "simulation_kind": "turn",
                "input_state_revision": str(session.latest_state_revision),
                "trust_band": current_state.trust.band,
                "willingness_band": current_state.willingness.band,
                "alignment_value": str(current_state.alignment.value),
                "adaptive_prompt_template_id": adaptive_template.prompt_key,
                "adaptive_prompt_version": adaptive_template.version,
            },
        )
        current = request
        last_error: Exception | None = None
        lease_revision = session.generation_revision
        for index in range(2):
            try:
                response = invoke_and_record(self.db, self.provider, current)
                if response.finish_reason != "stop":
                    raise LLMProviderError(
                        f"finish_{response.finish_reason}",
                        "仿真台词输出不完整。",
                        retryable=True,
                    )
                candidate = parse_turn_output(response.content)
                canonical = validate_turn(candidate)
                break
            except (LLMProviderError, ValueError) as exc:
                last_error = exc
                if index == 1:
                    self.fail(context, exc)
                    raise
                current = current.model_copy(
                    update={
                        "correlation_id": str(uuid.uuid4()),
                        "messages": [
                            *current.messages,
                            LLMMessage(
                                role="system",
                                content=(
                                    "上一份回复未通过 simulation.turn.v1、角色、1-3 beats、"
                                    "每句 24 词或总计 60 词校验。请完整重写 JSON，不要截断。"
                                ),
                            ),
                        ],
                    }
                )
        else:
            raise last_error or RuntimeError("Simulation turn validation exhausted")
        self.db.refresh(session)
        if (
            session.generation_owner != context.generation_owner
            or session.generation_revision != lease_revision
        ):
            raise AppError(
                code="simulation.generation_lease_lost",
                message="本轮生成租约已被更新，过期结果不会写入会话。",
                status_code=409,
                retryable=True,
            )
        context.assistant_message.content = canonical
        context.assistant_message.status = "completed"
        context.assistant_message.failure_code = None
        context.assistant_message.provider = response.provider
        context.assistant_message.model_name = response.model
        context.attempt.conversation_revision += 1
        presentation = SimulationTurnPresentation(
            attempt_id=context.attempt.id,
            assistant_message_id=context.assistant_message.id,
            student_message_id=context.student_message.id,
            beats=[item.model_dump(mode="json") for item in candidate.beats],
            canonical_text_hash=stable_hash(canonical),
            source="llm",
            input_state_revision=session.latest_state_revision,
            conversation_revision=context.attempt.conversation_revision,
            prompt_binding={
                "prompt_id": profile.conversation_prompt_id,
                "prompt_version": profile.conversation_prompt_version,
            },
            asset_pack_version=session.asset_pack_version,
        )
        self.db.add(presentation)
        session.generation_owner = None
        session.generation_expires_at = None
        session.analysis_status = "pending"
        self.db.commit()
        return self.present(presentation, canonical)

    # [导读] 复用已有评价或重新分析已保存台词, 将图谱证据和态势处理拆开, 允许独立补做失败分析。
    def analyze(self, context: StreamContext) -> AnalysisResult:
        assistant = context.assistant_message
        evaluation = self.training_repository.round_evaluation_for_assistant(assistant.id)
        try:
            if evaluation is None:
                evaluation = RoundAssessmentService(
                    self.db, self.provider, self.graph_store
                ).evaluate(context.attempt, context.unit, context.student_message, assistant)
            self._record_graph_evidence(context, evaluation)
            state = self.state.process(context.attempt, evaluation)
        except (LLMProviderError, ValueError) as exc:
            category = exc.category if isinstance(exc, LLMProviderError) else "invalid_round"
            self.state.mark_failed(context.attempt.id)
            logger.warning(
                "Simulation analysis failed attempt_id=%s assistant_message_id=%s category=%s",
                context.attempt.id,
                assistant.id,
                category,
            )
            return AnalysisResult(evaluation, None, category)
        return AnalysisResult(evaluation, state, None)

    # [导读] 记录本轮生成失败并释放本任务负责的状态, 保留学生已保存消息供恢复。
    def fail(self, context: StreamContext, exc: Exception) -> None:
        context.assistant_message.status = "failed"
        context.assistant_message.failure_code = (
            exc.category if isinstance(exc, LLMProviderError) else "invalid_simulation_turn"
        )
        session = self.repository.session(context.attempt.id)
        if session is not None and session.generation_owner == context.generation_owner:
            session.generation_owner = None
            session.generation_expires_at = None
        self.db.commit()

    @staticmethod
    def present(
        presentation: SimulationTurnPresentation, canonical: str
    ) -> SimulationPresentationResponse:
        return SimulationPresentationResponse(
            presentation_id=presentation.id,
            message_id=presentation.assistant_message_id,
            student_message_id=presentation.student_message_id,
            conversation_revision=presentation.conversation_revision,
            input_state_revision=presentation.input_state_revision,
            canonical_content=canonical,
            canonical_text_hash=presentation.canonical_text_hash,
            character_id="david-lim",
            asset_pack_version=presentation.asset_pack_version,
            beats=[SimulationBeat.model_validate(item) for item in presentation.beats],
            created_at=presentation.created_at,
        )

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
            logger.warning(
                "Simulation graph evidence skipped attempt_id=%s error_type=%s",
                context.attempt.id,
                type(exc).__name__,
            )
