from __future__ import annotations

from collections import defaultdict

from app.modules.knowledge_graph.types import ImportIssue, ParsedWorkbookData
from app.modules.knowledge_graph.v2_contract import V2_ID_COLUMNS, V2_REQUIRED_COLUMNS

ALLOWED_RELATIONS = {"HAS_PHENOMENON", "REQUIRES_RESOURCE", "REQUIRES_STRATEGY"}
ALLOWED_CONTENT_TYPES = {"KnowledgeResource", "NegotiationStrategy"}


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


def validate_teacher_workbook_v2(data: ParsedWorkbookData) -> list[ImportIssue]:
    issues = list(data.issues)
    identifiers: dict[str, str] = {}
    for sheet, required in V2_REQUIRED_COLUMNS.items():
        seen: set[str] = set()
        id_column = V2_ID_COLUMNS.get(sheet)
        for row in data.sheets.get(sheet, []):
            for column in required:
                if row.get(column) in ("", None):
                    issues.append(
                        _issue("content.required", sheet, "必填内容不能为空。", row, column)
                    )
            if id_column:
                identifier = str(row.get(id_column, "")).strip()
                if identifier in seen:
                    issues.append(
                        _issue(
                            "content.identifier_duplicate",
                            sheet,
                            f"编号 {identifier} 重复。",
                            row,
                            id_column,
                        )
                    )
                seen.add(identifier)
                if sheet != "LearningContent":
                    identifiers[identifier] = sheet

    scenarios = {str(row.get("ScenarioID")) for row in data.sheets.get("Scenarios", [])}
    phenomena = {str(row.get("PhenomenonID")) for row in data.sheets.get("Phenomena", [])}
    resources = {str(row.get("ResourceID")) for row in data.sheets.get("KnowledgeResources", [])}
    strategies = {
        str(row.get("StrategyID")) for row in data.sheets.get("NegotiationStrategies", [])
    }
    for row in data.sheets.get("Phenomena", []):
        if str(row.get("ScenarioID")) not in scenarios:
            issues.append(
                _issue(
                    "reference.scenario_missing",
                    "Phenomena",
                    "引用的场景不存在。",
                    row,
                    "ScenarioID",
                )
            )

    relation_counts: dict[str, int] = defaultdict(int)
    for row in data.sheets.get("GraphRelations(Edges)", []):
        source = str(row.get("SourceID"))
        target = str(row.get("TargetID"))
        relation = str(row.get("RelationType"))
        if relation not in ALLOWED_RELATIONS:
            issues.append(
                _issue("relation.type_invalid", "GraphRelations(Edges)", "关系类型不受支持。", row)
            )
            continue
        valid = (
            (relation == "HAS_PHENOMENON" and source in scenarios and target in phenomena)
            or (relation == "REQUIRES_RESOURCE" and source in phenomena and target in resources)
            or (relation == "REQUIRES_STRATEGY" and source in phenomena and target in strategies)
        )
        if not valid:
            issues.append(
                _issue(
                    "relation.reference_invalid",
                    "GraphRelations(Edges)",
                    "关系端点不存在或类型不匹配。",
                    row,
                )
            )
        relation_counts[source] += 1

    for scenario_id in scenarios:
        if relation_counts[scenario_id] == 0:
            issues.append(
                _issue(
                    "teaching.scenario_unlinked",
                    "GraphRelations(Edges)",
                    f"场景 {scenario_id} 未关联关键局面。",
                )
            )
    for phenomenon_id in phenomena:
        if relation_counts[phenomenon_id] == 0:
            issues.append(
                _issue(
                    "teaching.phenomenon_unlinked",
                    "GraphRelations(Edges)",
                    f"关键局面 {phenomenon_id} 未关联资源或策略。",
                )
            )

    content_ids: set[str] = set()
    for row in data.sheets.get("LearningContent", []):
        node_id = str(row.get("NodeID"))
        node_type = str(row.get("NodeType"))
        if node_type not in ALLOWED_CONTENT_TYPES:
            issues.append(
                _issue(
                    "content.node_type_invalid",
                    "LearningContent",
                    "内容节点类型无效。",
                    row,
                    "NodeType",
                )
            )
        if node_id not in resources | strategies:
            issues.append(
                _issue(
                    "content.node_missing",
                    "LearningContent",
                    "学习内容未对应知识或策略节点。",
                    row,
                    "NodeID",
                )
            )
        content_ids.add(node_id)
    for node_id in sorted((resources | strategies) - content_ids):
        issues.append(
            _issue(
                "content.learning_content_missing",
                "LearningContent",
                f"节点 {node_id} 缺少学习内容。",
            )
        )

    weights: dict[str, float] = defaultdict(float)
    for row in data.sheets.get("Rubrics", []):
        scenario_id = str(row.get("ScenarioID"))
        if scenario_id not in scenarios:
            issues.append(
                _issue(
                    "reference.scenario_missing", "Rubrics", "引用的场景不存在。", row, "ScenarioID"
                )
            )
        try:
            weights[scenario_id] += float(str(row.get("WeightPercent", 0)))
        except (TypeError, ValueError):
            issues.append(
                _issue("rubric.weight_invalid", "Rubrics", "权重必须是数字。", row, "WeightPercent")
            )
    for scenario_id, total in weights.items():
        if abs(total - 100) > 0.001:
            issues.append(
                _issue(
                    "rubric.weight_total",
                    "Rubrics",
                    f"场景 {scenario_id} 的量规权重合计必须为 100%。",
                )
            )
    return issues
