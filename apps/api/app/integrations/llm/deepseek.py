from __future__ import annotations

import json
import time
from collections.abc import Iterator

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.core.config import Settings
from app.integrations.llm.base import (
    LLMProviderError,
    LLMPurpose,
    LLMRequest,
    LLMResponse,
    LLMStreamChunk,
    LLMUsage,
)


class _ResponseMessage(BaseModel):
    content: str | None


class _Choice(BaseModel):
    finish_reason: str
    message: _ResponseMessage


class _Usage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    prompt_cache_hit_tokens: int = 0
    prompt_cache_miss_tokens: int = 0


class _CompletionResponse(BaseModel):
    model: str
    choices: list[_Choice] = Field(min_length=1)
    usage: _Usage = Field(default_factory=_Usage)


class _StreamDelta(BaseModel):
    content: str | None = None


class _StreamChoice(BaseModel):
    delta: _StreamDelta
    finish_reason: str | None = None


class _StreamResponse(BaseModel):
    model: str
    choices: list[_StreamChoice] = Field(default_factory=list)
    usage: _Usage | None = None


class DeepSeekProvider:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _credentials(self, purpose: LLMPurpose) -> tuple[str, str]:
        if purpose == "scenario":
            secret = self.settings.deepseek_scenario_api_key
            model = self.settings.deepseek_scenario_model
        elif purpose == "conversation":
            secret = self.settings.deepseek_conversation_api_key
            model = self.settings.deepseek_conversation_model
        else:
            secret = self.settings.deepseek_evaluation_api_key
            model = self.settings.deepseek_evaluation_model
        if secret is None or not secret.get_secret_value().strip():
            raise LLMProviderError(
                "configuration_missing",
                f"{purpose} Agent 尚未配置 DeepSeek API Key。",
                retryable=False,
            )
        return secret.get_secret_value(), model

    def complete(self, request: LLMRequest) -> LLMResponse:
        api_key, model = self._credentials(request.purpose)
        payload: dict[str, object] = {
            "model": model,
            "messages": [message.model_dump() for message in request.messages],
            "stream": False,
            "thinking": {"type": "disabled"},
            "max_tokens": request.max_output_tokens,
        }
        if request.json_output:
            payload["response_format"] = {"type": "json_object"}
        attempts = self.settings.llm_max_retries + 1
        for attempt_index in range(attempts):
            try:
                response = httpx.post(
                    f"{self.settings.deepseek_base_url.rstrip('/')}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=self.settings.llm_timeout_seconds,
                )
                if response.status_code >= 400:
                    retryable = response.status_code in {408, 429} or response.status_code >= 500
                    if retryable and attempt_index + 1 < attempts:
                        time.sleep(0.25 * (attempt_index + 1))
                        continue
                    raise LLMProviderError(
                        f"http_{response.status_code}",
                        "DeepSeek API 返回错误。",
                        retryable=retryable,
                    )
                parsed = _CompletionResponse.model_validate(response.json())
            except httpx.TransportError as exc:
                if attempt_index + 1 < attempts:
                    time.sleep(0.25 * (attempt_index + 1))
                    continue
                raise LLMProviderError(
                    "network_or_timeout", "DeepSeek API 连接超时。", retryable=True
                ) from exc
            except (ValueError, ValidationError) as exc:
                raise LLMProviderError(
                    "invalid_provider_response", "DeepSeek API 响应格式无效。", retryable=True
                ) from exc
            choice = parsed.choices[0]
            if choice.finish_reason != "stop" or not choice.message.content:
                raise LLMProviderError(
                    f"finish_{choice.finish_reason}",
                    "DeepSeek 未返回完整内容。",
                    retryable=choice.finish_reason in {"length", "insufficient_system_resource"},
                )
            return LLMResponse(
                provider="deepseek",
                model=parsed.model,
                content=choice.message.content,
                finish_reason=choice.finish_reason,
                usage=LLMUsage.model_validate(parsed.usage.model_dump()),
            )
        raise LLMProviderError("unknown", "DeepSeek API 调用失败。", retryable=True)

    def stream(self, request: LLMRequest) -> Iterator[LLMStreamChunk]:
        api_key, model = self._credentials(request.purpose)
        payload: dict[str, object] = {
            "model": model,
            "messages": [message.model_dump() for message in request.messages],
            "stream": True,
            "stream_options": {"include_usage": True},
            "thinking": {"type": "disabled"},
            "max_tokens": request.max_output_tokens,
        }
        try:
            with httpx.stream(
                "POST",
                f"{self.settings.deepseek_base_url.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=self.settings.llm_timeout_seconds,
            ) as response:
                if response.status_code >= 400:
                    retryable = response.status_code in {408, 429} or response.status_code >= 500
                    raise LLMProviderError(
                        f"http_{response.status_code}",
                        "DeepSeek 流式 API 返回错误。",
                        retryable=retryable,
                    )
                for line in response.iter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line.removeprefix("data:").strip()
                    if data == "[DONE]":
                        break
                    parsed = _StreamResponse.model_validate(json.loads(data))
                    if parsed.choices:
                        choice = parsed.choices[0]
                        yield LLMStreamChunk(
                            provider="deepseek",
                            model=parsed.model,
                            delta=choice.delta.content or "",
                            finish_reason=choice.finish_reason,
                        )
                    elif parsed.usage is not None:
                        yield LLMStreamChunk(
                            provider="deepseek",
                            model=parsed.model,
                            usage=LLMUsage.model_validate(parsed.usage.model_dump()),
                        )
        except LLMProviderError:
            raise
        except httpx.TransportError as exc:
            raise LLMProviderError(
                "network_or_timeout", "DeepSeek 流式连接中断。", retryable=True
            ) from exc
        except (ValueError, ValidationError, json.JSONDecodeError) as exc:
            raise LLMProviderError(
                "invalid_provider_response", "DeepSeek 流式响应格式无效。", retryable=True
            ) from exc
