from __future__ import annotations

import io
import posixpath
import re
import zipfile
from xml.etree import ElementTree as ET

from app.modules.knowledge_graph.contract import CHECK_COLUMN, SHEET_HEADERS
from app.modules.knowledge_graph.types import ImportIssue, ParsedWorkbookData
from app.modules.knowledge_graph.v2_contract import (
    V2_LEGACY_SHEET_HEADERS,
    V2_SHEET_HEADERS,
)
from app.modules.knowledge_graph.v3_contract import (
    EXPERT_V3_REQUIRED_SHEETS,
    EXPERT_V3_SHEET_HEADERS,
)
from app.modules.knowledge_graph.v21_contract import V21_SHEET_HEADERS

MAX_FILE_SIZE = 5 * 1024 * 1024
MAX_UNCOMPRESSED_SIZE = 20 * 1024 * 1024
MAX_ZIP_ENTRIES = 200
MAX_DATA_ROWS = 500
NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_PACKAGE_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
CELL_REF = re.compile(r"([A-Z]+)(\d+)")


class WorkbookRejected(ValueError):
    """文件安全、类型或容量不符合导入契约。"""


def _column_index(reference: str) -> int:
    match = CELL_REF.fullmatch(reference)
    if not match:
        return 0
    result = 0
    for char in match.group(1):
        result = result * 26 + ord(char) - 64
    return result - 1


def _normalise(value: object) -> object:
    if not isinstance(value, str):
        return value
    return " ".join(value.replace("\u00a0", " ").split())


def _shared_strings(archive: zipfile.ZipFile) -> list[str]:
    path = "xl/sharedStrings.xml"
    if path not in archive.namelist():
        return []
    root = ET.fromstring(archive.read(path))
    return ["".join(item.itertext()) for item in root.findall(f"{{{NS_MAIN}}}si")]


def _sheet_paths(archive: zipfile.ZipFile) -> dict[str, str]:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels.findall(f"{{{NS_PACKAGE_REL}}}Relationship")
    }
    paths: dict[str, str] = {}
    for sheet in workbook.findall(f".//{{{NS_MAIN}}}sheet"):
        rel_id = sheet.attrib.get(f"{{{NS_REL}}}id", "")
        target = targets.get(rel_id, "")
        if target.startswith("/"):
            path = target.lstrip("/")
        else:
            path = posixpath.normpath(posixpath.join("xl", target))
        paths[sheet.attrib.get("name", "")] = path
    return paths


def _cell_value(cell: ET.Element, shared: list[str]) -> object:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(cell.itertext())
    value_element = cell.find(f"{{{NS_MAIN}}}v")
    if value_element is None or value_element.text is None:
        return ""
    raw = value_element.text
    if cell_type == "s":
        index = int(raw)
        return shared[index] if 0 <= index < len(shared) else ""
    if cell_type in {"str", "e"}:
        return raw
    if cell_type == "b":
        return raw == "1"
    try:
        number = float(raw)
        return int(number) if number.is_integer() else number
    except ValueError:
        return raw


def _worksheet_rows(
    archive: zipfile.ZipFile,
    path: str,
    shared: list[str],
    sheet_name: str,
    expected_headers: tuple[str, ...],
    header_row: int,
    template_label: str,
    legacy_headers: tuple[str, ...] | None = None,
) -> tuple[list[dict[str, object]], list[ImportIssue]]:
    root = ET.fromstring(archive.read(path))
    raw_rows: dict[int, dict[int, tuple[object, bool]]] = {}
    for row in root.findall(f".//{{{NS_MAIN}}}row"):
        row_number = int(row.attrib.get("r", "0"))
        cells: dict[int, tuple[object, bool]] = {}
        for cell in row.findall(f"{{{NS_MAIN}}}c"):
            index = _column_index(cell.attrib.get("r", "A1"))
            formula = cell.find(f"{{{NS_MAIN}}}f") is not None
            cells[index] = (_normalise(_cell_value(cell, shared)), formula)
        raw_rows[row_number] = cells

    header_cells = raw_rows.get(header_row, {})
    header_width = max(header_cells, default=-1) + 1
    header_values = [str(header_cells.get(i, ("", False))[0]) for i in range(header_width)]
    while header_values and not header_values[-1]:
        header_values.pop()
    actual_headers = tuple(header_values)
    issues: list[ImportIssue] = []
    accepted_headers = (
        (expected_headers,)
        if legacy_headers is None
        else (
            expected_headers,
            legacy_headers,
        )
    )
    if actual_headers not in accepted_headers:
        issues.append(
            ImportIssue(
                severity="error",
                code="template.headers_changed",
                sheet_name=sheet_name,
                row_number=header_row,
                message=f"表头与教师 DSL {template_label} 模板不一致，请使用系统模板。",
            )
        )
        return [], issues
    row_headers = actual_headers

    rows: list[dict[str, object]] = []
    for row_number in sorted(number for number in raw_rows if number > header_row)[:MAX_DATA_ROWS]:
        cells = raw_rows[row_number]
        values = [cells.get(index, ("", False))[0] for index in range(len(row_headers))]
        content_values = values[:-1] if row_headers[-1] == CHECK_COLUMN else values
        if not any(value not in ("", None) for value in content_values):
            continue
        item = {header: values[index] for index, header in enumerate(row_headers)}
        item["__row__"] = row_number
        for index, header in enumerate(row_headers):
            if cells.get(index, ("", False))[1] and header != CHECK_COLUMN:
                issues.append(
                    ImportIssue(
                        severity="error",
                        code="content.formula_forbidden",
                        sheet_name=sheet_name,
                        row_number=row_number,
                        column_name=header,
                        message="教学内容单元格不允许公式，请改为明确文本或数值。",
                    )
                )
        item.pop(CHECK_COLUMN, None)
        rows.append(item)
    return rows, issues


