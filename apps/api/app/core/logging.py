# [导读] 用途: 设置统一日志输出并遮蔽常见敏感字段。
# [导读] 为什么: 在日志处理器过滤已格式化文本, 降低密码、令牌和 API key 随错误日志输出的风险。
# [导读] 结构: RedactingFilter、configure_logging。
# [导读] 提醒: 脱敏依赖匹配规则, 不能识别所有自定义格式; 业务代码仍不应主动记录完整凭据。
from __future__ import annotations

import logging
import re

SENSITIVE_PATTERN = re.compile(r"(?i)(authorization|api[_-]?key|token|password)\s*[=:]\s*[^\s,;]+")


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        rendered = record.getMessage()
        redacted = SENSITIVE_PATTERN.sub(r"\1=[REDACTED]", rendered)
        if redacted != rendered:
            record.msg = redacted
            record.args = ()
        return True


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.addFilter(RedactingFilter())
    handler.setFormatter(logging.Formatter("%(levelname)s %(name)s %(message)s"))
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)
