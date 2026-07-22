from __future__ import annotations

import re

from app.integrations.llm.base import LLMProviderError

VARIABLE_PATTERN = re.compile(r"{{\s*([a-zA-Z0-9_]+)\s*}}")


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
