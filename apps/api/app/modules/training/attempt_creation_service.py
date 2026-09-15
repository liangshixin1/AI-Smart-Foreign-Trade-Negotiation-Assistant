# [导读] 所属业务: 一次训练从创建到提交的生命周期。
# [导读] 业务名词: Attempt 是一次训练记录; Scenario 是该次训练的场景; Submission 是正式提交时冻
# [导读] 结的内容快照。
# [导读] 用途与原因: 创建训练、绑定课程和图谱版本, 并校验生成场景; 用幂等请求识别网络重试, 避免
# [导读] 同一次点击产生多条训练。
# [导读] 结构: AttemptCreationService。
# [导读] 提醒: 重练创建新 Attempt, 重试评价沿用原提交; 场景 private 部分是对手底牌, 不得放入学生
# [导读] 响应。
from __future__ import annotations

import json
import uuid

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.llm.base import (
    LLMMessage,
    LLMProvider,
    LLMProviderError,
    LLMRequest,
    LLMResponse,
)
from app.integrations.llm.prompt_renderer import render_prompt
from app.integrations.llm.structured_output import parse_structured_output
from app.modules.auth.models import User
from app.modules.knowledge_graph.prompt_context import KnowledgeContextProvider
from app.modules.simulation.briefing_service import SimulationBriefingService
from app.modules.simulation.models import AttemptCreationRequest
from app.modules.simulation.profile_service import SimulationProfileService
from app.modules.simulation.repository import SimulationRepository
from app.modules.training.adaptive_learning import (
    ADAPTIVE_CONVERSATION_PROMPT,
    FINAL_DIAGNOSTIC_PROMPT,
    ROUND_DIAGNOSTIC_PROMPT,
)
from app.modules.training.hashing import stable_hash
from app.modules.training.invocations import invoke_and_record
from app.modules.training.models import Attempt, Message, ScenarioSnapshot
from app.modules.training.presenter import present_attempt
from app.modules.training.repository import TrainingRepository
from app.modules.training.schemas import AttemptResponse, CreateAttemptRequest, ScenarioCandidate
from app.modules.training.state import transition


