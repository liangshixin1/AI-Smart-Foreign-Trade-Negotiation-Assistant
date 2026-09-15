# [导读] 所属业务: 技术人员的模型运行配置。
# [导读] 业务名词: 模型按场景生成、对话、评价三种用途分别配置; 连接测试用于确认后端可调用相应用
# [导读] 途的模型。
# [导读] 用途: 定义该业务的请求、响应和结构化校验模型。
# [导读] 为什么: 用字段类型、枚举和校验器限定接口契约; 数据库模型与公开响应不同, 新增字段时要检
# [导读] 查是否泄漏内部信息。
# [导读] 结构: AgentStatus、LLMConfigResponse、LLMConfigUpdate、ConnectivityResult。
# [导读] 提醒: 密钥是后端秘密, 接口展示只能使用脱敏状态; 保存环境文件后还需更新进程中的配置和模
# [导读] 型实例。
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
