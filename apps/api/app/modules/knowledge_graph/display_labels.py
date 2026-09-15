# [导读] 所属业务: 教学知识图谱、学习内容与证据。
# [导读] 业务名词: 图谱用节点与关系表达阶段、商务现象、知识点和策略; Scaffold 是本次训练固定的学
# [导读] 习支持库。
# [导读] 用途与原因: 确定节点默认中文显示名并兼容旧版短名; 展示名称可以演进, 但稳定编号仍用于关
# [导读] 联证据。
# [导读] 结构: base_display_label。
# [导读] 提醒: graph_version 与 node_key 一起定位内容; 显示短名不等于稳定编号, 历史证据不能随当
# [导读] 前图谱重写。
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


# [导读] 优先采用审核后的中文名称, 同时兼容旧短名; 显示规则不应改变稳定节点身份。
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
