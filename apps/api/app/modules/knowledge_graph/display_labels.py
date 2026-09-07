from __future__ import annotations

LABEL_FIELDS = (
    "StageNameZH",
    "PhenomenonNameZH",
    "ResourceNameZH",
    "StrategyNameZH",
    "KnowledgeNameZH",
    "Title",
    "ResourceName",
    "StrategyName",
    "TeacherRecognitionPoint",
    "ScenarioName",
    "标题（必填）",
    "策略名称（必填）",
    "教师希望学生识别什么（必填）",
    "案例名称（必填）",
    "name",
    "StageNameEN",
    "PhenomenonNameEN",
    "ResourceNameEN",
    "StrategyNameEN",
    "KnowledgeNameEN",
)

SHORT_LABEL_FIELDS = ("ShortNameZH", "中文短名称", "中文短名")
EXPERT_V3_NAME_FIELDS = ("StageNameZH", "PhenomenonNameZH", "KnowledgeNameZH")


def base_display_label(properties: dict[str, object], formal_label: str) -> str:
    """Use the reviewed v3 Chinese name and retain legacy short-name compatibility."""

    if properties.get("translation_status") == "reviewed" and any(
        properties.get(field) for field in EXPERT_V3_NAME_FIELDS
    ):
        return formal_label
    return next(
        (str(properties[key]) for key in SHORT_LABEL_FIELDS if properties.get(key)),
        formal_label,
    )
