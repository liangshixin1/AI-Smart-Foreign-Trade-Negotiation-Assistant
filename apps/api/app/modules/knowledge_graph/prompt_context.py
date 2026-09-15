# [导读] 所属业务: 教学知识图谱、学习内容与证据。
# [导读] 业务名词: 图谱用节点与关系表达阶段、商务现象、知识点和策略; Scaffold 是本次训练固定的学
# [导读] 习支持库。
# [导读] 用途与原因: 把固定图谱版本中的相关知识整理为模型上下文; 图谱辅助读取失败可按现有分支降
# [导读] 级, 不能冒充已有完整图谱支持。
# [导读] 结构: KnowledgePromptContext、KnowledgeContextProvider。
# [导读] 提醒: graph_version 与 node_key 一起定位内容; 显示短名不等于稳定编号, 历史证据不能随当
# [导读] 前图谱重写。
from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore
from app.modules.curriculum.models import TrainingUnit
from app.modules.knowledge_graph.consumption_service import KnowledgeGraphConsumptionService


@dataclass(frozen=True)
class KnowledgePromptContext:
    graph_version: str
    system_message: str


class KnowledgeContextProvider:
    """Optional LLM graph context that always falls back to the legacy flow."""

    def __init__(self, db: Session, graph_store: GraphStore) -> None:
        self.consumption = KnowledgeGraphConsumptionService(db, graph_store)

    def scenario(self, unit: TrainingUnit) -> KnowledgePromptContext | None:
        return self._build(unit, "scenario", None)

    def conversation(
        self, unit: TrainingUnit, graph_version: str | None
    ) -> KnowledgePromptContext | None:
        return self._build(unit, "conversation", graph_version)

    def _build(
        self,
        unit: TrainingUnit,
        purpose: str,
        graph_version: str | None,
    ) -> KnowledgePromptContext | None:
        try:
            version, payload = self.consumption.prompt_context(
                unit.unit_key,
                unit.title,
                purpose=purpose,
                graph_version=graph_version,
            )
        except AppError as exc:
            logger.warning(
                "Knowledge context unavailable unit_key=%s error_type=%s",
                unit.unit_key,
                type(exc).__name__,
            )
            return None
        if not payload:
            return None
        if purpose == "scenario":
            instruction = (
                "以下为当前小节的教学图谱背景与局面线索。"
                "可用于构造真实场景，但不得向学生泄露标准策略、标准答案或评价结论。"
            )
        else:
            instruction = (
                "以下为 AI 谈判对手的隐藏推进规则。"
                "根据学生表现触发局面并验证策略，不得直接朗读图谱、标准策略或脚手架内容。"
            )
        return KnowledgePromptContext(
            graph_version=version,
            system_message=f"{instruction}\n{json.dumps(payload, ensure_ascii=False)}",
        )


logger = logging.getLogger(__name__)
