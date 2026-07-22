from __future__ import annotations

from collections.abc import Iterator
from typing import Literal, Protocol

from pydantic import BaseModel, Field

LLMPurpose = Literal["scenario", "conversation", "evaluation"]


class LLMMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class LLMRequest(BaseModel):
    purpose: LLMPurpose
    prompt_template_id: str
    prompt_version: str
    correlation_id: str
    messages: list[LLMMessage] = Field(min_length=1)
    json_output: bool = False
    max_output_tokens: int = Field(default=2048, ge=256, le=8192)
    metadata: dict[str, str] = Field(default_factory=dict)


class LLMUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    prompt_cache_hit_tokens: int = 0
    prompt_cache_miss_tokens: int = 0


class LLMResponse(BaseModel):
    provider: str
    model: str
    content: str
    finish_reason: str
    usage: LLMUsage


class LLMStreamChunk(BaseModel):
    provider: str
    model: str
    delta: str = ""
    finish_reason: str | None = None
    usage: LLMUsage | None = None


class LLMProviderError(Exception):
    def __init__(self, category: str, message: str, *, retryable: bool) -> None:
        super().__init__(message)
        self.category = category
        self.retryable = retryable


class LLMProvider(Protocol):
    def complete(self, request: LLMRequest) -> LLMResponse: ...

    def stream(self, request: LLMRequest) -> Iterator[LLMStreamChunk]: ...
