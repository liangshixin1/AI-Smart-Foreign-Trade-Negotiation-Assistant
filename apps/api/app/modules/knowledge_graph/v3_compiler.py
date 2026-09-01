from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

from app.modules.knowledge_graph.compiler import GraphBuilder
from app.modules.knowledge_graph.schemas import CompiledGraph
from app.modules.knowledge_graph.types import ParsedWorkbookData
from app.modules.knowledge_graph.v3_extensions import V3_SCENARIOS

COMPILER_VERSION_V3 = "expert-fact-compiler/3.0"


def load_translation_payload() -> dict[str, list[dict[str, object]]]:
    path = (
        Path(__file__).resolve().parents[5]
        / "content/knowledge-graph/translations/expert-v3-zh.json"
    )
    payload: dict[str, list[dict[str, object]]] = json.loads(path.read_text(encoding="utf-8"))
    return payload


def _translations() -> dict[str, dict[str, dict[str, object]]]:
    payload = load_translation_payload()
    return {
        group: {str(item["id"]): item for item in payload.get(group, [])}
        for group in ("stages", "phenomena", "knowledge")
    }


def _row_properties(row: dict[str, object], *fields: str) -> dict[str, object]:
    return {field: row[field] for field in fields if row.get(field) not in (None, "")}


def compile_expert_workbook_v3(
    data: ParsedWorkbookData,
    active_keys: set[str] | None = None,
) -> CompiledGraph:
    """编译专家事实层, 并叠加课程场景与可撤除提示, 不改变专家分类。"""

    builder = GraphBuilder(active_keys or set())
    translations = _translations()
    stages: dict[str, str] = {}
    phenomena: dict[str, str] = {}
    knowledge: dict[str, str] = {}
    phenomena_by_stage: dict[str, list[str]] = defaultdict(list)

    for row in data.sheets["01_L1_Stages"]:
        identifier = str(row["Stage ID"])
        zh = translations["stages"][identifier]
        properties = {
            **_row_properties(
                row,
                "Stage ID",
                "Seq",
                "Stage name",
                "Short",
                "Description",
                "OBE teaching outcome",
                "Phenomena (L2)",
                "Home knowledge (L3)",
            ),
            "StageID": identifier,
            "StageNameEN": row["Stage name"],
            "StageNameZH": zh["name_zh"],
            "ShortNameZH": zh["short_name_zh"],
            "DescriptionEN": row["Description"],
            "DescriptionZH": zh["description_zh"],
            "OBETeachingOutcomeEN": row["OBE teaching outcome"],
            "OBETeachingOutcomeZH": zh["obe_outcome_zh"],
            "translation_status": "reviewed",
        }
        stages[identifier] = builder.node(
            f"stage:{identifier}", "Stage", properties, "01_L1_Stages", row
        )

    for row in data.sheets["02_L2_Phenomena"]:
        identifier = str(row["Phenomenon ID"])
        stage_id = str(row["Stage ID"])
        zh = translations["phenomena"][identifier]
        properties = {
            **_row_properties(row, "Risk", "Frequency", "Linked L3 count"),
            "PhenomenonID": identifier,
            "StageID": stage_id,
            "PhenomenonNameEN": row["Phenomenon (business problem)"],
            "PhenomenonNameZH": zh["name_zh"],
            "ShortNameZH": zh["short_name_zh"],
            "DescriptionEN": row["Brief description"],
            "DescriptionZH": zh["description_zh"],
            "translation_status": "reviewed",
        }
        key = builder.node(
            f"phenomenon:{identifier}", "Phenomenon", properties, "02_L2_Phenomena", row
        )
        phenomena[identifier] = key
        phenomena_by_stage[stage_id].append(identifier)
        builder.relation(stages[stage_id], "CONTAINS_PHENOMENON", key)

    for row in data.sheets["03_L3_Knowledge"]:
        identifier = str(row["Knowledge ID"])
        zh = translations["knowledge"][identifier]
        properties = {
            **_row_properties(row, "Phenomena served", "Stages served"),
            "KnowledgeID": identifier,
            "KnowledgeTypeCode": row["Type"],
            "Type": row["Type"],
            "HomeStageID": row["Home stage ID"],
            "KnowledgeNameEN": row["Name"],
            "KnowledgeNameZH": zh["name_zh"],
            "ShortNameZH": zh["short_name_zh"],
            "DefinitionEN": row["Definition"],
            "DefinitionZH": zh["definition_zh"],
            "translation_status": "reviewed",
        }
        knowledge[identifier] = builder.node(
            f"knowledge:{identifier}",
            "KnowledgePoint",
            properties,
            "03_L3_Knowledge",
            row,
        )

    for row in data.sheets["04_Edges"]:
        phenomenon_id = str(row["Phenomenon ID"])
        knowledge_id = str(row["Knowledge ID"])
        builder.relation(
            phenomena[phenomenon_id],
            "REQUIRES_KNOWLEDGE",
            knowledge[knowledge_id],
            {
                "AddressingNoteEN": row["How this knowledge addresses the phenomenon"],
                "AddressingNoteZH": "该知识点用于识别、分析或处理此业务现象。",
                "translation_status": "draft",
            },
        )

    scenario_keys: dict[str, str] = {}
    for scenario in V3_SCENARIOS:
        scenario_id = scenario["id"]
        stage_id = scenario["stage_id"]
        key = builder.node(
            f"scenario:{scenario_id}",
            "Scenario",
            {
                "ScenarioID": scenario_id,
                "StageID": stage_id,
                "ScenarioName": scenario["title"],
                "ShortNameZH": scenario["title"],
                "CourseUnit": scenario["unit"],
                "对应课程小节（必填）": scenario["unit"],
                "TrainingMode": scenario["mode"],
                "mapping_source": "platform_extension",
            },
            "PlatformScenarioBindings",
            {"__row__": int(scenario_id[1:])},
        )
        scenario_keys[scenario_id] = key
        builder.relation(stages[stage_id], "CONTAINS_SCENARIO", key)

    # 分级线索是平台教学层: 每个现象提供先诊断、后行动两级提示。
    for phenomenon_id, phenomenon_key in phenomena.items():
        phenomenon_zh = translations["phenomena"][phenomenon_id]
        for level, content in (
            ("一级", f"先判断当前话语是否体现“{phenomenon_zh['short_name_zh']}”，并找出依据。"),
            ("二级", "从右侧知识点中选择一个可执行原则，把它转化为下一句谈判表达。"),
        ):
            scaffold_id = f"{phenomenon_id}-L{1 if level == '一级' else 2}"
            scaffold_key = builder.node(
                f"scaffold:{scaffold_id}",
                "Scaffold",
                {
                    "ScaffoldID": scaffold_id,
                    "提示等级（必填）": level,
                    "何时触发（必填）": "学生需要线索或连续未处理该现象时",
                    "提示内容（必填）": content,
                    "WithdrawalCondition": "学生能够独立识别并采取行动后撤除",
                },
                "PlatformScaffolds",
                {"__row__": 0},
            )
            builder.relation(scaffold_key, "SCAFFOLDS", phenomenon_key)

    edge_rows = data.sheets["04_Edges"]
    knowledge_types = {
        str(row["Knowledge ID"]): str(row["Type"]) for row in data.sheets["03_L3_Knowledge"]
    }
    preview: list[dict[str, object]] = []
    for scenario in V3_SCENARIOS:
        stage_id = scenario["stage_id"]
        phenomenon_ids = set(phenomena_by_stage[stage_id])
        linked_ids = {
            str(row["Knowledge ID"])
            for row in edge_rows
            if str(row["Phenomenon ID"]) in phenomenon_ids
        }
        strategy_count = sum(
            knowledge_types[knowledge_id] == "Strategy" for knowledge_id in linked_ids
        )
        preview.append(
            {
                "scenario_id": scenario["id"],
                "stage_id": stage_id,
                "title": scenario["title"],
                "course_unit": scenario["unit"],
                "training_mode": scenario["mode"],
                "phenomenon_count": len(phenomenon_ids),
                "knowledge_point_count": len(linked_ids),
                "knowledge_resource_count": len(linked_ids) - strategy_count,
                "strategy_count": strategy_count,
            }
        )

    nodes = list(builder.nodes.values())
    relationships = list(builder.relationships.values())
    counts = Counter(str(node["type"]) for node in nodes)
    type_counts = Counter(str(row["Type"]) for row in data.sheets["03_L3_Knowledge"])
    return CompiledGraph(
        teaching_preview=preview,
        nodes=nodes,
        relationships=relationships,
        summary={
            "stage_count": len(stages),
            "case_count": len(scenario_keys),
            "phenomenon_count": len(phenomena),
            "knowledge_point_count": len(knowledge),
            "knowledge_resource_count": len(knowledge) - type_counts["Strategy"],
            "strategy_count": type_counts["Strategy"],
            "scaffold_count": counts["Scaffold"],
            "node_count": len(nodes),
            "relationship_count": len(relationships),
            "teacher_node_count": len(stages)
            + len(scenario_keys)
            + len(phenomena)
            + len(knowledge),
            "teacher_edge_count": len(phenomena) + len(edge_rows) + len(scenario_keys),
            "new_node_count": sum(node["change_type"] == "new" for node in nodes),
            "reused_node_count": sum(node["change_type"] == "reused" for node in nodes),
            "conflict_count": 0,
        },
    )
