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
