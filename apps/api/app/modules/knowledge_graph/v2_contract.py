# [导读] 所属业务: 教学知识图谱、学习内容与证据。
# [导读] 业务名词: 图谱用节点与关系表达阶段、商务现象、知识点和策略; Scaffold 是本次训练固定的学
# [导读] 习支持库。
# [导读] 用途: 定义 2.0 版教师工作簿的表格契约。
# [导读] 为什么: 与该版解析、校验和编译对应, 保留旧格式入口让历史内容可重新核验。
# [导读] 结构: 表格字段及关系常量。
# [导读] 提醒: graph_version 与 node_key 一起定位内容; 显示短名不等于稳定编号, 历史证据不能随当
# [导读] 前图谱重写。
from __future__ import annotations

V2_SHEET_HEADERS: dict[str, tuple[str, ...]] = {
    "Scenarios": (
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
    ),
    "Phenomena": (
        "PhenomenonID",
        "ScenarioID",
        "PhenomenonDescription",
        "TeacherRecognitionPoint",
        "BusinessConsequence",
        "Sequence",
        "MustAppear",
        "DynamicTrigger",
        "ShortNameZH",
    ),
    "KnowledgeResources": (
        "ResourceID",
        "Category",
        "ResourceName",
        "Definition_Content",
        "RelatedPhenomenonIDs",
        "ReferenceSource",
        "LearningRequirement",
        "DisplayTiming",
        "ShortNameZH",
    ),
    "NegotiationStrategies": (
        "StrategyID",
        "StrategyName",
        "ApplicableConditions",
        "RecommendedActions",
        "RelatedPhenomenonIDs",
        "ExampleExpression",
        "DiscouragedActions",
        "ExpectedImpact",
        "ShortNameZH",
    ),
    "GraphRelations(Edges)": ("SourceID", "RelationType", "TargetID"),
    "Scaffolds": (
        "ScaffoldID",
        "PhenomenonID",
        "Trigger",
        "Level",
        "Format",
        "Content",
        "WithdrawalCondition",
        "MaxUses",
    ),
    "Rubrics": (
        "RubricID",
        "ScenarioID",
        "DimensionName",
        "WeightPercent",
        "Focus",
        "BelowStandard",
        "MeetsStandard",
        "Excellent",
        "EvidenceRequired",
        "PerRound",
    ),
    "Outcomes": (
        "OutcomeID",
        "ScenarioID",
        "ResultCategory",
        "PossibleOutcome",
        "Condition",
        "Ideal",
        "ReflectionQuestion",
        "NextPractice",
    ),
    "LearningContent": (
        "NodeID",
        "NodeType",
        "Title",
        "Summary",
        "MarkdownContent",
        "ContentStatus",
    ),
}

# 2.0 初版工作簿没有中文短名列. 导入器继续兼容旧表, 避免已发给教师的
# 模板突然失效; 新模板则以 ShortNameZH 驱动紧凑的图谱标签.
V2_LEGACY_SHEET_HEADERS: dict[str, tuple[str, ...]] = {
    sheet: tuple(column for column in headers if column != "ShortNameZH")
    for sheet, headers in V2_SHEET_HEADERS.items()
}

V2_REQUIRED_COLUMNS: dict[str, tuple[str, ...]] = {
    "Scenarios": ("ScenarioID", "ScenarioName", "CourseUnit", "TrainingMode", "StudentTask"),
    "Phenomena": (
        "PhenomenonID",
        "ScenarioID",
        "PhenomenonDescription",
        "TeacherRecognitionPoint",
    ),
    "KnowledgeResources": ("ResourceID", "Category", "ResourceName", "Definition_Content"),
    "NegotiationStrategies": (
        "StrategyID",
        "StrategyName",
        "ApplicableConditions",
        "RecommendedActions",
    ),
    "GraphRelations(Edges)": ("SourceID", "RelationType", "TargetID"),
    "Scaffolds": ("ScaffoldID", "PhenomenonID", "Trigger", "Level", "Content"),
    "Rubrics": ("RubricID", "ScenarioID", "DimensionName", "WeightPercent", "Focus"),
    "Outcomes": ("OutcomeID", "ScenarioID", "PossibleOutcome", "Condition"),
    "LearningContent": ("NodeID", "NodeType", "Title", "MarkdownContent", "ContentStatus"),
}

V2_ID_COLUMNS: dict[str, str] = {
    "Scenarios": "ScenarioID",
    "Phenomena": "PhenomenonID",
    "KnowledgeResources": "ResourceID",
    "NegotiationStrategies": "StrategyID",
    "Scaffolds": "ScaffoldID",
    "Rubrics": "RubricID",
    "Outcomes": "OutcomeID",
    "LearningContent": "NodeID",
}
