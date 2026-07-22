from __future__ import annotations

import hashlib
from collections import defaultdict

from app.modules.knowledge_graph.contract import CASE_COLUMN
from app.modules.knowledge_graph.schemas import CompiledGraph
from app.modules.knowledge_graph.types import ParsedWorkbookData

COMPILER_VERSION = "teacher-dsl-compiler/1.0"
RESOURCE_NODE_TYPES = {
    "术语": "Terminology",
    "规则": "TradeRule",
    "单证": "DocumentKnowledge",
    "业务流程": "BusinessProcess",
    "语言表达": "CommunicationKnowledge",
    "产品与市场": "MarketKnowledge",
}


def _slug(value: object) -> str:
    text = " ".join(str(value).strip().lower().split())
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def _properties(row: dict[str, object], *fields: str) -> dict[str, object]:
    return {field: row.get(field, "") for field in fields if row.get(field) not in ("", None)}


class GraphBuilder:
    def __init__(self, active_keys: set[str]) -> None:
        self.active_keys = active_keys
        self.nodes: dict[str, dict[str, object]] = {}
        self.relationships: dict[str, dict[str, object]] = {}

    def node(
        self,
        key: str,
        node_type: str,
        properties: dict[str, object],
        sheet: str,
        row: dict[str, object],
    ) -> str:
        anchor = {"sheet": sheet, "row": row.get("__row__")}
        existing = self.nodes.get(key)
        if existing:
            anchors = existing["source_anchors"]
            if isinstance(anchors, list):
                anchors.append(anchor)
            return key
        self.nodes[key] = {
            "stable_key": key,
            "type": node_type,
            "properties": properties,
            "source_anchors": [anchor],
            "change_type": "reused" if key in self.active_keys else "new",
        }
        return key

    def relation(
        self,
        source: str,
        relation_type: str,
        target: str,
        properties: dict[str, object] | None = None,
    ) -> None:
        key = f"{source}|{relation_type}|{target}"
        self.relationships[key] = {
            "stable_key": key,
            "source": source,
            "type": relation_type,
            "target": target,
            "properties": properties or {},
        }


def _group_by_case(data: ParsedWorkbookData) -> dict[str, dict[str, list[dict[str, object]]]]:
    grouped: dict[str, dict[str, list[dict[str, object]]]] = defaultdict(lambda: defaultdict(list))
    for sheet, rows in data.sheets.items():
        for row in rows:
            grouped[str(row.get(CASE_COLUMN))][sheet].append(row)
    return grouped


