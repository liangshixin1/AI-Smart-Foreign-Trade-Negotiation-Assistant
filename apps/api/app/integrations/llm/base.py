# [导读] 用途: 定义模型请求、响应、流片段、用量和供应商错误的公共协议。
# [导读] 为什么: 上层只依赖 LLMProvider, 便于更换供应商并记录一致的调用审计。
# [导读] 结构: LLMMessage、LLMRequest、LLMUsage、LLMResponse、LLMStreamChunk、LLMProviderError、
# [导读] LLMPro
# [导读] vider。
# [导读] 提醒: LLM 指大语言模型; 结构符合协议不意味着业务事实正确, 输出仍需各业务模块校验。
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
    # [导读] 按统一请求协议返回完整模型响应; 调用方仍需校验业务字段, 测试替身也不能被当成真实模
    # [导读] 型结果。
    def complete(self, request: LLMRequest) -> LLMResponse: ...

    def stream(self, request: LLMRequest) -> Iterator[LLMStreamChunk]: ...
