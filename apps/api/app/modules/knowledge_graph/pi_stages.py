# [导读] 所属业务: 教学知识图谱、学习内容与证据。
# [导读] 业务名词: 图谱用节点与关系表达阶段、商务现象、知识点和策略; Scaffold 是本次训练固定的学
# [导读] 习支持库。
# [导读] 用途与原因: 将原专家图谱分类转换为 PI 十阶段结构; 先严格核对原始稳定编号, 再做语义拆分,
# [导读] 保留归档工作簿。
# [导读] 结构: pi_scenarios、normalize_pi_source、validate_pi_baseline。
# [导读] 提醒: graph_version 与 node_key 一起定位内容; 显示短名不等于稳定编号, 历史证据不能随当
# [导读] 前图谱重写。
"""Versioned PI classification; the archived expert workbook remains unchanged."""

from __future__ import annotations

from collections import Counter, defaultdict
from copy import deepcopy

from app.modules.knowledge_graph.types import ImportIssue, ParsedWorkbookData
from app.modules.knowledge_graph.v3_extensions import V3_SCENARIOS, V3ScenarioBinding

PI_COMPILER_VERSION = "expert-pi-compiler/3.1.0"
PI_STAGES = (
    ("询盘谈判", "Inquiry"),
    ("报盘谈判", "Offer"),
    ("还盘谈判", "Counter-offer"),
    ("接受与订货谈判", "Acceptance & Order"),
    ("包装与装运谈判", "Packing & Shipment"),
    ("付款与交货谈判", "Payment & Delivery"),
    ("商检谈判", "Inspection"),
    ("保险与仲裁谈判", "Insurance & Arbitration"),
    ("投诉处理谈判", "Complaint"),
    ("索赔与理赔谈判", "Claim & Settlement"),
)
CLAIM_PHENOMENA = frozenset({"P9.03", "P9.04", "P9.05", "P9.06", "P9.07"})
CLAIM_KNOWLEDGE = frozenset(f"K{number}" for number in range(110, 119))


def pi_scenarios() -> tuple[V3ScenarioBinding, ...]:
    result = deepcopy(V3_SCENARIOS)
    for scenario in result:
        if scenario["id"] in {"S18", "S19", "S20"}:
            scenario["stage_id"] = "S10"
    return result


