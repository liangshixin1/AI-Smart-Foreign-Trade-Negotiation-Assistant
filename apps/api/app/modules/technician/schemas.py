from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, SecretStr, field_validator


class AgentStatus(BaseModel):
    purpose: Literal["scenario", "conversation", "evaluation"]
    configured: bool
    model: str


class LLMConfigResponse(BaseModel):
    provider: str
    base_url: str
    timeout_seconds: float
    max_retries: int
    agents: list[AgentStatus]


class LLMConfigUpdate(BaseModel):
    base_url: HttpUrl
    timeout_seconds: float = Field(ge=5, le=180)
    max_retries: int = Field(ge=0, le=3)
    scenario_model: str = Field(min_length=2, max_length=120)
    conversation_model: str = Field(min_length=2, max_length=120)
    evaluation_model: str = Field(min_length=2, max_length=120)
    scenario_api_key: SecretStr | None = None
    conversation_api_key: SecretStr | None = None
    evaluation_api_key: SecretStr | None = None

    @field_validator(
        "scenario_model",
        "conversation_model",
        "evaluation_model",
        "scenario_api_key",
        "conversation_api_key",
        "evaluation_api_key",
    )
    @classmethod
    def reject_line_breaks(cls, value: str | SecretStr | None) -> str | SecretStr | None:
        raw = value.get_secret_value() if isinstance(value, SecretStr) else value
        if raw is not None and ("\n" in raw or "\r" in raw):
            raise ValueError("配置值不能包含换行符。")
        return value


class ConnectivityResult(BaseModel):
    purpose: str
    status: str
    model: str
    total_tokens: int
