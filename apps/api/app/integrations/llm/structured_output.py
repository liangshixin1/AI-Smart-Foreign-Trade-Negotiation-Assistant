from __future__ import annotations

import json

from pydantic import BaseModel, ValidationError

from app.integrations.llm.base import LLMProviderError


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
