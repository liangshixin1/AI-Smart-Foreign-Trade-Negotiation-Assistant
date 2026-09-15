# [导读] 用途: 从环境变量和环境文件构造受校验的运行配置。
# [导读] 为什么: 统一入口让数据库、鉴权和三个模型用途共享配置约束; SecretStr 减少普通打印时泄漏
# [导读] 密钥的风险。
# [导读] 结构: Settings、get_settings。
# [导读] 提醒: get_settings 有进程内缓存, 修改环境文件不会自动刷新已经缓存的 Settings; 不要把
# [导读] SecretStr 当作绝不会泄漏的加密存储。
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
    cors_origins: list[str] = ["http://localhost:5174", "http://127.0.0.1:5174"]
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
    simulation_enabled: bool = False
    document_correction_enabled: bool = False
    document_correction_skip_prerequisite: bool = False
    knowledge_graph_provider: Literal["neo4j", "memory", "disabled"] = "disabled"
    neo4j_uri: str | None = None
    neo4j_username: str | None = None
    neo4j_password: SecretStr | None = None
    neo4j_database: str = "neo4j"
    neo4j_connection_timeout_seconds: float = Field(default=5, ge=1, le=30)

    # [导读] 三种用途必须都有不同凭据, 避免模型用途隔离配置遗漏后直到调用时才失败。
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


# [导读] 缓存配置以免每次请求重读环境; 运行中改文件后需清缓存或重建配置, 并更新已经持有旧对象的
# [导读] 依赖。
@lru_cache
def get_settings() -> Settings:
    return Settings()
