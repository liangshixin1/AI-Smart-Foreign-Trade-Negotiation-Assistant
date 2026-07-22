from __future__ import annotations

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.integrations.llm.base import (
    LLMProvider,
    LLMProviderError,
    LLMRequest,
    LLMResponse,
    LLMStreamChunk,
)
from app.modules.training.models import LLMInvocation


def invoke_and_record(db: Session, provider: LLMProvider, request: LLMRequest) -> LLMResponse:
    invocation = LLMInvocation(
        attempt_id=uuid.UUID(request.metadata["attempt_id"]),
        purpose=request.purpose,
        correlation_id=request.correlation_id,
        provider="pending",
        model_name="pending",
        prompt_template_id=request.prompt_template_id,
        prompt_version=request.prompt_version,
        status="started",
        usage={},
    )
    db.add(invocation)
    db.commit()
    try:
        response = provider.complete(request)
    except LLMProviderError as exc:
        invocation.status = "failed"
        invocation.error_category = exc.category
        invocation.finished_at = datetime.now(UTC)
        db.commit()
        raise
    invocation.provider = response.provider
    invocation.model_name = response.model
    invocation.status = "completed"
    invocation.usage = response.usage.model_dump()
    invocation.finished_at = datetime.now(UTC)
    db.commit()
    return response


def stream_and_record(
    db: Session, provider: LLMProvider, request: LLMRequest
) -> Iterator[LLMStreamChunk]:
    invocation = LLMInvocation(
        attempt_id=uuid.UUID(request.metadata["attempt_id"]),
        purpose=request.purpose,
        correlation_id=request.correlation_id,
        provider="pending",
        model_name="pending",
        prompt_template_id=request.prompt_template_id,
        prompt_version=request.prompt_version,
        status="started",
        usage={},
    )
    db.add(invocation)
    db.commit()
    try:
        for chunk in provider.stream(request):
            invocation.provider = chunk.provider
            invocation.model_name = chunk.model
            if chunk.usage is not None:
                invocation.usage = chunk.usage.model_dump()
            yield chunk
    except LLMProviderError as exc:
        invocation.status = "failed"
        invocation.error_category = exc.category
        invocation.finished_at = datetime.now(UTC)
        db.commit()
        raise
    invocation.status = "completed"
    invocation.finished_at = datetime.now(UTC)
    db.commit()
