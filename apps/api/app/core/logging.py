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