# [导读] 校验旧版身份后执行已约定的阶段拆分, 保留事实编号, 使新分类仍能追溯到原始资料。
def normalize_pi_source(
    source: ParsedWorkbookData,
    translations: dict[str, list[dict[str, object]]],
) -> tuple[ParsedWorkbookData, dict[str, list[dict[str, object]]]]:
    """Apply the approved split after strict 3.0 source validation, without renumbering facts."""
    data, overlay = deepcopy(source), deepcopy(translations)
    rows = data.sheets
    if [str(row["Stage ID"]) for row in rows["01_L1_Stages"]] != [f"S{i}" for i in range(1, 10)]:
        raise ValueError("PI migration requires the ordered S1–S9 source baseline.")
    stages = rows["01_L1_Stages"]
    stages.append({**deepcopy(stages[-1]), "Stage ID": "S10", "__row__": 0})
    overlay["stages"].append({**deepcopy(overlay["stages"][-1]), "id": "S10"})
    zh_by_id = {str(item["id"]): item for item in overlay["stages"]}
    for index, (row, (zh, en)) in enumerate(zip(stages, PI_STAGES, strict=True), 1):
        row.update({"Seq": index, "Stage name": en, "Short": en})
        zh_by_id[str(row["Stage ID"])]["name_zh"] = zh
    for index, description, outcome, zh_description, zh_outcome in (
        (
            8,
            "Receive dissatisfaction, investigate facts and recover service.",
            "Acknowledge a complaint, investigate and agree on corrective action.",
            "受理不满、调查事实、沟通纠正措施并跟踪服务恢复；区分投诉与正式索赔。",
            "能够确认投诉、澄清事实、协商处理方案并记录预防措施。",
        ),
        (
            9,
            "Negotiate evidence-based claims, remedies and final settlement.",
            "Identify responsibility, substantiate loss and negotiate a documented settlement.",
            "围绕责任、证据、时效和损失协商索赔与理赔，形成书面和解结果。",
            "能够提出有依据的索赔、回应抗辩、核算补偿并确认结案条款。",
        ),
    ):
        stages[index].update({"Description": description, "OBE teaching outcome": outcome})
        zh_by_id[f"S{index + 1}"].update(
            {"description_zh": zh_description, "obe_outcome_zh": zh_outcome}
        )
    names = {str(row["Stage ID"]): row["Stage name"] for row in stages}
    phenomenon_stage: dict[str, str] = {}
    for row in rows["02_L2_Phenomena"]:
        identifier = str(row["Phenomenon ID"])
        if identifier in CLAIM_PHENOMENA:
            row["Stage ID"] = "S10"
        row["Stage"] = names[str(row["Stage ID"])]
        phenomenon_stage[identifier] = str(row["Stage ID"])
    knowledge_phenomena: dict[str, set[str]] = defaultdict(set)
    for sheet in ("04_Edges", "05_Master_Graph"):
        for row in rows[sheet]:
            stage = phenomenon_stage[str(row["Phenomenon ID"])]
            row["Stage ID"] = stage
            row["Stage" if sheet == "04_Edges" else "Level 1 — Stage"] = names[stage]
            if sheet == "05_Master_Graph":
                row["Seq"] = int(stage[1:])
            else:
                knowledge_phenomena[str(row["Knowledge ID"])].add(str(row["Phenomenon ID"]))
    for row in rows["03_L3_Knowledge"]:
        identifier = str(row["Knowledge ID"])
        if identifier in CLAIM_KNOWLEDGE:
            row["Home stage ID"] = "S10"
        row["Home stage"] = names[str(row["Home stage ID"])]
        row["Phenomena served"] = len(knowledge_phenomena[identifier])
        row["Stages served"] = len({phenomenon_stage[p] for p in knowledge_phenomena[identifier]})
    knowledge = {str(row["Knowledge ID"]): row for row in rows["03_L3_Knowledge"]}
    for row in rows["06_Knowledge_Index"]:
        identifier = str(row["Knowledge ID"])
        row["Home stage"] = knowledge[identifier]["Home stage"]
        row["Also used in stages"] = "; ".join(
            str(names[stage])
            for stage in sorted(
                {phenomenon_stage[p] for p in knowledge_phenomena[identifier]}
                - {str(knowledge[identifier]["Home stage ID"])},
                key=lambda s: int(s[1:]),
            )
        )
    phenomenon_counts = Counter(phenomenon_stage.values())
    home_counts = Counter(str(row["Home stage ID"]) for row in knowledge.values())
    for row in stages:
        row["Phenomena (L2)"] = phenomenon_counts[str(row["Stage ID"])]
        row["Home knowledge (L3)"] = home_counts[str(row["Stage ID"])]
    return data, overlay


# [导读] 先拒绝非预期编号与阶段顺序, 再允许语义迁移, 避免把另一份工作簿误当成目标基线。
def validate_pi_baseline(data: ParsedWorkbookData) -> list[ImportIssue]:
    """Reject unsupported identities before translation lookup or semantic splitting."""
    checks = (
        ("01_L1_Stages", "Stage ID", {f"S{i}" for i in range(1, 10)}),
        (
            "02_L2_Phenomena",
            "Phenomenon ID",
            {
                f"P{stage}.{number:02d}"
                for stage, count in enumerate((7, 7, 7, 7, 8, 7, 7, 7, 9), 1)
                for number in range(1, count + 1)
            },
        ),
        ("03_L3_Knowledge", "Knowledge ID", {f"K{i:03d}" for i in range(1, 119)}),
    )
    issues = []
    for sheet, field, expected in checks:
        if {str(r.get(field)) for r in data.sheets.get(sheet, [])} != expected:
            issues.append(
                ImportIssue(
                    severity="error",
                    code="pi.source_identity_changed",
                    sheet_name=sheet,
                    message="十阶段迁移需要原始专家稳定编号，发现未知或缺失编号。",
                )
            )
    stage_ids = [str(r.get("Stage ID")) for r in data.sheets.get("01_L1_Stages", [])]
    if stage_ids != [f"S{i}" for i in range(1, 10)]:
        issues.append(
            ImportIssue(
                severity="error",
                code="pi.stage_order_changed",
                sheet_name="01_L1_Stages",
                message="迁移输入必须按 S1 至 S9 排序。",
            )
        )
    return issues
