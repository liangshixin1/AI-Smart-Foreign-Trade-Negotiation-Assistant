from __future__ import annotations

from collections import Counter, defaultdict

from app.modules.knowledge_graph.compiler import GraphBuilder
from app.modules.knowledge_graph.schemas import CompiledGraph
from app.modules.knowledge_graph.types import ParsedWorkbookData

COMPILER_VERSION_V21 = "expert-stage-compiler/2.1"


def _clean(row: dict[str, object], *fields: str) -> dict[str, object]:
    return {field: row[field] for field in fields if row.get(field) not in ("", None)}


def _content_by_node(data: ParsedWorkbookData) -> dict[str, dict[str, object]]:
    return {
        str(row["NodeID"]): _clean(row, "Title", "Summary", "MarkdownContent", "ContentStatus")
        for row in data.sheets.get("LearningContent", [])
    }


def compile_teacher_workbook_v21(
    data: ParsedWorkbookData,
    active_keys: set[str] | None = None,
) -> CompiledGraph:
    """把专家三层图谱编译到现有版本化图存储, 并保持训练与学习内容边界。"""

    builder = GraphBuilder(active_keys or set())
    content = _content_by_node(data)
    stages: dict[str, str] = {}
    scenarios: dict[str, str] = {}
    phenomena: dict[str, str] = {}
    resources: dict[str, str] = {}
    strategies: dict[str, str] = {}

    for row in data.sheets.get("Stages", []):
        identifier = str(row["StageID"])
        stages[identifier] = builder.node(
            f"stage:{identifier}",
            "Stage",
            _clean(
                row,
                "StageID",
                "Sequence",
                "StageNameZH",
                "StageNameEN",
                "ShortNameZH",
                "DescriptionZH",
                "DescriptionEN",
                "OBETeachingOutcomeZH",
                "OBETeachingOutcomeEN",
            ),
            "Stages",
            row,
        )

    for row in data.sheets.get("Scenarios", []):
        identifier = str(row["ScenarioID"])
        properties = _clean(
            row,
            "ScenarioID",
            "StageID",
            "ScenarioName",
            "Background_KeyConstraints",
            "CourseUnit",
            "TrainingMode",
            "StudentRole",
            "CounterpartyRole",
            "StudentTask",
            "CoreOutcome",
            "EstimatedMinutes",
            "Difficulty",
            "ShortNameZH",
        )
        properties["对应课程小节（必填）"] = row["CourseUnit"]
        properties["案例名称（必填）"] = row["ScenarioName"]
        key = builder.node(f"scenario:{identifier}", "Scenario", properties, "Scenarios", row)
        scenarios[identifier] = key
        builder.relation(stages[str(row["StageID"])], "CONTAINS_SCENARIO", key)

        role_key = builder.node(
            f"role:student:{identifier}",
            "StudentRole",
            {"name": row.get("StudentRole", "")},
            "Scenarios",
            row,
        )
        counterparty_key = builder.node(
            f"role:counterparty:{identifier}",
            "CounterpartyRole",
            {"name": row.get("CounterpartyRole", "")},
            "Scenarios",
            row,
        )
        outcome_key = builder.node(
            f"goal:{identifier}",
            "LearningOutcome",
            {
                "student_task": row.get("StudentTask", ""),
                "core_outcome": row.get("CoreOutcome", ""),
            },
            "Scenarios",
            row,
        )
        builder.relation(key, "ASSIGNS_ROLE", role_key)
        builder.relation(key, "SIMULATES_COUNTERPARTY", counterparty_key)
        builder.relation(key, "TARGETS_OUTCOME", outcome_key)

    for row in data.sheets.get("Phenomena", []):
        identifier = str(row["PhenomenonID"])
        properties = _clean(
            row,
            "PhenomenonID",
            "StageID",
            "PhenomenonNameZH",
            "PhenomenonNameEN",
            "DescriptionZH",
            "DescriptionEN",
            "Risk",
            "Frequency",
            "ShortNameZH",
        )
        properties["教师希望学生识别什么（必填）"] = row["PhenomenonNameZH"]
        properties["学生会看到/听到什么（必填）"] = row["DescriptionZH"]
        key = builder.node(f"phenomenon:{identifier}", "Phenomenon", properties, "Phenomena", row)
        phenomena[identifier] = key
        builder.relation(stages[str(row["StageID"])], "CONTAINS_PHENOMENON", key)

    for row in data.sheets.get("KnowledgeResources", []):
        identifier = str(row["ResourceID"])
        properties = {
            **_clean(
                row,
                "ResourceID",
                "Category",
                "ResourceNameZH",
                "ResourceNameEN",
                "DefinitionZH",
                "DefinitionEN",
                "HomeStageID",
                "LearningRequirement",
                "DisplayTiming",
                "ShortNameZH",
            ),
            **content.get(identifier, {}),
        }
        properties["标题（必填）"] = row["ResourceNameZH"]
        properties["教师解释（必填）"] = row["DefinitionZH"]
        resources[identifier] = builder.node(
            f"knowledge:{identifier}",
            "KnowledgeResource",
            properties,
            "KnowledgeResources",
            row,
        )

    for row in data.sheets.get("NegotiationStrategies", []):
        identifier = str(row["StrategyID"])
        properties = {
            **_clean(
                row,
                "StrategyID",
                "StrategyNameZH",
                "StrategyNameEN",
                "DefinitionZH",
                "DefinitionEN",
                "HomeStageID",
                "ApplicableConditions",
                "RecommendedActions",
                "RelatedPhenomenonIDs",
                "ExampleExpression",
                "DiscouragedActions",
                "ExpectedImpact",
                "ShortNameZH",
            ),
            **content.get(identifier, {}),
        }
        properties["策略名称（必填）"] = row["StrategyNameZH"]
        properties["学生应采取的行动（必填）"] = row["RecommendedActions"]
        strategies[identifier] = builder.node(
            f"strategy:{identifier}",
            "NegotiationStrategy",
            properties,
            "NegotiationStrategies",
            row,
        )

    for row in data.sheets.get("GraphRelations(Edges)", []):
        source = str(row["SourceID"])
        target = str(row["TargetID"])
        relation = str(row["RelationType"])
        properties = _clean(row, "AddressingNoteZH", "AddressingNoteEN")
        if relation == "REQUIRES_RESOURCE":
            builder.relation(resources[target], "SUPPORTS", phenomena[source], properties)
        elif relation == "REQUIRES_STRATEGY":
            builder.relation(strategies[target], "ADDRESSES", phenomena[source], properties)

    for row in data.sheets.get("Scaffolds", []):
        identifier = str(row["ScaffoldID"])
        properties = _clean(
            row,
            "ScaffoldID",
            "Trigger",
            "Level",
            "Format",
            "Content",
            "WithdrawalCondition",
            "MaxUses",
        )
        properties.update(
            {
                "何时触发（必填）": row["Trigger"],
                "提示等级（必填）": row["Level"],
                "提示内容（必填）": row["Content"],
            }
        )
        key = builder.node(f"scaffold:{identifier}", "Scaffold", properties, "Scaffolds", row)
        builder.relation(key, "SCAFFOLDS", phenomena[str(row["PhenomenonID"])])

    for row in data.sheets.get("Rubrics", []):
        identifier = str(row["RubricID"])
        properties = _clean(
            row,
            "RubricID",
            "DimensionName",
            "WeightPercent",
            "Focus",
            "BelowStandard",
            "MeetsStandard",
            "Excellent",
            "EvidenceRequired",
            "PerRound",
        )
        properties["评价维度（必填）"] = row["DimensionName"]
        properties["权重%（必填）"] = row["WeightPercent"]
        key = builder.node(f"rubric:{identifier}", "RubricDimension", properties, "Rubrics", row)
        builder.relation(scenarios[str(row["ScenarioID"])], "ASSESSES_WITH", key)

    for row in data.sheets.get("Outcomes", []):
        identifier = str(row["OutcomeID"])
        properties = _clean(
            row,
            "OutcomeID",
            "ResultCategory",
            "PossibleOutcome",
            "ReflectionQuestion",
            "NextPractice",
        )
        properties["可能出现的结果（必填）"] = row["PossibleOutcome"]
        key = builder.node(
            f"outcome:{identifier}", "NegotiationOutcome", properties, "Outcomes", row
        )
        builder.relation(
            scenarios[str(row["ScenarioID"])],
            "MAY_LEAD_TO",
            key,
            {"condition": row["Condition"], "ideal": str(row.get("Ideal")) == "是"},
        )

    phenomenon_ids_by_stage: dict[str, list[str]] = defaultdict(list)
    for row in data.sheets.get("Phenomena", []):
        phenomenon_ids_by_stage[str(row["StageID"])].append(str(row["PhenomenonID"]))
    relation_rows = data.sheets.get("GraphRelations(Edges)", [])
    preview: list[dict[str, object]] = []
    for row in data.sheets.get("Scenarios", []):
        stage_id = str(row["StageID"])
        phenomenon_ids = phenomenon_ids_by_stage[stage_id]
        related = [edge for edge in relation_rows if str(edge["SourceID"]) in phenomenon_ids]
        preview.append(
            {
                "scenario_id": str(row["ScenarioID"]),
                "stage_id": stage_id,
                "title": row["ScenarioName"],
                "course_unit": row["CourseUnit"],
                "training_mode": row["TrainingMode"],
                "phenomenon_count": len(phenomenon_ids),
                "knowledge_resource_count": len(
                    {
                        str(edge["TargetID"])
                        for edge in related
                        if edge["RelationType"] == "REQUIRES_RESOURCE"
                    }
                ),
                "strategy_count": len(
                    {
                        str(edge["TargetID"])
                        for edge in related
                        if edge["RelationType"] == "REQUIRES_STRATEGY"
                    }
                ),
            }
        )

    nodes = list(builder.nodes.values())
    relationships = list(builder.relationships.values())
    counts = Counter(str(node["type"]) for node in nodes)
    return CompiledGraph(
        teaching_preview=preview,
        nodes=nodes,
        relationships=relationships,
        summary={
            "stage_count": len(stages),
            "case_count": len(scenarios),
            "phenomenon_count": counts["Phenomenon"],
            "knowledge_resource_count": counts["KnowledgeResource"],
            "strategy_count": counts["NegotiationStrategy"],
            "node_count": len(nodes),
            "relationship_count": len(relationships),
            "new_node_count": sum(node["change_type"] == "new" for node in nodes),
            "reused_node_count": sum(node["change_type"] == "reused" for node in nodes),
            "conflict_count": 0,
        },
    )
