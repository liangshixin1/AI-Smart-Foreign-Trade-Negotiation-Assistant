"""Utilities for parsing knowledge point data from Excel and Word documents."""

from __future__ import annotations

import re
from typing import Dict, List, Optional

from docx import Document
from openpyxl import load_workbook


_EXCEL_HEADER_ALIASES = {
    "name": {"name", "知识点", "title", "标题"},
    "category": {"category", "分类", "类别", "知识分类"},
    "type": {"type", "类型", "类别类型"},
    "difficulty": {"difficulty", "难度", "等级"},
    "importance": {"importance", "重要性", "优先级"},
    "summary": {"summary", "摘要", "描述", "说明"},
    "tags": {"tags", "标签", "关键词"},
}

_WORD_POINT_PATTERN = re.compile(r"知识点[:：]\s*(.+)")
_WORD_FIELD_PATTERN = re.compile(r"^(分类|类型|难度|重要性|标签|摘要)[:：]\s*(.+)$")


def _normalize_excel_header(value: Optional[object]) -> str:
    if value is None:
        return ""
    text = str(value).strip().lower()
    for key, aliases in _EXCEL_HEADER_ALIASES.items():
        if text in {alias.lower() for alias in aliases}:
            return key
    return ""


def _clean_text(value: Optional[object]) -> str:
    if value is None:
        return ""
    return str(value).strip()


def parse_excel(file_storage) -> List[Dict[str, object]]:
    """Parse an Excel workbook into knowledge point dictionaries."""

    if not file_storage:
        raise ValueError("No file provided")

    stream = getattr(file_storage, "stream", None)
    if stream is not None:
        stream.seek(0)
    workbook = load_workbook(file_storage, read_only=True, data_only=True)
    sheet = workbook.active
    rows = sheet.iter_rows(values_only=True)
    try:
        header_row = next(rows)
    except StopIteration:
        return []

    headers: Dict[int, str] = {
        index: _normalize_excel_header(cell) for index, cell in enumerate(header_row or [])
    }
    if not any(headers.values()):
        # Fallback to a default header layout if the first row is data.
        headers = {0: "name", 1: "category", 2: "type", 3: "difficulty", 4: "importance", 5: "summary", 6: "tags"}
        rows = [header_row] + list(rows)

    records: List[Dict[str, object]] = []
    for row in rows:
        if not row:
            continue
        entry: Dict[str, object] = {
            "name": "",
            "categoryName": "",
            "type": "",
            "difficulty": "",
            "importance": "",
            "summary": "",
            "tags": [],
        }
        for index, cell in enumerate(row):
            key = headers.get(index)
            if not key:
                continue
            text = _clean_text(cell)
            if key == "name":
                entry["name"] = text
            elif key == "category":
                entry["categoryName"] = text
            elif key == "type":
                entry["type"] = text
            elif key == "difficulty":
                entry["difficulty"] = text
            elif key == "importance":
                entry["importance"] = text
            elif key == "summary":
                entry["summary"] = text
            elif key == "tags":
                tags = [tag.strip() for tag in text.split(",") if tag.strip()]
                entry["tags"] = tags
        if entry["name"]:
            records.append(entry)

    return records


def _finalize_word_entry(current: Optional[Dict[str, object]], entries: List[Dict[str, object]]) -> None:
    if not current:
        return
    summary = current.get("summary")
    if isinstance(summary, list):
        current["summary"] = "\n".join(fragment for fragment in summary if fragment)
    entries.append({key: value for key, value in current.items() if value})


def parse_docx(file_storage) -> List[Dict[str, object]]:
    """Parse a Word document into knowledge point dictionaries.

    预期格式：
        知识点：FOB 定义
        分类：贸易基础/贸易术语
        类型：概念
        难度：中级
        重要性：核心
        摘要：简要说明，可换行
        标签：FOB,报盘
    """

    if not file_storage:
        raise ValueError("No file provided")

    stream = getattr(file_storage, "stream", None)
    if stream is not None:
        stream.seek(0)
    document = Document(file_storage)

    entries: List[Dict[str, object]] = []
    current: Optional[Dict[str, object]] = None

    for paragraph in document.paragraphs:
        text = (paragraph.text or "").strip()
        if not text:
            continue
        point_match = _WORD_POINT_PATTERN.match(text)
        if point_match:
            _finalize_word_entry(current, entries)
            current = {
                "name": point_match.group(1).strip(),
                "summary": [],
            }
            continue
        if current is None:
            continue
        field_match = _WORD_FIELD_PATTERN.match(text)
        if field_match:
            key, value = field_match.groups()
            value = value.strip()
            if key == "分类":
                current["categoryName"] = value
            elif key == "类型":
                current["type"] = value
            elif key == "难度":
                current["difficulty"] = value
            elif key == "重要性":
                current["importance"] = value
            elif key == "标签":
                current["tags"] = [tag.strip() for tag in value.split(",") if tag.strip()]
            elif key == "摘要":
                summary_list = current.setdefault("summary", [])
                if isinstance(summary_list, list):
                    summary_list.append(value)
            continue
        summary_list = current.setdefault("summary", [])
        if isinstance(summary_list, list):
            summary_list.append(text)

    _finalize_word_entry(current, entries)
    return entries
