from __future__ import annotations

from collections import defaultdict

from app.modules.knowledge_graph.contract import CASE_COLUMN, REQUIRED_COLUMNS, SHEET_HEADERS
from app.modules.knowledge_graph.types import ImportIssue, ParsedWorkbookData

ENUMS: dict[tuple[str, str], set[str]] = {
    ("01_案例总表", "训练方式（必填）"): {"谈判对话", "商务邮件", "单证审阅"},
    ("01_案例总表", "难度"): {"基础", "标准", "挑战"},
    ("01_案例总表", "状态"): {"草稿", "待评审", "可导入"},
    ("04_知识与材料", "类型（必填）"): {
        "术语",
        "规则",
        "单证",
        "业务流程",
        "语言表达",
        "产品与市场",
    },
    ("04_知识与材料", "学习要求"): {"必学", "选学", "拓展"},
    ("04_知识与材料", "展示时机"): {"训练前", "需要时", "训练后"},
    ("05_分级提示", "提示等级（必填）"): {"1级｜观察线索", "2级｜策略提示", "3级｜表达句框"},
    ("07_结果与复盘", "结果类别"): {"商务结果", "风险控制", "关系维护", "沟通结果"},
}

ID_COLUMNS = {
    "01_案例总表": (CASE_COLUMN,),
    "02_关键局面": (CASE_COLUMN, "局面编号（必填）"),
    "03_应对策略": (CASE_COLUMN, "局面编号（必填）", "策略编号（必填）"),
    "04_知识与材料": (CASE_COLUMN, "材料编号（必填）"),
    "05_分级提示": (CASE_COLUMN, "局面编号（必填）", "提示编号（必填）"),
    "06_评价量规": (CASE_COLUMN, "评价维度（必填）"),
    "07_结果与复盘": (CASE_COLUMN, "结果编号（必填）"),
}


def _issue(
    severity: str,
    code: str,
    sheet: str,
    message: str,
    row: dict[str, object] | None = None,
    column: str | None = None,
) -> ImportIssue:
    return ImportIssue(
        severity=severity,
        code=code,
        sheet_name=sheet,
        row_number=int(str(row["__row__"])) if row and row.get("__row__") else None,
        column_name=column,
        message=message,
    )


def _validate_cells(data: ParsedWorkbookData) -> list[ImportIssue]:
    issues: list[ImportIssue] = []
    for sheet, expected_headers in SHEET_HEADERS.items():
        for row in data.sheets.get(sheet, []):
            for column in REQUIRED_COLUMNS[sheet]:
                if row.get(column) in ("", None):
                    issues.append(
                        _issue(
                            "error", "content.required", sheet, "必填内容不能为空。", row, column
                        )
                    )
            for column in expected_headers:
                allowed = ENUMS.get((sheet, column))
                value = row.get(column)
                if allowed and value not in ("", None) and str(value) not in allowed:
                    issues.append(
                        _issue(
                            "error",
                            "content.enum_invalid",
                            sheet,
                            f"值必须是：{' / '.join(sorted(allowed))}。",
                            row,
                            column,
                        )
                    )
    return issues


def _validate_unique_ids(data: ParsedWorkbookData) -> list[ImportIssue]:
    issues: list[ImportIssue] = []
    for sheet, columns in ID_COLUMNS.items():
        seen: set[tuple[str, ...]] = set()
        for row in data.sheets.get(sheet, []):
            key = tuple(str(row.get(column, "")) for column in columns)
            if key in seen:
                issues.append(
                    _issue(
                        "error",
                        "content.identifier_duplicate",
                        sheet,
                        f"编号组合 {' / '.join(key)} 重复。",
                        row,
                        columns[-1],
                    )
                )
            seen.add(key)
    return issues


def _validate_references(data: ParsedWorkbookData) -> list[ImportIssue]:
    issues: list[ImportIssue] = []
    case_ids = {str(row.get(CASE_COLUMN)) for row in data.sheets.get("01_案例总表", [])}
    situations = {
        (str(row.get(CASE_COLUMN)), str(row.get("局面编号（必填）")))
        for row in data.sheets.get("02_关键局面", [])
    }
    for sheet, rows in data.sheets.items():
        if sheet == "01_案例总表":
            continue
        for row in rows:
            case_id = str(row.get(CASE_COLUMN, ""))
            if case_id not in case_ids:
                issues.append(
                    _issue(
                        "error",
                        "reference.case_missing",
                        sheet,
                        f"找不到案例 {case_id}。",
                        row,
                        CASE_COLUMN,
                    )
                )
            situation_id = row.get("局面编号（必填）", row.get("局面编号"))
            if situation_id not in ("", None) and (case_id, str(situation_id)) not in situations:
                issues.append(
                    _issue(
                        "error",
                        "reference.situation_missing",
                        sheet,
                        f"找不到局面 {case_id}/{situation_id}。",
                        row,
                        "局面编号",
                    )
                )
    return issues


def _validate_teaching_completeness(data: ParsedWorkbookData) -> list[ImportIssue]:
    issues: list[ImportIssue] = []
    counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for sheet, rows in data.sheets.items():
        for row in rows:
            counts[str(row.get(CASE_COLUMN))][sheet] += 1
    required = ("02_关键局面", "03_应对策略", "06_评价量规", "07_结果与复盘")
    for case in data.sheets.get("01_案例总表", []):
        case_id = str(case.get(CASE_COLUMN))
        for sheet in required:
            if counts[case_id][sheet] == 0:
                issues.append(
                    _issue(
                        "error",
                        "teaching.chain_incomplete",
                        sheet,
                        f"案例 {case_id} 缺少必需教学环节。",
                        case,
                    )
                )
    weights: dict[str, float] = defaultdict(float)
    for row in data.sheets.get("06_评价量规", []):
        try:
            weights[str(row.get(CASE_COLUMN))] += float(str(row.get("权重%（必填）", 0)))
        except (TypeError, ValueError):
            issues.append(
                _issue(
                    "error",
                    "rubric.weight_invalid",
                    "06_评价量规",
                    "权重必须是数字。",
                    row,
                    "权重%（必填）",
                )
            )
    for case_id, total in weights.items():
        if abs(total - 100) > 0.001:
            issues.append(
                _issue(
                    "error",
                    "rubric.weight_total",
                    "06_评价量规",
                    f"案例 {case_id} 的量规权重合计为 {total:g}%，必须为 100%。",
                )
            )
    scaffolded = {
        (str(row.get(CASE_COLUMN)), str(row.get("局面编号（必填）")))
        for row in data.sheets.get("05_分级提示", [])
    }
    for row in data.sheets.get("02_关键局面", []):
        key = (str(row.get(CASE_COLUMN)), str(row.get("局面编号（必填）")))
        if key not in scaffolded:
            issues.append(
                _issue(
                    "warning",
                    "teaching.scaffold_missing",
                    "05_分级提示",
                    f"局面 {key[0]}/{key[1]} 尚未配置分级提示。",
                    row,
                )
            )
    return issues


def validate_teacher_workbook(data: ParsedWorkbookData) -> list[ImportIssue]:
    return [
        *data.issues,
        *_validate_cells(data),
        *_validate_unique_ids(data),
        *_validate_references(data),
        *_validate_teaching_completeness(data),
    ]
