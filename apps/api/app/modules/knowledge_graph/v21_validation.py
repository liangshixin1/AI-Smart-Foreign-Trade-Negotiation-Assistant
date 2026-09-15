# [导读] 所属业务: 教学知识图谱、学习内容与证据。
# [导读] 业务名词: 图谱用节点与关系表达阶段、商务现象、知识点和策略; Scaffold 是本次训练固定的学
# [导读] 习支持库。
# [导读] 用途与原因: 按 2.1 版知识点与学习内容契约校验工作簿; 校验问题保留表名和行列, 便于修改源
# [导读] 数据。
# [导读] 结构: _issue、validate_teacher_workbook_v21。
# [导读] 提醒: graph_version 与 node_key 一起定位内容; 显示短名不等于稳定编号, 历史证据不能随当
# [导读] 前图谱重写。
from __future__ import annotations

from collections import defaultdict

from app.modules.knowledge_graph.types import ImportIssue, ParsedWorkbookData
from app.modules.knowledge_graph.v21_contract import V21_ID_COLUMNS, V21_REQUIRED_COLUMNS

ALLOWED_RELATIONS = {"REQUIRES_RESOURCE", "REQUIRES_STRATEGY"}
ALLOWED_CONTENT_TYPES = {"KnowledgeResource", "NegotiationStrategy"}
ALLOWED_RISK_VALUES = {"高", "中", "低"}
ALLOWED_FREQUENCY_VALUES = {"高", "中", "低"}


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


def validate_teacher_workbook_v21(data: ParsedWorkbookData) -> list[ImportIssue]:
    issues = list(data.issues)
    for sheet, required in V21_REQUIRED_COLUMNS.items():
        seen: set[str] = set()
        id_column = V21_ID_COLUMNS.get(sheet)
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

    stages = {str(row.get("StageID")) for row in data.sheets.get("Stages", [])}
    scenarios = {str(row.get("ScenarioID")) for row in data.sheets.get("Scenarios", [])}
    phenomena = {str(row.get("PhenomenonID")) for row in data.sheets.get("Phenomena", [])}
    resources = {str(row.get("ResourceID")) for row in data.sheets.get("KnowledgeResources", [])}
    strategies = {
        str(row.get("StrategyID")) for row in data.sheets.get("NegotiationStrategies", [])
    }

    for sheet in ("Scenarios", "Phenomena"):
        for row in data.sheets.get(sheet, []):
            if str(row.get("StageID")) not in stages:
                issues.append(
                    _issue(
                        "reference.stage_missing", sheet, "引用的一级主题不存在。", row, "StageID"
                    )
                )
    for row in data.sheets.get("Phenomena", []):
        if str(row.get("Risk")) not in ALLOWED_RISK_VALUES:
            issues.append(
                _issue("content.risk_invalid", "Phenomena", "风险只能填写高、中或低。", row, "Risk")
            )
        if str(row.get("Frequency")) not in ALLOWED_FREQUENCY_VALUES:
            issues.append(
                _issue(
                    "content.frequency_invalid",
                    "Phenomena",
                    "频率只能填写高、中或低。",
                    row,
                    "Frequency",
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
            relation == "REQUIRES_RESOURCE" and source in phenomena and target in resources
        ) or (relation == "REQUIRES_STRATEGY" and source in phenomena and target in strategies)
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
    for phenomenon_id in phenomena:
        if relation_counts[phenomenon_id] == 0:
            issues.append(
                _issue(
                    "teaching.phenomenon_unlinked",
                    "GraphRelations(Edges)",
                    f"教学现象 {phenomenon_id} 未关联知识资源或策略。",
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
    for scenario_id in scenarios:
        if abs(weights[scenario_id] - 100) > 0.001:
            issues.append(
                _issue(
                    "rubric.weight_total",
                    "Rubrics",
                    f"场景 {scenario_id} 的量规权重合计必须为 100%。",
                )
            )
    return issues
