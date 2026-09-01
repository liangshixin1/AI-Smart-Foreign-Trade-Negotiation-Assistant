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
    # 专家源表包含说明页和分段统计页, 保留二维原始值用于交叉校验,
    # 避免把非表格 Sheet 强行扁平化后丢失语义。
    raw_sheets: dict[str, list[list[object]]] = field(default_factory=dict)
    issues: list[ImportIssue] = field(default_factory=list)
