from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ImportIssue:
    severity: str
    code: str
    sheet_name: str
    message: str
    row_number: int | None = None
    column_name: str | None = None


@dataclass
class ParsedWorkbookData:
    sheets: dict[str, list[dict[str, object]]] = field(default_factory=dict)
    issues: list[ImportIssue] = field(default_factory=list)
