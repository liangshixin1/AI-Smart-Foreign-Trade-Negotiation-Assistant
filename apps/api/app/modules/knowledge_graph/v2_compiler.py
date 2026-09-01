from __future__ import annotations

from collections import Counter, defaultdict

from app.modules.knowledge_graph.compiler import GraphBuilder
from app.modules.knowledge_graph.schemas import CompiledGraph
from app.modules.knowledge_graph.types import ParsedWorkbookData

COMPILER_VERSION_V2 = "teacher-dsl-compiler/2.0"
RESOURCE_TYPES = {
    "Terminology": "Terminology",
    "TradeRule": "TradeRule",
    "DocumentKnowledge": "DocumentKnowledge",
    "BusinessProcess": "BusinessProcess",
    "CommunicationKnowledge": "CommunicationKnowledge",
    "MarketKnowledge": "MarketKnowledge",
}


def _clean(row: dict[str, object], *fields: str) -> dict[str, object]:
    return {field: row[field] for field in fields if row.get(field) not in ("", None)}


def _content_by_node(data: ParsedWorkbookData) -> dict[str, dict[str, object]]:
    return {
        str(row["NodeID"]): _clean(
            row,
            "Title",
            "Summary",
            "MarkdownContent",
            "ContentStatus",
        )
        for row in data.sheets.get("LearningContent", [])
    }


def compile_teacher_workbook_v2(
    data: ParsedWorkbookData,
    active_keys: set[str] | None = None,
) -> CompiledGraph:
    builder = GraphBuilder(active_keys or set())
    content = _content_by_node(data)
    scenarios: dict[str, str] = {}
    phenomena: dict[str, str] = {}
    resources: dict[str, str] = {}
    strategies: dict[str, str] = {}

    for row in data.sheets.get("Scenarios", []):
        identifier = str(row["ScenarioID"])
        properties = _clean(
            row,
            "ScenarioID",
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
        # 保留消费层既有的课程绑定字段, 避免改变训练 Attempt 与图谱的架构契约。
        properties["对应课程小节（必填）"] = row["CourseUnit"]
        properties["案例名称（必填）"] = row["ScenarioName"]
        key = builder.node(f"scenario:{identifier}", "Scenario", properties, "Scenarios", row)
        scenarios[identifier] = key
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
            "ScenarioID",
            "PhenomenonDescription",
            "TeacherRecognitionPoint",
            "BusinessConsequence",
            "Sequence",
            "MustAppear",
            "DynamicTrigger",
            "ShortNameZH",
        )
        properties["教师希望学生识别什么（必填）"] = row["TeacherRecognitionPoint"]
        properties["学生会看到/听到什么（必填）"] = row["PhenomenonDescription"]
        phenomena[identifier] = builder.node(
            f"phenomenon:{identifier}", "Phenomenon", properties, "Phenomena", row
        )

    for row in data.sheets.get("KnowledgeResources", []):
        identifier = str(row["ResourceID"])
        properties = {
            **_clean(
                row,
                "ResourceID",
                "Category",
                "ResourceName",
                "Definition_Content",
                "ReferenceSource",
                "LearningRequirement",
                "DisplayTiming",
                "ShortNameZH",
            ),
            **content.get(identifier, {}),
        }
        properties["标题（必填）"] = row["ResourceName"]
        properties["教师解释（必填）"] = row["Definition_Content"]
        resources[identifier] = builder.node(
            f"knowledge:{identifier}",
            RESOURCE_TYPES[str(row["Category"])],
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
                "StrategyName",
                "ApplicableConditions",
                "RecommendedActions",
                "ExampleExpression",
                "DiscouragedActions",
                "ExpectedImpact",
                "ShortNameZH",
            ),
            **content.get(identifier, {}),
        }
        properties["策略名称（必填）"] = row["StrategyName"]
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
        if relation == "HAS_PHENOMENON":
            builder.relation(scenarios[source], "EXPOSES", phenomena[target])
        elif relation == "REQUIRES_RESOURCE":
            builder.relation(resources[target], "SUPPORTS", phenomena[source])
        elif relation == "REQUIRES_STRATEGY":
            builder.relation(strategies[target], "ADDRESSES", phenomena[source])

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

    relation_rows = data.sheets.get("GraphRelations(Edges)", [])
    relations_by_scenario: dict[str, list[str]] = defaultdict(list)
    for row in relation_rows:
        if row["RelationType"] == "HAS_PHENOMENON":
            relations_by_scenario[str(row["SourceID"])].append(str(row["TargetID"]))
    preview = []
    for row in data.sheets.get("Scenarios", []):
        scenario_id = str(row["ScenarioID"])
        phenomenon_ids = relations_by_scenario[scenario_id]
        related = [edge for edge in relation_rows if str(edge["SourceID"]) in phenomenon_ids]
        preview.append(
            {
                "scenario_id": scenario_id,
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
            "case_count": len(scenarios),
            "phenomenon_count": counts["Phenomenon"],
            "knowledge_resource_count": sum(counts[item] for item in RESOURCE_TYPES.values()),
            "strategy_count": counts["NegotiationStrategy"],
            "node_count": len(nodes),
            "relationship_count": len(relationships),
            "new_node_count": sum(node["change_type"] == "new" for node in nodes),
            "reused_node_count": sum(node["change_type"] == "reused" for node in nodes),
            "conflict_count": 0,
        },
    )