def _worksheet_matrix(archive: zipfile.ZipFile, path: str, shared: list[str]) -> list[list[object]]:
    """读取完整 Sheet 值, 供说明页与衍生统计页做交叉校验。"""

    root = ET.fromstring(archive.read(path))
    indexed_rows: dict[int, dict[int, object]] = {}
    max_column = -1
    for row in root.findall(f".//{{{NS_MAIN}}}row"):
        row_number = int(row.attrib.get("r", "0"))
        values: dict[int, object] = {}
        for cell in row.findall(f"{{{NS_MAIN}}}c"):
            index = _column_index(cell.attrib.get("r", "A1"))
            max_column = max(max_column, index)
            values[index] = _normalise(_cell_value(cell, shared))
        indexed_rows[row_number] = values
    if not indexed_rows:
        return []
    return [
        [indexed_rows.get(row_number, {}).get(index, "") for index in range(max_column + 1)]
        for row_number in range(1, max(indexed_rows) + 1)
    ]


def _parse_workbook(
    content: bytes,
    sheet_headers: dict[str, tuple[str, ...]],
    *,
    header_row: int,
    template_label: str,
    legacy_sheet_headers: dict[str, tuple[str, ...]] | None = None,
) -> ParsedWorkbookData:
    if len(content) > MAX_FILE_SIZE:
        raise WorkbookRejected("文件超过 5 MB 限制。")
    try:
        archive = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile as exc:
        raise WorkbookRejected("文件不是有效的 XLSX 工作簿。") from exc
    with archive:
        infos = archive.infolist()
        if (
            len(infos) > MAX_ZIP_ENTRIES
            or sum(item.file_size for item in infos) > MAX_UNCOMPRESSED_SIZE
        ):
            raise WorkbookRejected("工作簿解压内容超过安全限制。")
        names = set(archive.namelist())
        forbidden = ("vbaproject", "externallinks", "connections.xml")
        if any(any(part in name.lower() for part in forbidden) for name in names):
            raise WorkbookRejected("工作簿包含宏、外部链接或数据连接，已拒绝导入。")
        required_parts = {"xl/workbook.xml", "xl/_rels/workbook.xml.rels"}
        if not required_parts.issubset(names):
            raise WorkbookRejected("工作簿结构不完整。")
        paths = _sheet_paths(archive)
        shared = _shared_strings(archive)
        result = ParsedWorkbookData()
        for sheet_name, expected_headers in sheet_headers.items():
            path = paths.get(sheet_name)
            if not path or path not in names:
                result.issues.append(
                    ImportIssue(
                        severity="error",
                        code="template.sheet_missing",
                        sheet_name=sheet_name,
                        message=f"缺少必需工作表：{sheet_name}。",
                    )
                )
                result.sheets[sheet_name] = []
                continue
            rows, issues = _worksheet_rows(
                archive,
                path,
                shared,
                sheet_name,
                expected_headers,
                header_row,
                template_label,
                legacy_sheet_headers.get(sheet_name) if legacy_sheet_headers else None,
            )
            result.sheets[sheet_name] = rows
            result.issues.extend(issues)
        return result


def parse_teacher_workbook(content: bytes) -> ParsedWorkbookData:
    return _parse_workbook(content, SHEET_HEADERS, header_row=5, template_label="1.0")


def parse_teacher_workbook_v2(content: bytes) -> ParsedWorkbookData:
    return _parse_workbook(
        content,
        V2_SHEET_HEADERS,
        header_row=1,
        template_label="2.0",
        legacy_sheet_headers=V2_LEGACY_SHEET_HEADERS,
    )


def parse_teacher_workbook_v21(content: bytes) -> ParsedWorkbookData:
    return _parse_workbook(
        content,
        V21_SHEET_HEADERS,
        header_row=1,
        template_label="2.1（专家组三层图谱）",
    )


def parse_expert_workbook_v3(content: bytes) -> ParsedWorkbookData:
    """按专家原始 8-Sheet 契约读取, 不改名、不拆分知识点类型。"""

    parsed = _parse_workbook(
        content,
        EXPERT_V3_SHEET_HEADERS,
        header_row=1,
        template_label="3.0（专家原始图谱）",
    )
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        names = set(archive.namelist())
        paths = _sheet_paths(archive)
        shared = _shared_strings(archive)
        for sheet_name in EXPERT_V3_REQUIRED_SHEETS:
            path = paths.get(sheet_name)
            if not path or path not in names:
                if sheet_name not in EXPERT_V3_SHEET_HEADERS:
                    parsed.issues.append(
                        ImportIssue(
                            severity="error",
                            code="template.sheet_missing",
                            sheet_name=sheet_name,
                            message=f"缺少专家源表工作表：{sheet_name}。",
                        )
                    )
                continue
            parsed.raw_sheets[sheet_name] = _worksheet_matrix(archive, path, shared)
    return parsed