def _compile_case(
    builder: GraphBuilder,
    case: dict[str, object],
    related: dict[str, list[dict[str, object]]],
) -> dict[str, object]:
    case_id = str(case[CASE_COLUMN])
    scenario_key = builder.node(
        f"scenario:{case_id}",
        "Scenario",
        _properties(
            case,
            CASE_COLUMN,
            "案例名称（必填）",
            "对应课程小节（必填）",
            "训练方式（必填）",
            "背景故事（必填）",
            "关键约束条件（必填）",
            "难度",
        ),
        "01_案例总表",
        case,
    )
    student_role = builder.node(
        f"role:student:{_slug(case['学生角色（必填）'])}",
        "StudentRole",
        {"name": case["学生角色（必填）"]},
        "01_案例总表",
        case,
    )
    counterparty_role = builder.node(
        f"role:counterparty:{_slug(case['AI 对手角色（必填）'])}",
        "CounterpartyRole",
        {"name": case["AI 对手角色（必填）"]},
        "01_案例总表",
        case,
    )
    goal = builder.node(
        f"goal:{case_id}",
        "LearningOutcome",
        {"学生任务": case["学生任务（必填）"], "核心成果": case["本案例核心成果（必填）"]},
        "01_案例总表",
        case,
    )
    builder.relation(scenario_key, "ASSIGNS_ROLE", student_role)
    builder.relation(scenario_key, "SIMULATES_COUNTERPARTY", counterparty_role)
    builder.relation(scenario_key, "TARGETS_OUTCOME", goal)

    situations: dict[str, tuple[str, dict[str, object]]] = {}
    for row in related.get("02_关键局面", []):
        situation_id = str(row["局面编号（必填）"])
        key = builder.node(
            f"phenomenon:{case_id}:{situation_id}",
            "Phenomenon",
            _properties(
                row,
                "学生会看到/听到什么（必填）",
                "教师希望学生识别什么（必填）",
                "不识别的业务后果（必填）",
                "出现顺序",
            ),
            "02_关键局面",
            row,
        )
        situations[situation_id] = (key, row)
        builder.relation(scenario_key, "EXPOSES", key)

    strategy_preview: list[dict[str, object]] = []
    for row in related.get("03_应对策略", []):
        situation_id = str(row["局面编号（必填）"])
        strategy_id = str(row["策略编号（必填）"])
        key = builder.node(
            f"strategy:{case_id}:{situation_id}:{strategy_id}",
            "NegotiationStrategy",
            _properties(
                row,
                "策略名称（必填）",
                "适用条件（必填）",
                "学生应采取的行动（必填）",
                "可参考英文表达",
                "不建议的做法",
                "预期影响（必填）",
            ),
            "03_应对策略",
            row,
        )
        builder.relation(key, "ADDRESSES", situations[situation_id][0])
        strategy_preview.append(
            {
                "situation_id": situation_id,
                "name": row["策略名称（必填）"],
                "action": row["学生应采取的行动（必填）"],
            }
        )

    resources: list[dict[str, object]] = []
    for row in related.get("04_知识与材料", []):
        resource_type = str(row["类型（必填）"])
        title = row["标题（必填）"]
        key = builder.node(
            f"knowledge:{RESOURCE_NODE_TYPES[resource_type]}:{_slug(title)}",
            RESOURCE_NODE_TYPES[resource_type],
            _properties(
                row,
                "标题（必填）",
                "教师解释（必填）",
                "参考来源/文件",
                "学习要求",
                "展示时机",
            ),
            "04_知识与材料",
            row,
        )
        situation_id = str(row.get("局面编号", ""))
        target = situations[situation_id][0] if situation_id else scenario_key
        builder.relation(key, "SUPPORTS", target, {"教学关系": row["与本案例的关系（必填）"]})
        resources.append({"type": resource_type, "title": title, "timing": row.get("展示时机", "")})

    scaffolds: list[dict[str, object]] = []
    for row in related.get("05_分级提示", []):
        situation_id = str(row["局面编号（必填）"])
        hint_id = str(row["提示编号（必填）"])
        key = builder.node(
            f"scaffold:{case_id}:{situation_id}:{hint_id}",
            "Scaffold",
            _properties(
                row,
                "何时触发（必填）",
                "提示等级（必填）",
                "提示形式",
                "提示内容（必填）",
                "何时撤除（必填）",
            ),
            "05_分级提示",
            row,
        )
        builder.relation(key, "SCAFFOLDS", situations[situation_id][0])
        scaffolds.append(
            {
                "situation_id": situation_id,
                "level": row["提示等级（必填）"],
                "trigger": row["何时触发（必填）"],
            }
        )

    rubrics: list[dict[str, object]] = []
    for row in related.get("06_评价量规", []):
        dimension = row["评价维度（必填）"]
        key = builder.node(
            f"rubric:{case_id}:{_slug(dimension)}",
            "RubricDimension",
            _properties(
                row,
                "评价维度（必填）",
                "权重%（必填）",
                "重点观察（必填）",
                "未达标表现（必填）",
                "达标表现（必填）",
                "优秀表现（必填）",
                "需要引用的证据（必填）",
            ),
            "06_评价量规",
            row,
        )
        builder.relation(scenario_key, "ASSESSES_WITH", key)
        rubrics.append({"dimension": dimension, "weight": row["权重%（必填）"]})

    outcomes: list[dict[str, object]] = []
    for row in related.get("07_结果与复盘", []):
        outcome_id = str(row["结果编号（必填）"])
        key = builder.node(
            f"outcome:{case_id}:{outcome_id}",
            "NegotiationOutcome",
            _properties(
                row,
                "结果类别",
                "可能出现的结果（必填）",
                "教师复盘问题（必填）",
                "建议后续练习",
            ),
            "07_结果与复盘",
            row,
        )
        builder.relation(
            scenario_key,
            "MAY_LEAD_TO",
            key,
            {"condition": row["在什么情况下出现（必填）"], "ideal": row.get("理想结果？") == "是"},
        )
        outcomes.append(
            {"result": row["可能出现的结果（必填）"], "ideal": row.get("理想结果？") == "是"}
        )

    return {
        "case_id": case_id,
        "title": case["案例名称（必填）"],
        "course_unit": case["对应课程小节（必填）"],
        "training_mode": case["训练方式（必填）"],
        "task": case["学生任务（必填）"],
        "situations": [
            {
                "situation_id": situation_id,
                "signal": item[1]["学生会看到/听到什么（必填）"],
                "recognition": item[1]["教师希望学生识别什么（必填）"],
            }
            for situation_id, item in situations.items()
        ],
        "strategies": strategy_preview,
        "resources": resources,
        "scaffolds": scaffolds,
        "rubrics": rubrics,
        "outcomes": outcomes,
    }


def compile_teacher_workbook(
    data: ParsedWorkbookData, active_keys: set[str] | None = None
) -> CompiledGraph:
    builder = GraphBuilder(active_keys or set())
    grouped = _group_by_case(data)
    previews = [
        _compile_case(builder, case, grouped[str(case[CASE_COLUMN])])
        for case in data.sheets.get("01_案例总表", [])
    ]
    nodes = list(builder.nodes.values())
    relationships = list(builder.relationships.values())
    return CompiledGraph(
        teaching_preview=previews,
        nodes=nodes,
        relationships=relationships,
        summary={
            "case_count": len(previews),
            "node_count": len(nodes),
            "relationship_count": len(relationships),
            "new_node_count": sum(node["change_type"] == "new" for node in nodes),
            "reused_node_count": sum(node["change_type"] == "reused" for node in nodes),
            "conflict_count": 0,
        },
    )
