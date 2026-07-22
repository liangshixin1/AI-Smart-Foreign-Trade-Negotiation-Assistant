"""校验与格式化相关的通用工具。"""

from __future__ import annotations

import json
import os
from typing import Dict, Iterable


class MissingKeyError(RuntimeError):
    """当关键配置缺失时抛出的统一异常。"""


def require_key(env_name: str) -> str:
    """读取环境变量，缺失时抛出 MissingKeyError，提醒运维人员补齐配置。"""
    key = os.getenv(env_name)
    if not key:
        raise MissingKeyError(f"Missing environment variable: {env_name}")
    return key


def as_bool(value: object, default: bool = False) -> bool:
    """对多种表示方式的布尔值进行统一转换。"""
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        return normalized in {"1", "true", "yes", "on", "y"}
    return default


def first_non_empty(mapping: Dict[str, object], keys: Iterable[str]) -> str:
    """返回第一个非空字符串字段，便于清洗外部输入。"""
    for key in keys:
        value = mapping.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def extract_json_block(text: str) -> Dict[str, object]:
    """从模型返回的文本中提取 JSON 片段，兼容 Markdown 代码块。"""
    cleaned = text.strip().strip("`")
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("JSON block not found in response")
    json_string = cleaned[start : end + 1]
    return json.loads(json_string)
