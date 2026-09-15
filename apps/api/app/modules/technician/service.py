# [导读] 所属业务: 技术人员的模型运行配置。
# [导读] 业务名词: 模型按场景生成、对话、评价三种用途分别配置; 连接测试用于确认后端可调用相应用
# [导读] 途的模型。
# [导读] 用途与原因: 构造脱敏模型配置响应并更新环境文件; 写入时保留未涉及配置, 不能把接口展示的
# [导读] 脱敏值当成真实密钥回写。
# [导读] 结构: present_config、update_env。
# [导读] 提醒: 密钥是后端秘密, 接口展示只能使用脱敏状态; 保存环境文件后还需更新进程中的配置和模
# [导读] 型实例。
from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Literal

from pydantic import SecretStr

from app.core.config import API_ENV_FILE, Settings
from app.modules.technician.schemas import AgentStatus, LLMConfigResponse, LLMConfigUpdate

MANAGED_KEYS = {
    "LLM_PROVIDER",
    "DEEPSEEK_BASE_URL",
    "LLM_TIMEOUT_SECONDS",
    "LLM_MAX_RETRIES",
    "DEEPSEEK_SCENARIO_MODEL",
    "DEEPSEEK_CONVERSATION_MODEL",
    "DEEPSEEK_EVALUATION_MODEL",
    "DEEPSEEK_SCENARIO_API_KEY",
    "DEEPSEEK_CONVERSATION_API_KEY",
    "DEEPSEEK_EVALUATION_API_KEY",
}


def present_config(settings: Settings) -> LLMConfigResponse:
    values: list[
        tuple[Literal["scenario", "conversation", "evaluation"], SecretStr | None, str]
    ] = [
        ("scenario", settings.deepseek_scenario_api_key, settings.deepseek_scenario_model),
        (
            "conversation",
            settings.deepseek_conversation_api_key,
            settings.deepseek_conversation_model,
        ),
        ("evaluation", settings.deepseek_evaluation_api_key, settings.deepseek_evaluation_model),
    ]
    return LLMConfigResponse(
        provider=settings.llm_provider,
        base_url=settings.deepseek_base_url,
        timeout_seconds=settings.llm_timeout_seconds,
        max_retries=settings.llm_max_retries,
        agents=[
            AgentStatus(
                purpose=purpose,
                configured=bool(secret and secret.get_secret_value().strip()),
                model=model,
            )
            for purpose, secret, model in values
        ],
    )


# [导读] 仅替换传入的配置项并保留其他环境内容; 调用方应同步刷新运行对象, 磁盘保存不等于进程已生
# [导读] 效。
def update_env(settings: Settings, data: LLMConfigUpdate, path: Path = API_ENV_FILE) -> Settings:
    def secret(new: SecretStr | None, current: SecretStr | None) -> str:
        selected = new if new is not None else current
        return selected.get_secret_value().strip() if selected is not None else ""

    values = {
        "LLM_PROVIDER": "deepseek",
        "DEEPSEEK_BASE_URL": str(data.base_url).rstrip("/"),
        "LLM_TIMEOUT_SECONDS": str(data.timeout_seconds),
        "LLM_MAX_RETRIES": str(data.max_retries),
        "DEEPSEEK_SCENARIO_MODEL": data.scenario_model,
        "DEEPSEEK_CONVERSATION_MODEL": data.conversation_model,
        "DEEPSEEK_EVALUATION_MODEL": data.evaluation_model,
        "DEEPSEEK_SCENARIO_API_KEY": secret(
            data.scenario_api_key, settings.deepseek_scenario_api_key
        ),
        "DEEPSEEK_CONVERSATION_API_KEY": secret(
            data.conversation_api_key, settings.deepseek_conversation_api_key
        ),
        "DEEPSEEK_EVALUATION_API_KEY": secret(
            data.evaluation_api_key, settings.deepseek_evaluation_api_key
        ),
    }
    if not all(
        values[key]
        for key in (
            "DEEPSEEK_SCENARIO_API_KEY",
            "DEEPSEEK_CONVERSATION_API_KEY",
            "DEEPSEEK_EVALUATION_API_KEY",
        )
    ):
        raise ValueError("三个 Agent 都必须配置 API Key。")
    keys = [
        values["DEEPSEEK_SCENARIO_API_KEY"],
        values["DEEPSEEK_CONVERSATION_API_KEY"],
        values["DEEPSEEK_EVALUATION_API_KEY"],
    ]
    if len(set(keys)) != 3:
        raise ValueError("三个 Agent 必须使用互不相同的 API Key。")
    existing = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    kept = [line for line in existing if line.split("=", 1)[0].strip() not in MANAGED_KEYS]
    content = "\n".join([*kept, *(f"{key}={value}" for key, value in values.items()), ""])
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=path.parent, delete=False
    ) as handle:
        handle.write(content)
        temporary = Path(handle.name)
    os.chmod(temporary, 0o600)
    temporary.replace(path)
    return Settings()
