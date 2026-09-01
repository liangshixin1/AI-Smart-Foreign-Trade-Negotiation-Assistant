from __future__ import annotations

import uuid
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore, StoredGraph
from app.modules.auth.models import User
from app.modules.knowledge_graph.consumption_service import KnowledgeGraphConsumptionService
from app.modules.knowledge_graph.models import KnowledgeScaffoldInteraction
from app.modules.knowledge_graph.schemas import (
    GraphNodeResponse,
    ScaffoldEventRequest,
    ScaffoldHintResponse,
    ScaffoldInteractionResponse,
    StudentScaffoldResponse,
)
from app.modules.training.access import owned_attempt
from app.modules.training.repository import TrainingRepository


class KnowledgeScaffoldService:
    def __init__(self, db: Session, graph_store: GraphStore) -> None:
        self.db = db
        self.graph_query = KnowledgeGraphConsumptionService(db, graph_store)

    def student_scaffolds(self, student: User, attempt_id: uuid.UUID) -> StudentScaffoldResponse:
        training = TrainingRepository(self.db)
        attempt = owned_attempt(training, student, attempt_id)
        unit = training.unit(attempt.unit_id)
        graph = self.graph_query.graph_for_attempt(attempt)
        scenario = self.graph_query._scenario_for_unit(graph, unit.unit_key, unit.title)
        if scenario is None:
            return StudentScaffoldResponse(
                attempt_id=attempt.id,
                unit_id=unit.unit_key,
                graph_version=graph.graph_version,
                scenario=None,
                phenomena=[],
                knowledge_resources=[],
                strategies=[],
                knowledge_points=[],
                scaffolds=[],
                edges=[],
            )
        scenario_id = str(scenario["stable_key"])
        related = self.graph_query._related_ids(graph, unit.unit_key, unit.title)
        phenomenon_ids = set(related[0])
        resource_ids = set(related[1])
        strategy_ids = set(related[2])
        scaffold_ids = self._related_sources(graph, phenomenon_ids, "SCAFFOLDS")
        selected_ids = {scenario_id} | phenomenon_ids | strategy_ids | resource_ids | scaffold_ids
        by_id = {str(node["stable_key"]): node for node in graph.nodes}
        display_ids = {scenario_id} | phenomenon_ids | strategy_ids | resource_ids
        display_by_id = {
            node.id: node
            for node in self.graph_query.node_responses(
                graph.graph_version,
                [by_id[node_id] for node_id in display_ids if node_id in by_id],
            )
        }
        interactions = list(
            self.db.scalars(
                select(KnowledgeScaffoldInteraction).where(
                    KnowledgeScaffoldInteraction.attempt_id == attempt.id,
                    KnowledgeScaffoldInteraction.graph_version == graph.graph_version,
                )
            )
        )
        return StudentScaffoldResponse(
            attempt_id=attempt.id,
            unit_id=unit.unit_key,
            graph_version=graph.graph_version,
            scenario=display_by_id[scenario_id],
            phenomena=self._nodes(display_by_id, phenomenon_ids),
            knowledge_resources=self._nodes(display_by_id, resource_ids),
            strategies=self._nodes(display_by_id, strategy_ids),
            knowledge_points=self._nodes(display_by_id, resource_ids | strategy_ids),
            scaffolds=self._scaffold_hints(graph, by_id, scaffold_ids, interactions),
            edges=[
                self.graph_query._edge(item)
                for item in graph.relationships
                if item.get("source") in selected_ids and item.get("target") in selected_ids
            ],
        )

    def record_event(
        self,
        student: User,
        attempt_id: uuid.UUID,
        payload: ScaffoldEventRequest,
    ) -> ScaffoldInteractionResponse:
        existing = self.db.scalar(
            select(KnowledgeScaffoldInteraction).where(
                KnowledgeScaffoldInteraction.student_id == student.id,
                KnowledgeScaffoldInteraction.client_event_id == payload.client_event_id,
            )
        )
        if existing is not None:
            return ScaffoldInteractionResponse.model_validate(existing)
        scaffold_view = self.student_scaffolds(student, attempt_id)
        hint = next((item for item in scaffold_view.scaffolds if item.id == payload.node_id), None)
        if hint is None:
            raise AppError(
                code="knowledge_graph.scaffold_not_found",
                message="该提示不属于当前训练或已失效。",
                status_code=404,
            )
        if hint.level != payload.level:
            raise AppError(
                code="knowledge_graph.scaffold_level_mismatch",
                message="提示等级与已发布图谱不一致。",
                status_code=409,
            )
        if payload.event_type == "used" and not hint.revealed:
            raise AppError(
                code="knowledge_graph.scaffold_not_revealed",
                message="请先展开该级提示，再记录使用。",
                status_code=409,
            )
        if payload.event_type == "revealed":
            self._require_previous_level(scaffold_view.scaffolds, hint)
        graph = self.graph_query.graph_by_version(scaffold_view.graph_version)
        raw_node = next(item for item in graph.nodes if item.get("stable_key") == hint.id)
        raw_properties = raw_node.get("properties")
        interaction = KnowledgeScaffoldInteraction(
            attempt_id=attempt_id,
            student_id=student.id,
            graph_version=scaffold_view.graph_version,
            scaffold_node_key=hint.id,
            phenomenon_node_key=hint.phenomenon_id,
            event_type=payload.event_type,
            level=hint.level,
            client_event_id=payload.client_event_id,
            scaffold_snapshot=raw_properties if isinstance(raw_properties, dict) else {},
        )
        self.db.add(interaction)
        self.db.commit()
        self.db.refresh(interaction)
        return ScaffoldInteractionResponse.model_validate(interaction)

    @staticmethod
    def _sources_or_targets(
        graph: StoredGraph, node_id: str, relation_type: str, field: str
    ) -> set[str]:
        return {
            str(edge[field])
            for edge in graph.relationships
            if edge.get("source") == node_id and edge.get("type") == relation_type
        }

    @staticmethod
    def _related_sources(graph: StoredGraph, target_ids: set[str], relation_type: str) -> set[str]:
        return {
            str(edge["source"])
            for edge in graph.relationships
            if edge.get("target") in target_ids and edge.get("type") == relation_type
        }

    @staticmethod
    def _nodes(by_id: dict[str, GraphNodeResponse], ids: Iterable[str]) -> list[GraphNodeResponse]:
        return [by_id[item] for item in sorted(ids) if item in by_id]

    @staticmethod
    def _level_rank(value: str) -> int:
        normalized = value.strip().lower()
        for digit in ("1", "2", "3", "4", "5"):
            if digit in normalized:
                return int(digit)
        for marker, rank in (
            ("一", 1),
            ("二", 2),
            ("三", 3),
            ("初级", 1),
            ("中级", 2),
            ("高级", 3),
        ):
            if marker in normalized:
                return rank
        return 1

    @classmethod
    def _require_previous_level(
        cls, hints: list[ScaffoldHintResponse], selected: ScaffoldHintResponse
    ) -> None:
        lower = [
            item
            for item in hints
            if item.phenomenon_id == selected.phenomenon_id
            and cls._level_rank(item.level) < cls._level_rank(selected.level)
        ]
        if lower and not max(lower, key=lambda item: cls._level_rank(item.level)).revealed:
            raise AppError(
                code="knowledge_graph.scaffold_previous_level_required",
                message="请先展开上一级提示。",
                status_code=409,
            )

    @classmethod
    def _scaffold_hints(
        cls,
        graph: StoredGraph,
        by_id: dict[str, dict[str, object]],
        scaffold_ids: set[str],
        interactions: list[KnowledgeScaffoldInteraction],
    ) -> list[ScaffoldHintResponse]:
        targets = {
            str(item["source"]): str(item["target"])
            for item in graph.relationships
            if item.get("type") == "SCAFFOLDS"
        }
        revealed = {
            item.scaffold_node_key for item in interactions if item.event_type == "revealed"
        }
        used = {item.scaffold_node_key for item in interactions if item.event_type == "used"}
        result: list[ScaffoldHintResponse] = []
        for node_id in scaffold_ids:
            raw = by_id[node_id].get("properties")
            properties = raw if isinstance(raw, dict) else {}
            result.append(
                ScaffoldHintResponse(
                    id=node_id,
                    phenomenon_id=targets.get(node_id, ""),
                    level=str(properties.get("提示等级（必填）", "一级")),
                    trigger=str(properties.get("何时触发（必填）", "")),
                    content=(
                        str(properties.get("提示内容（必填）", "")) if node_id in revealed else None
                    ),
                    revealed=node_id in revealed,
                    used=node_id in used,
                )
            )
        return sorted(result, key=lambda item: (item.phenomenon_id, cls._level_rank(item.level)))
