# [导读] 用途: 把模型文本解析为 JSON, 再按指定 Pydantic 结构校验。
# [导读] 为什么: 先约束形状与类型, 业务服务才能安全访问字段并继续检查评分或证据规则。
# [导读] 结构: parse_structured_output。
# [导读] 提醒: 解析成功只代表结构有效, 不能跳过原话引用、候选范围或业务规则校验。
from __future__ import annotations

import json

from pydantic import BaseModel, ValidationError

from app.integrations.llm.base import LLMProviderError


# [导读] 先解析 JSON 再进行模型校验, 把无效输出转为统一错误; 通过结构校验后仍需业务校验。
def parse_structured_output[SchemaT: BaseModel](content: str, schema: type[SchemaT]) -> SchemaT:
    try:
        payload = json.loads(content)
        return schema.model_validate(payload)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise LLMProviderError(
            "structured_output_invalid",
            "大模型输出未通过结构化数据校验。",
            retryable=True,
        ) from exc
