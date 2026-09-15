# [导读] 所属业务: 教学知识图谱、学习内容与证据。
# [导读] 业务名词: 图谱用节点与关系表达阶段、商务现象、知识点和策略; Scaffold 是本次训练固定的学
# [导读] 习支持库。
# [导读] 用途: 定义 3.0 版专家图谱原始字段、关系与知识分类。
# [导读] 为什么: 原始事实与中文展示分离, 保留专家稳定编号才能在翻译和发布时追溯来源。
# [导读] 结构: 表格字段及关系常量。
# [导读] 提醒: graph_version 与 node_key 一起定位内容; 显示短名不等于稳定编号, 历史证据不能随当
# [导读] 前图谱重写。
from __future__ import annotations

EXPERT_V3_TEMPLATE_VERSION = "3.0"
EXPERT_V3_REQUIRED_SHEETS = (
    "00_Guide",
    "01_L1_Stages",
    "02_L2_Phenomena",
    "03_L3_Knowledge",
    "04_Edges",
    "05_Master_Graph",
    "06_Knowledge_Index",
    "07_Coverage",
)

EXPERT_V3_SHEET_HEADERS: dict[str, tuple[str, ...]] = {
    "01_L1_Stages": (
        "Stage ID",
        "Seq",
        "Stage name",
        "Short",
        "Description",
        "OBE teaching outcome",
        "Phenomena (L2)",
        "Home knowledge (L3)",
    ),
    "02_L2_Phenomena": (
        "Phenomenon ID",
        "Stage ID",
        "Stage",
        "Phenomenon (business problem)",
        "Brief description",
        "Risk",
        "Frequency",
        "Linked L3 count",
    ),
    "03_L3_Knowledge": (
        "Knowledge ID",
        "Name",
        "Type",
        "Home stage",
        "Home stage ID",
        "Definition",
        "Phenomena served",
        "Stages served",
    ),
    "04_Edges": (
        "Stage ID",
        "Stage",
        "Phenomenon ID",
        "Phenomenon",
        "Knowledge ID",
        "Knowledge point",
        "Type",
        "How this knowledge addresses the phenomenon",
    ),
    "05_Master_Graph": (
        "Seq",
        "Stage ID",
        "Level 1 — Stage",
        "Phenomenon ID",
        "Level 2 — Business phenomenon",
        "Risk",
        "Knowledge ID",
        "Level 3 — Knowledge / strategy",
        "Type",
        "How it addresses the phenomenon",
        "Knowledge definition",
    ),
    "06_Knowledge_Index": (
        "Knowledge ID",
        "Knowledge point",
        "Type",
        "Home stage",
        "Phenomena served (count)",
        "Linked phenomenon IDs",
        "Linked phenomenon names",
        "Also used in stages",
    ),
}

EXPERT_V3_KNOWLEDGE_TYPES = {
    "Concept": "概念",
    "Correspondence": "函电",
    "Cross-cultural": "跨文化",
    "Legal": "法律规则",
    "Procedure": "业务流程",
    "Risk": "风险管理",
    "Strategy": "策略战术",
}

EXPERT_V3_EXPECTED_COUNTS = {
    "stages": 9,
    "phenomena": 66,
    "knowledge_points": 118,
    "phenomenon_knowledge_edges": 298,
}
