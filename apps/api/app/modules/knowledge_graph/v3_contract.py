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
