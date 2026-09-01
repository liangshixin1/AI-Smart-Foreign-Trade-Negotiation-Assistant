from __future__ import annotations

from collections import Counter

from app.modules.knowledge_graph.types import ImportIssue, ParsedWorkbookData
from app.modules.knowledge_graph.v3_contract import (
    EXPERT_V3_EXPECTED_COUNTS,
    EXPERT_V3_KNOWLEDGE_TYPES,
    EXPERT_V3_REQUIRED_SHEETS,
)


def _issue(
    code: str,
    sheet: str,
    message: str,
    row: dict[str, object] | None = None,
    column: str | None = None,
) -> ImportIssue:
    return ImportIssue(
        severity="error",
        code=code,
        sheet_name=sheet,
        row_number=int(str(row["__row__"])) if row and row.get("__row__") else None,
        column_name=column,
        message=message,
    )


def _identifiers(
    data: ParsedWorkbookData, sheet: str, field: str, issues: list[ImportIssue]
) -> set[str]:
    result: set[str] = set()
    for row in data.sheets.get(sheet, []):
        value = str(row.get(field, "")).strip()
        if not value:
            issues.append(_issue("content.required", sheet, "编号不能为空。", row, field))
        elif value in result:
            issues.append(
                _issue("content.identifier_duplicate", sheet, f"编号 {value} 重复。", row, field)
            )
        result.add(value)
    return result


def validate_expert_workbook_v3(data: ParsedWorkbookData) -> list[ImportIssue]:
    """验证原始事实表及两个衍生视图, 防止“看起来能导入”的静默漂移。"""

    issues = list(data.issues)
    for sheet in EXPERT_V3_REQUIRED_SHEETS:
        if sheet not in data.raw_sheets:
            issues.append(_issue("template.sheet_missing", sheet, f"缺少专家源表工作表：{sheet}。"))

    stages = _identifiers(data, "01_L1_Stages", "Stage ID", issues)
    phenomena = _identifiers(data, "02_L2_Phenomena", "Phenomenon ID", issues)
    knowledge = _identifiers(data, "03_L3_Knowledge", "Knowledge ID", issues)

    for row in data.sheets.get("02_L2_Phenomena", []):
        if str(row.get("Stage ID")) not in stages:
            issues.append(
                _issue(
                    "reference.stage_missing",
                    "02_L2_Phenomena",
                    "现象引用的阶段不存在。",
                    row,
                    "Stage ID",
                )
            )
        if str(row.get("Risk")) not in {"High", "Medium", "Low"}:
            issues.append(
                _issue(
                    "content.risk_invalid",
                    "02_L2_Phenomena",
                    "Risk 只能为 High、Medium 或 Low。",
                    row,
                    "Risk",
                )
            )
        if str(row.get("Frequency")) not in {"High", "Medium", "Low"}:
            issues.append(
                _issue(
                    "content.frequency_invalid",
                    "02_L2_Phenomena",
                    "Frequency 只能为 High、Medium 或 Low。",
                    row,
                    "Frequency",
                )
            )

    for row in data.sheets.get("03_L3_Knowledge", []):
        if str(row.get("Home stage ID")) not in stages:
            issues.append(
                _issue(
                    "reference.stage_missing",
                    "03_L3_Knowledge",
                    "知识点归属阶段不存在。",
                    row,
                    "Home stage ID",
                )
            )
        if str(row.get("Type")) not in EXPERT_V3_KNOWLEDGE_TYPES:
            issues.append(
                _issue(
                    "content.knowledge_type_invalid",
                    "03_L3_Knowledge",
                    "知识点类型不属于专家定义的七类。",
                    row,
                    "Type",
                )
            )

    pairs: set[tuple[str, str]] = set()
    linked_counts: Counter[str] = Counter()
    edge_rows = data.sheets.get("04_Edges", [])
    for row in edge_rows:
        phenomenon_id = str(row.get("Phenomenon ID"))
        knowledge_id = str(row.get("Knowledge ID"))
        pair = (phenomenon_id, knowledge_id)
        if pair in pairs:
            issues.append(
                _issue(
                    "relation.duplicate",
                    "04_Edges",
                    f"关系 {phenomenon_id} → {knowledge_id} 重复。",
                    row,
                )
            )
        pairs.add(pair)
        linked_counts[phenomenon_id] += 1
        if phenomenon_id not in phenomena or knowledge_id not in knowledge:
            issues.append(_issue("relation.reference_invalid", "04_Edges", "关系端点不存在。", row))

    for row in data.sheets.get("02_L2_Phenomena", []):
        expected = int(str(row.get("Linked L3 count") or 0))
        actual = linked_counts[str(row.get("Phenomenon ID"))]
        if expected != actual:
            issues.append(
                _issue(
                    "derived.linked_count_mismatch",
                    "02_L2_Phenomena",
                    f"关联数应为 {expected}，实际为 {actual}。",
                    row,
                    "Linked L3 count",
                )
            )

    master_pairs = {
        (str(row.get("Phenomenon ID")), str(row.get("Knowledge ID")))
        for row in data.sheets.get("05_Master_Graph", [])
    }
    if master_pairs != pairs:
        issues.append(
            _issue(
                "derived.master_graph_mismatch",
                "05_Master_Graph",
                "主图衍生视图与 04_Edges 不一致。",
            )
        )
    index_ids = {str(row.get("Knowledge ID")) for row in data.sheets.get("06_Knowledge_Index", [])}
    if index_ids != knowledge:
        issues.append(
            _issue(
                "derived.knowledge_index_mismatch",
                "06_Knowledge_Index",
                "知识索引未一比一覆盖 03_L3_Knowledge。",
            )
        )

    actual_counts = {
        "stages": len(stages),
        "phenomena": len(phenomena),
        "knowledge_points": len(knowledge),
        "phenomenon_knowledge_edges": len(pairs),
    }
    for name, expected in EXPERT_V3_EXPECTED_COUNTS.items():
        if actual_counts[name] != expected:
            issues.append(
                _issue(
                    "source.count_changed",
                    "00_Guide",
                    f"{name} 应为 {expected}，实际为 {actual_counts[name]}。",
                )
            )

    coverage_rows = data.raw_sheets.get("07_Coverage", [])
    coverage_text = " ".join(str(value) for row in coverage_rows for value in row if value)
    if "By stage" not in coverage_text or "By knowledge type" not in coverage_text:
        issues.append(
            _issue(
                "derived.coverage_layout_changed",
                "07_Coverage",
                "覆盖率 Sheet 的阶段或知识类型统计区缺失。",
            )
        )
    if Counter(str(row.get("Type")) for row in data.sheets.get("03_L3_Knowledge", [])) != Counter(
        {
            "Concept": 14,
            "Correspondence": 3,
            "Cross-cultural": 9,
            "Legal": 30,
            "Procedure": 33,
            "Risk": 5,
            "Strategy": 24,
        }
    ):
        issues.append(
            _issue(
                "derived.knowledge_type_count_changed",
                "07_Coverage",
                "七类知识点数量与专家基线不一致。",
            )
        )
    return issues
