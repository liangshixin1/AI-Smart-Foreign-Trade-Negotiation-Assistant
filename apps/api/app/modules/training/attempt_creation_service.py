from __future__ import annotations

import json
import uuid

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.llm.base import LLMMessage, LLMProvider, LLMProviderError, LLMRequest
from app.integrations.llm.prompt_renderer import render_prompt
from app.integrations.llm.structured_output import parse_structured_output
from app.modules.auth.models import User
from app.modules.knowledge_graph.prompt_context import KnowledgeContextProvider
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
    def __init__(self, db: Session, provider: LLMProvider, graph_store: GraphStore) -> None:
        self.db = db
        self.provider = provider
        self.repository = TrainingRepository(db)
        self.knowledge_context = KnowledgeContextProvider(db, graph_store)

    def create(self, student: User, data: CreateAttemptRequest) -> AttemptResponse:
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
        completed_keys = self.repository.completed_unit_keys(
            student.id, unit.chapter.course_version_id
        )
        missing_prerequisites = [
            item for item in unit.prerequisite_unit_ids if item not in completed_keys
        ]
        if missing_prerequisites:
            raise AppError(
                code="training.prerequisite_incomplete",
                message="请先完成该小节的先修训练。",
                status_code=409,
                details={"missing_unit_ids": missing_prerequisites},
            )
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
        attempt = Attempt(
            student_id=student.id,
            unit_id=unit.id,
            course_version_id=unit.chapter.course_version_id,
            status="not_started",
            difficulty=data.difficulty,
            content_bindings=content_bindings,
        )
        self.db.add(attempt)
        self.db.flush()
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
            response = invoke_and_record(self.db, self.provider, request)
            candidate = parse_structured_output(response.content, ScenarioCandidate)
        except LLMProviderError as exc:
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
        self.db.add(transition(attempt, "in_progress", "scenario_generated"))
        self.db.commit()
        return present_attempt(attempt, unit, None)
