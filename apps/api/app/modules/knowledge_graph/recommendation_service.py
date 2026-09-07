from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore
from app.modules.assessment.schemas import GraphRecommendationCandidate
from app.modules.curriculum.models import TrainingUnit
from app.modules.knowledge_graph.consumption_service import KnowledgeGraphConsumptionService
from app.modules.training.models import Attempt


class GraphRecommendationService:
    """先由图谱限定候选, 再允许评价 Agent 基于本轮语义排序。"""

    def __init__(self, db: Session, graph_store: GraphStore) -> None:
        self.consumption = KnowledgeGraphConsumptionService(db, graph_store)

    def candidates(self, attempt: Attempt, unit: TrainingUnit) -> list[dict[str, object]]:
        try:
            graph = self.consumption.graph_for_attempt(attempt)
        except AppError:
            # 图谱不可用时保留原有对话与评价闭环, 但不允许模型自由生成推荐。
            return []
        phenomenon_ids, resource_ids, strategy_ids = self.consumption._related_ids(
            graph, unit.unit_key, unit.title
        )
        by_id = {str(node["stable_key"]): node for node in graph.nodes}
        return [
            self._candidate(
                by_id[node_id], "knowledge_resource", graph.relationships, phenomenon_ids
            )
            for node_id in resource_ids
            if node_id in by_id
        ] + [
            self._candidate(by_id[node_id], "strategy", graph.relationships, phenomenon_ids)
            for node_id in strategy_ids
            if node_id in by_id
        ]

    @staticmethod
    def _candidate(
        node: dict[str, object],
        node_type: str,
        relationships: list[dict[str, object]],
        phenomenon_ids: list[str],
    ) -> dict[str, object]:
        raw = node.get("properties")
        properties = raw if isinstance(raw, dict) else {}
        title = next(
            (
                str(properties[key])
                for key in (
                    "ResourceNameZH",
                    "StrategyNameZH",
                    "KnowledgeNameZH",
                    "Title",
                    "ResourceName",
                    "StrategyName",
                    "KnowledgeNameEN",
                    "标题（必填）",
                    "策略名称（必填）",
                )
                if properties.get(key)
            ),
            str(node["stable_key"]),
        )
        summary = next(
            (
                str(properties[key])
                for key in (
                    "DefinitionZH",
                    "DefinitionEN",
                    "Summary",
                    "Definition_Content",
                    "RecommendedActions",
                    "教师解释（必填）",
                    "学生应采取的行动（必填）",
                )
                if properties.get(key)
            ),
            "",
        )
        node_id = str(node["stable_key"])
        phenomenon_set = set(phenomenon_ids)
        contextual_how = ""
        for relationship in relationships:
            linked = (
                relationship.get("source") == node_id
                and relationship.get("target") in phenomenon_set
            ) or (
                relationship.get("target") == node_id
                and relationship.get("source") in phenomenon_set
            )
            if not linked:
                continue
            raw_relationship = relationship.get("properties")
            relation_properties = raw_relationship if isinstance(raw_relationship, dict) else {}
            contextual_how = next(
                (
                    str(relation_properties[key])
                    for key in (
                        "AddressingNoteZH",
                        "AddressingNoteEN",
                        "how",
                        "教学用途",
                    )
                    if relation_properties.get(key)
                ),
                "",
            )
            if contextual_how:
                break
        return {
            "node_id": node_id,
            "node_type": node_type,
            "title": title,
            "summary": summary[:900],
            "contextual_how": contextual_how[:900],
        }

    @staticmethod
    def validate_selection(
        candidates: list[dict[str, object]],
        knowledge: list[GraphRecommendationCandidate],
        strategies: list[GraphRecommendationCandidate],
    ) -> list[dict[str, object]]:
        allowed = {str(item["node_id"]): item for item in candidates}
        result: list[dict[str, object]] = []
        seen: set[str] = set()
        for expected_type, selections in (
            ("knowledge_resource", knowledge),
            ("strategy", strategies),
        ):
            for item in selections:
                source = allowed.get(item.node_id)
                if source is None or source["node_type"] != expected_type:
                    raise ValueError("Round recommendation is outside graph candidates")
                if item.node_id in seen:
                    continue
                seen.add(item.node_id)
                application_state = item.application_state
                evidence_excerpt = item.evidence_excerpt.strip()
                # 模型偶尔会同时声称“未运用”又引用学生确实使用该知识的原话。
                # 证据存在时保守归为“部分运用”。避免把矛盾状态写入长期学情。
                if evidence_excerpt and application_state in {
                    "recalled_unused",
                    "missed_required",
                    "recommended_next",
                }:
                    application_state = "applied_partially"
                result.append(
                    {
                        **item.model_dump(),
                        "application_state": application_state,
                        "evidence_excerpt": evidence_excerpt,
                        "node_type": expected_type,
                        "title": source["title"],
                        "contextual_how": source.get("contextual_how", ""),
                    }
                )
        return result
