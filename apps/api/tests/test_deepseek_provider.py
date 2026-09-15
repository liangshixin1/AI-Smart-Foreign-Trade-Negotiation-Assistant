# [导读] 业务名词: Attempt 是一次训练记录; 场景是本次任务与约束; 正式提交会冻结内容以便评价和回
# [导读] 放。
# [导读] 用途: 回归验证DeepSeek 响应解析、错误归类及流式协议。
# [导读] 为什么: 用可重复输入固定业务边界, 既检查成功结果, 也防止重试、权限或无效输入破坏已有行
# [导读] 为。
# [导读] 结构: 本文件有 2 个测试函数; 按各用例的准备、操作、断言顺序阅读, 公共夹具见
# [导读] tests/conftest.py。
# [导读] 提醒: 测试中的用户、令牌、案例和模型输出是测试数据; 通过这些用例不等于已验证真实外部模
# [导读] 型或线上环境。
from __future__ import annotations

from typing import cast

import httpx
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.integrations.llm.base import LLMMessage, LLMRequest
from app.integrations.llm.deepseek import DeepSeekProvider


def deepseek_settings() -> Settings:
    return Settings(
        app_env="test",
        auth_token_pepper="test-pepper-with-more-than-thirty-two-characters",
        llm_provider="deepseek",
        deepseek_scenario_api_key="scenario-secret",
        deepseek_conversation_api_key="conversation-secret",
        deepseek_evaluation_api_key="evaluation-secret",
        llm_max_retries=0,
    )


def test_provider_uses_v4_flash_chat_completion_and_json_mode(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    captured: dict[str, object] = {}

    def fake_post(url: str, **kwargs: object) -> httpx.Response:
        captured.update({"url": url, **kwargs})
        return httpx.Response(
            200,
            json={
                "model": "deepseek-v4-flash",
                "choices": [{"finish_reason": "stop", "message": {"content": '{"ok":true}'}}],
                "usage": {
                    "prompt_tokens": 10,
                    "completion_tokens": 4,
                    "total_tokens": 14,
                },
            },
        )

    monkeypatch.setattr(httpx, "post", fake_post)
    response = DeepSeekProvider(deepseek_settings()).complete(
        LLMRequest(
            purpose="scenario",
            prompt_template_id="scenario-test",
            prompt_version="1.0.0",
            correlation_id="correlation-test",
            messages=[LLMMessage(role="system", content="Return valid json.")],
            json_output=True,
            max_output_tokens=4096,
        )
    )
    payload = cast(dict[str, object], captured["json"])
    headers = cast(dict[str, str], captured["headers"])
    assert captured["url"] == "https://api.deepseek.com/chat/completions"
    assert payload["model"] == "deepseek-v4-flash"
    assert payload["thinking"] == {"type": "disabled"}
    assert payload["response_format"] == {"type": "json_object"}
    assert payload["max_tokens"] == 4096
    assert headers["Authorization"] == "Bearer scenario-secret"
    assert response.usage.total_tokens == 14


def test_deepseek_mode_requires_three_distinct_agent_keys() -> None:
    with pytest.raises(ValidationError):
        Settings(
            app_env="test",
            auth_token_pepper="test-pepper-with-more-than-thirty-two-characters",
            llm_provider="deepseek",
            deepseek_scenario_api_key="same-secret",
            deepseek_conversation_api_key="same-secret",
            deepseek_evaluation_api_key="same-secret",
        )
