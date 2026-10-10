"""Strict private-build configuration and bounded model access."""

from __future__ import annotations

import threading
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr, model_validator

from app.integrations.llm.base import (
    LLMProvider,
    LLMProviderError,
    LLMRequest,
    LLMResponse,
    LLMStreamChunk,
)


class DemoCredential(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal[1] = 1
    expires_at: datetime
    scenario: SecretStr
    conversation: SecretStr
    evaluation: SecretStr
    model: str = Field(min_length=1, max_length=100)
    budget_confirmed: Literal[True]
    max_calls_per_launch: int = Field(default=100, ge=3, le=500)

    @model_validator(mode="after")
    def validate_keys(self) -> DemoCredential:
        keys = [
            getattr(self, role).get_secret_value().strip()
            for role in ("scenario", "conversation", "evaluation")
        ]
        if not all(keys) or len(set(keys)) != 3:
            raise ValueError("Three distinct temporary keys are required")
        if self.expires_at.tzinfo is None:
            raise ValueError("Expiry must include a timezone")
        return self


class PublicCredential(BaseModel):
    """User-owned key; separate from the temporary expert authorization."""

    model_config = ConfigDict(extra="forbid")
    schema_version: Literal[1] = 1
    key: SecretStr
    model: str = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_key(self) -> PublicCredential:
        key = self.key.get_secret_value()
        if not key or len(key) > 1024 or any(c.isspace() for c in key):
            raise ValueError("Invalid public key")
        if not self.model.strip() or any(c.isspace() for c in self.model):
            raise ValueError("Invalid model")
        return self

    @property
    def scenario(self) -> SecretStr:
        return self.key

    @property
    def conversation(self) -> SecretStr:
        return self.key

    @property
    def evaluation(self) -> SecretStr:
        return self.key


class BoundedProvider:
    """Local UX guard only: provider-side revocation/budgets remain necessary."""

    def __init__(self, provider: LLMProvider, credential: DemoCredential | None) -> None:
        self.provider = provider
        self.credential = credential
        self.calls = 0
        self.lock = threading.Lock()
        self.slots = threading.BoundedSemaphore(2)

    def _enter(self) -> None:
        with self.lock:
            if self.credential:
                if datetime.now(UTC) >= self.credential.expires_at:
                    raise LLMProviderError(
                        "demo_expired", "体验授权已到期，请联系项目组。", retryable=False
                    )
                if self.calls >= self.credential.max_calls_per_launch:
                    raise LLMProviderError("demo_limit", "本次体验请求已达上限。", retryable=False)
            if not self.slots.acquire(blocking=False):
                raise LLMProviderError("demo_busy", "已有请求处理中，请稍后重试。", retryable=True)
            self.calls += 1

    def complete(self, request: LLMRequest) -> LLMResponse:
        self._enter()
        try:
            return self.provider.complete(
                request.model_copy(
                    update={"max_output_tokens": min(request.max_output_tokens, 4096)}
                )
            )
        finally:
            self.slots.release()

    def stream(self, request: LLMRequest) -> Iterator[LLMStreamChunk]:
        self._enter()
        try:
            yield from self.provider.stream(
                request.model_copy(
                    update={"max_output_tokens": min(request.max_output_tokens, 4096)}
                )
            )
        finally:
            self.slots.release()
