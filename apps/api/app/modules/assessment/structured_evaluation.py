from __future__ import annotations

import json
import logging
import uuid

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.llm.base import (
    LLMMessage,
    LLMProvider,
    LLMProviderError,
    LLMRequest,
    LLMResponse,
)
from app.integrations.llm.prompt_renderer import render_prompt
from app.modules.assessment.schemas import EvaluationCandidate, RubricDimensionSpec
from app.modules.curriculum.models import PromptTemplate
from app.modules.training.invocations import invoke_and_record
from app.modules.training.models import Message

logger = logging.getLogger(__name__)


def request_validated_evaluation(
    db: Session,
    provider: LLMProvider,
    request: LLMRequest,
    specs: list[RubricDimensionSpec],
    student_messages: list[Message],
) -> tuple[LLMResponse, EvaluationCandidate, str]:
    current = request
    for run_no in range(2):
        response = invoke_and_record(db, provider, current)
        try:
            candidate = _parse_candidate(response.content, allow_diagnostic_fallback=run_no == 1)
            bind_evidence_to_student_messages(candidate, student_messages)
            validate_candidate(candidate, specs, student_messages)
        except (ValueError, LLMProviderError) as exc:
            if isinstance(exc, LLMProviderError) and exc.category != "structured_output_invalid":
                raise
            logger.warning(
                "Structured evaluation validation failed run=%s reason=%s",
                run_no + 1,
                str(exc),
            )
            if run_no == 1:
                raise
            repair_template = db.scalar(
                select(PromptTemplate)
                .where(
                    PromptTemplate.prompt_key == "evaluation-structured-repair",
                    PromptTemplate.status == "published",
                )
                .order_by(PromptTemplate.version.desc())
            )
            if repair_template is None:
                raise RuntimeError("Published evaluation repair prompt is missing") from exc
            evidence_bank = [
                {"message_id": str(item.id), "content": item.content} for item in student_messages
            ]
            repair_prompt = render_prompt(
                repair_template.body,
                {
                    "candidate_json": response.content,
                    "evidence_bank_json": json.dumps(evidence_bank, ensure_ascii=False),
                    "rubric_keys": json.dumps([item.key for item in specs], ensure_ascii=False),
                },
            )
            current = LLMRequest(
                purpose="evaluation",
                prompt_template_id=repair_template.prompt_key,
                prompt_version=repair_template.version,
                correlation_id=str(uuid.uuid4()),
                json_output=True,
                max_output_tokens=request.max_output_tokens,
                metadata=request.metadata,
                messages=[LLMMessage(role="system", content=repair_prompt)],
            )
        else:
            return response, candidate, current.correlation_id
    raise RuntimeError("Structured evaluation retry exhausted unexpectedly")


def _parse_candidate(
    content: str, *, allow_diagnostic_fallback: bool = False
) -> EvaluationCandidate:
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError("invalid JSON syntax") from exc
    try:
        candidate = EvaluationCandidate.model_validate(payload)
    except ValidationError as exc:
        diagnostic_only = all(
            item["loc"] and item["loc"][0] == "learning_diagnostic" for item in exc.errors()
        )
        if allow_diagnostic_fallback and diagnostic_only and isinstance(payload, dict):
            payload.pop("learning_diagnostic", None)
            candidate = EvaluationCandidate.model_validate(payload)
        else:
            fields = [".".join(str(part) for part in item["loc"]) for item in exc.errors()]
            raise ValueError(f"invalid schema fields: {','.join(fields[:12])}") from exc
    if candidate.learning_diagnostic is None and not allow_diagnostic_fallback:
        raise ValueError("invalid schema fields: learning_diagnostic")
    return candidate


def validate_candidate(
    candidate: EvaluationCandidate,
    specs: list[RubricDimensionSpec],
    student_messages: list[Message],
) -> None:
    expected = {item.key for item in specs}
    actual = [item.dimension_key for item in candidate.dimensions]
    if len(actual) != len(set(actual)) or set(actual) != expected:
        raise ValueError("Evaluation dimensions do not exactly match rubric")
    content_by_id = {item.id: item.content for item in student_messages}
    for dimension in candidate.dimensions:
        for evidence in dimension.evidence:
            content = content_by_id.get(evidence.message_id)
            if content is None or evidence.quote not in content:
                raise ValueError("Evaluation evidence is not an exact student quote")


def bind_evidence_to_student_messages(
    candidate: EvaluationCandidate, student_messages: list[Message]
) -> None:
    """Replace model paraphrases with server-owned exact evidence for a valid message id."""
    content_by_id = {item.id: item.content for item in student_messages}
    for dimension in candidate.dimensions:
        for evidence in dimension.evidence:
            content = content_by_id.get(evidence.message_id)
            if content is not None and evidence.quote not in content:
                evidence.quote = content
