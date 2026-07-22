from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LEGACY_API_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
API_ENV_FILE = Path(__file__).resolve().parents[4] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(LEGACY_API_ENV_FILE, API_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "AI Foreign-Trade Negotiation API"
    app_env: Literal["development", "test", "production"] = "development"
    database_url: str = "sqlite:///./dev.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    auth_token_pepper: str = Field(
        default="development-only-token-pepper-change-me",
        min_length=32,
    )
    access_token_ttl_seconds: int = Field(default=3600, ge=300, le=86400)
    refresh_token_ttl_seconds: int = Field(default=604800, ge=3600, le=2592000)
    dev_seed_password: str | None = None
    llm_provider: Literal["mock", "deepseek"] = "mock"
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_scenario_api_key: SecretStr | None = None
    deepseek_conversation_api_key: SecretStr | None = None
    deepseek_evaluation_api_key: SecretStr | None = None
    deepseek_scenario_model: str = "deepseek-v4-flash"
    deepseek_conversation_model: str = "deepseek-v4-flash"
    deepseek_evaluation_model: str = "deepseek-v4-flash"
    llm_timeout_seconds: float = Field(default=60, ge=5, le=180)
    llm_max_retries: int = Field(default=1, ge=0, le=3)
    knowledge_graph_provider: Literal["neo4j", "memory", "disabled"] = "disabled"
    neo4j_uri: str | None = None
    neo4j_username: str | None = None
    neo4j_password: SecretStr | None = None
    neo4j_database: str = "neo4j"
    neo4j_connection_timeout_seconds: float = Field(default=5, ge=1, le=30)

    @model_validator(mode="after")
    def validate_deepseek_agents(self) -> Settings:
        if self.llm_provider != "deepseek":
            return self
        secrets = (
            self.deepseek_scenario_api_key,
            self.deepseek_conversation_api_key,
            self.deepseek_evaluation_api_key,
        )
        values = [secret.get_secret_value().strip() if secret else "" for secret in secrets]
        if not all(values):
            raise ValueError("DeepSeek mode requires API keys for all three Agents.")
        if len(set(values)) != 3:
            raise ValueError(
                "Scenario, conversation, and evaluation Agents need distinct API keys."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
