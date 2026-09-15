# [导读] 用途: 将提示词模板中的命名占位符替换为业务变量。
# [导读] 为什么: 显式检查缺失变量, 避免把未展开的占位符直接发送给模型并产生难以定位的输出。
# [导读] 结构: render_prompt。
# [导读] 提醒: 模板是模型指令; 业务变量可能含学生输入, 传入字符串不等于赋予其系统权限。
from __future__ import annotations

import re

from app.integrations.llm.base import LLMProviderError

VARIABLE_PATTERN = re.compile(r"{{\s*([a-zA-Z0-9_]+)\s*}}")


# [导读] 发现缺少模板变量时直接报错, 避免把残留占位符当作业务上下文交给模型。
def render_prompt(body: str, variables: dict[str, str]) -> str:
    required = set(VARIABLE_PATTERN.findall(body))
    missing = required - variables.keys()
    if missing:
        names = ", ".join(sorted(missing))
        raise LLMProviderError(
            "prompt_variables_missing", f"提示词变量缺失：{names}", retryable=False
        )

    def replace(match: re.Match[str]) -> str:
        return variables[match.group(1)]

    return VARIABLE_PATTERN.sub(replace, body)