class AttemptCreationService:
    def __init__(
        self,
        db: Session,
        provider: LLMProvider,
        graph_store: GraphStore,
        simulation_enabled: bool = False,
        document_correction_enabled: bool = False,
        document_correction_skip_prerequisite: bool = False,
    ) -> None:
        self.document_correction_enabled = document_correction_enabled
        self.document_correction_skip_prerequisite = document_correction_skip_prerequisite
        self.db = db
        self.provider = provider
        self.repository = TrainingRepository(db)
        self.knowledge_context = KnowledgeContextProvider(db, graph_store)
        self.simulation_profiles = SimulationProfileService(simulation_enabled)
        self.simulation_repository = SimulationRepository(db)

    # [导读] 先识别幂等创建与前置条件, 再建立版本绑定和场景快照; 失败记录保留而不冒充训练完成。
    def create(
        self, student: User, data: CreateAttemptRequest, idempotency_key: str | None = None
    ) -> AttemptResponse:
        request_hash = stable_hash(data.model_dump(mode="json"))
        if data.experience_mode == "simulation" and idempotency_key is None:
            raise AppError(
                code="simulation.idempotency_key_required",
                message="创建仿真训练需要稳定的 Idempotency-Key。",
                status_code=422,
            )
        if idempotency_key is not None:
            existing_request = self.simulation_repository.creation_request(
                student.id, idempotency_key
            )
            if existing_request is not None:
                if existing_request.request_hash != request_hash:
                    raise AppError(
                        code="training.idempotency_conflict",
                        message="同一创建键不能用于不同的训练请求。",
                        status_code=409,
                    )
                existing = self.repository.attempt_for_student(
                    student.id, existing_request.attempt_id
                )
                if existing is None:
                    raise RuntimeError("Creation request references a missing attempt")
                return present_attempt(
                    existing,
                    self.repository.unit(existing.unit_id),
                    self.repository.evaluation(existing.id),
                    self.repository.round_evaluations(existing.id),
                    self.repository,
                )
        unit = self.repository.unit_for_student(student.id, data.unit_id)
        if unit is None:
            raise AppError(
                code="training.unit_not_found",
                message="小节不存在或当前账号无权训练。",
                status_code=404,
            )
        if data.difficulty not in unit.difficulty_options:
            raise AppError(
                code="training.difficulty_invalid",
                message="该小节不支持所选难度。",
                status_code=422,
            )
        profile = None
        if data.experience_mode == "simulation":
            profile = self.simulation_profiles.require_available(unit.unit_key, unit.training_mode)
        from app.modules.document_correction.profile_service import error, is_published

        lc_correction = is_published(unit.unit_key, unit.version)
        completed_keys = self.repository.completed_unit_keys(
            student.id, unit.chapter.course_version_id
        )
        missing_prerequisites = [
            item for item in unit.prerequisite_unit_ids if item not in completed_keys
        ]
        if missing_prerequisites and not (
            lc_correction
            and self.document_correction_enabled
            and self.document_correction_skip_prerequisite
        ):
            raise AppError(
                code="training.prerequisite_incomplete",
                message="请先完成该小节的先修训练。",
                status_code=409,
                details={"missing_unit_ids": missing_prerequisites},
            )
        from app.modules.document_correction.creation_service import create as create_document

        if lc_correction:
            if not self.document_correction_enabled:
                raise error("disabled", "信用证审改模式尚未开放，请联系教师。")
            if not idempotency_key:
                raise error("idempotency_required", "创建审证训练需要稳定的操作编号。", 422)
            return create_document(self.db, student, unit, data, idempotency_key, request_hash)
        graph_context = self.knowledge_context.scenario(unit)
        content_bindings = {
            "course_version": unit.chapter.course_version.version,
            "unit_version": unit.version,
            "template_version": unit.template.version,
            "scenario_prompt_version": unit.scenario_prompt.version,
            "conversation_prompt_version": unit.conversation_prompt.version,
            "round_evaluation_prompt_version": unit.round_evaluation_prompt.version,
            "evaluation_prompt_version": unit.evaluation_prompt.version,
            "rubric_version": unit.rubric.version,
            "adaptive_conversation_prompt_version": self.repository.published_prompt(
                ADAPTIVE_CONVERSATION_PROMPT
            ).version,
            "round_diagnostic_prompt_version": self.repository.published_prompt(
                ROUND_DIAGNOSTIC_PROMPT
            ).version,
            "final_diagnostic_prompt_version": self.repository.published_prompt(
                FINAL_DIAGNOSTIC_PROMPT
            ).version,
        }
        if graph_context is not None:
            content_bindings["knowledge_graph_version"] = graph_context.graph_version
        if profile is not None:
            content_bindings.update(
                {
                    "simulation_profile_id": profile.id,
                    "simulation_profile_version": profile.version,
                    "briefing_prompt_id": profile.briefing_prompt_id,
                    "briefing_prompt_version": profile.briefing_prompt_version,
                    "simulation_conversation_prompt_id": profile.conversation_prompt_id,
                    "simulation_conversation_prompt_version": profile.conversation_prompt_version,
                    "simulation_round_prompt_id": profile.round_prompt_id,
                    "simulation_round_prompt_version": profile.round_prompt_version,
                    "simulation_final_prompt_id": profile.final_prompt_id,
                    "simulation_final_prompt_version": profile.final_prompt_version,
                    "simulation_rubric_profile_id": profile.rubric_profile_id,
                    "simulation_rubric_profile_version": profile.rubric_profile_version,
                    "state_rules_version": profile.rules_version,
                    "asset_pack_version": profile.asset_pack_version,
                }
            )
        attempt = Attempt(
            student_id=student.id,
            unit_id=unit.id,
            course_version_id=unit.chapter.course_version_id,
            status="not_started",
            difficulty=data.difficulty,
            experience_mode=data.experience_mode,
            content_bindings=content_bindings,
        )
        self.db.add(attempt)
        self.db.flush()
        creation_request = None
        if idempotency_key is not None:
            creation_request = AttemptCreationRequest(
                student_id=student.id,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                attempt_id=attempt.id,
                status="started",
            )
            self.db.add(creation_request)
        self.db.add(transition(attempt, "generating_scenario", "attempt_created"))
        self.db.commit()
        prompt = render_prompt(
            unit.scenario_prompt.body,
            {
                "unit_title": unit.title,
                "learning_objectives": json.dumps(unit.learning_objectives, ensure_ascii=False),
                "difficulty": data.difficulty,
            },
        )
        messages = [LLMMessage(role="system", content=prompt)]
        if graph_context is not None:
            messages.append(LLMMessage(role="system", content=graph_context.system_message))
        metadata = {"attempt_id": str(attempt.id)}
        if graph_context is not None:
            metadata["knowledge_graph_version"] = graph_context.graph_version
        request = LLMRequest(
            purpose="scenario",
            prompt_template_id=unit.scenario_prompt.prompt_key,
            prompt_version=unit.scenario_prompt.version,
            correlation_id=str(uuid.uuid4()),
            messages=messages,
            json_output=True,
            metadata=metadata,
        )
        try:
            response, candidate = self._validated_scenario(request)
        except LLMProviderError as exc:
            if creation_request is not None:
                creation_request.status = "failed"
            self.db.add(transition(attempt, "generation_failed", exc.category))
            self.db.commit()
            raise AppError(
                code=f"llm.{exc.category}",
                message=str(exc),
                status_code=502,
                retryable=exc.retryable,
            ) from exc
        attempt.scenario = ScenarioSnapshot(
            public_payload=candidate.public.model_dump(),
            private_payload=candidate.private.model_dump(),
            content_hash=stable_hash(candidate.model_dump()),
            provider=response.provider,
            model_name=response.model,
            prompt_template_id=unit.scenario_prompt.prompt_key,
            prompt_version=unit.scenario_prompt.version,
        )
        if profile is not None:
            SimulationBriefingService(self.db, self.provider).create(attempt, unit, profile)
        else:
            attempt.messages.append(
                Message(
                    sequence_no=1,
                    role="assistant",
                    content=candidate.public.opening_message,
                    status="completed",
                    provider=response.provider,
                    model_name=response.model,
                )
            )
            attempt.conversation_revision = 1
        self.db.add(transition(attempt, "in_progress", "scenario_generated"))
        if creation_request is not None:
            creation_request.status = "completed"
        self.db.commit()
        return present_attempt(attempt, unit, None, repository=self.repository)

    # [导读] 无效结构最多修复重试一次, 复用同一 Attempt; 避免为一次生成失败新增第二条训练。
    def _validated_scenario(self, request: LLMRequest) -> tuple[LLMResponse, ScenarioCandidate]:
        """Retry one malformed scenario without duplicating the Attempt."""

        current = request
        for run_no in range(2):
            response = invoke_and_record(self.db, self.provider, current)
            try:
                return response, parse_structured_output(response.content, ScenarioCandidate)
            except LLMProviderError as exc:
                if exc.category != "structured_output_invalid" or run_no == 1:
                    raise
                current = current.model_copy(
                    update={
                        "correlation_id": str(uuid.uuid4()),
                        "messages": [
                            *current.messages,
                            LLMMessage(
                                role="system",
                                content=(
                                    "上一份场景未通过 JSON Schema 校验。请重新独立生成完整 JSON，"
                                    "严格保留所有必填字段、类型和 public/private 边界，"
                                    "不要输出 Markdown。"
                                ),
                            ),
                        ],
                    }
                )
        raise RuntimeError("Scenario validation retry was exhausted")
