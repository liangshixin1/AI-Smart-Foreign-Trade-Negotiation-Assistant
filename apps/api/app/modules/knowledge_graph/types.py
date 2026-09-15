# [导读] 所属业务: 教学知识图谱、学习内容与证据。
# [导读] 业务名词: 图谱用节点与关系表达阶段、商务现象、知识点和策略; Scaffold 是本次训练固定的学
# [导读] 习支持库。
# [导读] 用途: 定义解析和校验过程中使用的内部数据结构。
# [导读] 为什么: 内部对象用于模块间传递, 不应未经响应模型筛选就直接作为公开 API 返回。
# [导读] 结构: ImportIssue、ParsedWorkbookData。
# [导读] 提醒: graph_version 与 node_key 一起定位内容; 显示短名不等于稳定编号, 历史证据不能随当
# [导读] 前图谱重写。
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ImportIssue:
    severity: str
    code: str
    sheet_name: str
    message: str
    row_number: int | None = None
    column_name: str | None = None


@dataclass
class ParsedWorkbookData:
    sheets: dict[str, list[dict[str, object]]] = field(default_factory=dict)
    # 专家源表包含说明页和分段统计页, 保留二维原始值用于交叉校验,
    # 避免把非表格 Sheet 强行扁平化后丢失语义。
    raw_sheets: dict[str, list[list[object]]] = field(default_factory=dict)
    issues: list[ImportIssue] = field(default_factory=list)
