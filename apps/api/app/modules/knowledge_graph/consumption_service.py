from __future__ import annotations

import uuid
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore, StoredGraph
from app.modules.assessment.models import Evaluation
from app.modules.classrooms.models import Classroom, Enrollment
from app.modules.curriculum.models import TrainingUnit
from app.modules.knowledge_graph.models import (
    KnowledgeNodeDisplayOverride,
    KnowledgeScaffoldInteraction,
)
from app.modules.knowledge_graph.repository import KnowledgeGraphRepository
from app.modules.knowledge_graph.schemas import (
    GraphEdgeResponse,
    GraphNodeResponse,
    GraphViewResponse,
    TeacherKnowledgeInsightsResponse,
    WeakUnitKnowledgeInsight,
)
from app.modules.training.models import Attempt

KNOWLEDGE_NODE_TYPES = {
    "KnowledgePoint",
    "KnowledgeResource",
    "Terminology",
    "TradeRule",
    "DocumentKnowledge",
    "BusinessProcess",
    "CommunicationKnowledge",
    "MarketKnowledge",
}
TEACHER_VISIBLE_NODE_TYPES = KNOWLEDGE_NODE_TYPES | {
    "Stage",
    "Scenario",
    "Phenomenon",
    "NegotiationStrategy",
}
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
SHORT_LABEL_FIELDS = (
    "ShortNameZH",
    "中文短名称",
    "中文短名",
)


class KnowledgeGraphConsumptionService:
    def __init__(self, db: Session, graph_store: GraphStore) -> None:
        self.db = db
        self.graph_store = graph_store
        self.repository = KnowledgeGraphRepository(db)

    def teacher_graph(self) -> GraphViewResponse:
        graph = self._active_graph()
        return self._view(graph, TEACHER_VISIBLE_NODE_TYPES)

    def student_graph(self) -> GraphViewResponse:
        return self.teacher_graph()

    def classroom_insights(
        self, teacher_id: uuid.UUID, classroom_id: uuid.UUID
    ) -> TeacherKnowledgeInsightsResponse:
        classroom = self.db.scalar(
            select(Classroom).where(
                Classroom.id == classroom_id,
                Classroom.owner_teacher_id == teacher_id,
                Classroom.status == "active",
            )
        )
        if classroom is None:
            raise AppError(
                code="teacher.classroom_not_found",
                message="班级不存在或无权访问。",
                status_code=404,
            )
        student_ids = select(Enrollment.student_id).where(
            Enrollment.classroom_id == classroom_id,
            Enrollment.status == "active",
        )
        return self._insights(
            scope="classroom",
            scope_id=classroom_id,
            course_version_ids=(classroom.course_version_id,),
            attempt_filters=(Attempt.student_id.in_(student_ids),),
        )

    def student_insights(
        self, teacher_id: uuid.UUID, student_id: uuid.UUID
    ) -> TeacherKnowledgeInsightsResponse:
        course_version_ids = tuple(
            self.db.scalars(
                select(Classroom.course_version_id)
                .distinct()
                .select_from(Enrollment)
                .join(Classroom, Classroom.id == Enrollment.classroom_id)
                .where(
                    Enrollment.student_id == student_id,
                    Enrollment.status == "active",
                    Classroom.owner_teacher_id == teacher_id,
                    Classroom.status == "active",
                )
            ).all()
        )
        if not course_version_ids:
            raise AppError(
                code="teacher.student_not_found",
                message="学生不存在或无权查看。",
                status_code=404,
            )
        return self._insights(
            scope="student",
            scope_id=student_id,
            course_version_ids=course_version_ids,
            attempt_filters=(Attempt.student_id == student_id,),
        )

    def _insights(
        self,
        *,
        scope: Literal["classroom", "student"],
        scope_id: uuid.UUID,
        course_version_ids: tuple[uuid.UUID, ...],
        attempt_filters: tuple[ColumnElement[bool], ...],
    ) -> TeacherKnowledgeInsightsResponse:
        graph = self._active_graph()
        rows = self.db.execute(
            select(
                TrainingUnit.id,
                TrainingUnit.unit_key,
                TrainingUnit.title,
                func.count(Attempt.id),
                func.avg(Evaluation.overall_score),
            )
            .join(Attempt, Attempt.unit_id == TrainingUnit.id)
            .join(Evaluation, Evaluation.attempt_id == Attempt.id)
            .where(
                Attempt.status == "completed",
                Attempt.course_version_id.in_(course_version_ids),
                Evaluation.evaluation_status == "completed",
                *attempt_filters,
            )
            .group_by(TrainingUnit.id)
        ).all()
        unit_insights: list[WeakUnitKnowledgeInsight] = []
        for unit_database_id, unit_key, title, count, average in rows:
            related = self._related_ids(graph, str(unit_key), str(title))
            knowledge_point_ids = sorted(set(related[1]) | set(related[2]))
            by_id = {str(node["stable_key"]): node for node in graph.nodes}
            type_breakdown: dict[str, int] = {}
            for node_id in knowledge_point_ids:
                raw = by_id.get(node_id, {}).get("properties")
                properties = raw if isinstance(raw, dict) else {}
                node_type = str(
                    properties.get("KnowledgeTypeCode")
                    or properties.get("Type")
                    or ("Strategy" if node_id in related[2] else "LegacyResource")
                )
                type_breakdown[node_type] = type_breakdown.get(node_type, 0) + 1
            score = round(float(average), 1)
            scaffold_counts = self.db.execute(
                select(
                    func.count().filter(KnowledgeScaffoldInteraction.event_type == "revealed"),
                    func.count().filter(KnowledgeScaffoldInteraction.event_type == "used"),
                    func.count(func.distinct(KnowledgeScaffoldInteraction.student_id)).filter(
                        KnowledgeScaffoldInteraction.event_type == "used"
                    ),
                )
                .join(Attempt, Attempt.id == KnowledgeScaffoldInteraction.attempt_id)
                .where(
                    Attempt.unit_id == unit_database_id,
                    Attempt.course_version_id.in_(course_version_ids),
                    *attempt_filters,
                )
            ).one()
            unit_insights.append(
                WeakUnitKnowledgeInsight(
                    unit_id=str(unit_key),
                    unit_title=str(title),
                    attempt_count=int(count),
                    average_score=score,
                    needs_attention=score < 70,
                    phenomenon_ids=related[0],
                    knowledge_resource_ids=related[1],
                    strategy_ids=related[2],
                    knowledge_point_ids=knowledge_point_ids,
                    knowledge_type_breakdown=type_breakdown,
                    scaffold_reveal_count=int(scaffold_counts[0] or 0),
                    scaffold_use_count=int(scaffold_counts[1] or 0),
                    students_using_scaffolds=int(scaffold_counts[2] or 0),
                )
            )
        completed_attempts = sum(item.attempt_count for item in unit_insights)
        weighted_total = sum(item.average_score * item.attempt_count for item in unit_insights)
        return TeacherKnowledgeInsightsResponse(
            scope=scope,
            scope_id=scope_id,
            graph_version=graph.graph_version,
            completed_attempts=completed_attempts,
            average_score=(
                round(weighted_total / completed_attempts, 1) if completed_attempts else None
            ),
            weak_units=sorted(
                unit_insights,
                key=lambda item: (not item.needs_attention, item.average_score),
            ),
        )

    def unit_binding(
        self, unit_key: str, unit_title: str, graph_version: str | None = None
    ) -> tuple[str, list[str], list[str], list[str]]:
        graph = self._graph_by_version(graph_version) if graph_version else self._active_graph()
        related = self._related_ids(graph, unit_key, unit_title)
        return graph.graph_version, related[0], related[1], related[2]

    def prompt_context(
        self,
        unit_key: str,
        unit_title: str,
        *,
        purpose: str,
        graph_version: str | None = None,
    ) -> tuple[str, dict[str, object]]:
        graph = self._graph_by_version(graph_version) if graph_version else self._active_graph()
        scenario = self._scenario_for_unit(graph, unit_key, unit_title)
        if scenario is None:
            return graph.graph_version, {}
        phenomena, resources, strategies = self._related_ids(graph, unit_key, unit_title)
        by_id = {str(item["stable_key"]): item for item in graph.nodes}
        payload: dict[str, object] = {
            "scenario": self._prompt_node(scenario),
            "phenomena": [self._prompt_node(by_id[item]) for item in phenomena if item in by_id],
        }
        if purpose == "conversation":
            payload["strategies"] = [
                self._prompt_node(by_id[item]) for item in strategies if item in by_id
            ]
            payload["knowledge_resources"] = [
                self._prompt_node(by_id[item]) for item in resources if item in by_id
            ]
            payload["knowledge_points"] = [
                self._prompt_node(by_id[item])
                for item in sorted(set(resources) | set(strategies))
                if item in by_id
            ]
        return graph.graph_version, payload

    def _related_ids(
        self, graph: StoredGraph, unit_key: str, unit_title: str
    ) -> tuple[list[str], list[str], list[str]]:
        scenario = self._scenario_for_unit(graph, unit_key, unit_title)
        if scenario is None:
            return [], [], []
        scenario_id = str(scenario["stable_key"])
        direct_phenomena = {
            str(item["target"])
            for item in graph.relationships
            if item.get("source") == scenario_id and item.get("type") in {"EXPOSES", "FOCUSES_ON"}
        }
        stage_ids = {
            str(item["source"])
            for item in graph.relationships
            if item.get("target") == scenario_id and item.get("type") == "CONTAINS_SCENARIO"
        }
        stage_phenomena = {
            str(item["target"])
            for item in graph.relationships
            if item.get("source") in stage_ids and item.get("type") == "CONTAINS_PHENOMENON"
        }
        phenomena = direct_phenomena | stage_phenomena
        resources = {
            str(item["source"])
            for item in graph.relationships
            if item.get("target") in phenomena and item.get("type") == "SUPPORTS"
        }
        strategies = {
            str(item["source"])
            for item in graph.relationships
            if item.get("target") in phenomena and item.get("type") == "ADDRESSES"
        }
        knowledge_points = {
            str(item["target"])
            for item in graph.relationships
            if item.get("source") in phenomena and item.get("type") == "REQUIRES_KNOWLEDGE"
        }
        by_id = {str(node["stable_key"]): node for node in graph.nodes}
        for node_id in knowledge_points:
            node = by_id.get(node_id, {})
            raw = node.get("properties")
            properties = raw if isinstance(raw, dict) else {}
            if str(properties.get("KnowledgeTypeCode") or properties.get("Type")) == "Strategy":
                strategies.add(node_id)
            else:
                resources.add(node_id)
        return sorted(phenomena), sorted(resources), sorted(strategies)

    def _active_graph(self) -> StoredGraph:
        publication = self.repository.active_publication()
        if publication is None:
            raise AppError(
                code="knowledge_graph.no_active_publication",
                message="当前没有已发布的知识图谱。",
                status_code=409,
            )
        try:
            graph = self.graph_store.read(publication.graph_version)
        except Exception as exc:
            raise AppError(
                code="knowledge_graph.storage_unavailable",
                message="Neo4j 不可用，暂时无法读取图谱。",
                status_code=503,
                retryable=True,
            ) from exc
        if not graph.nodes:
            raise AppError(
                code="knowledge_graph.version_not_materialized",
                message="已发布版本在 Neo4j 中不存在，请重新发布。",
                status_code=503,
                retryable=True,
            )
        return graph

    def _graph_by_version(self, graph_version: str) -> StoredGraph:
        try:
            graph = self.graph_store.read(graph_version)
        except Exception as exc:
            raise AppError(
                code="knowledge_graph.storage_unavailable",
                message="Neo4j 不可用，暂时无法读取训练绑定图谱。",
                status_code=503,
                retryable=True,
            ) from exc
        if not graph.nodes:
            raise AppError(
                code="knowledge_graph.version_not_materialized",
                message="训练绑定的图谱版本不存在。",
                status_code=503,
                retryable=True,
            )
        return graph

    def _graph_for_attempt(self, attempt: Attempt) -> StoredGraph:
        bound_version = attempt.content_bindings.get("knowledge_graph_version")
        if bound_version:
            return self._graph_by_version(str(bound_version))
        # 只为升级前创建的 Attempt 保留显式 legacy fallback。
        return self._active_graph()

    def graph_for_attempt(self, attempt: Attempt) -> StoredGraph:
        return self._graph_for_attempt(attempt)

    def graph_by_version(self, graph_version: str) -> StoredGraph:
        return self._graph_by_version(graph_version)

    def _view(self, graph: StoredGraph, allowed_types: set[str]) -> GraphViewResponse:
        selected = [item for item in graph.nodes if item.get("type") in allowed_types]
        ids = {str(item["stable_key"]) for item in selected}
        edges = [
            self._edge(item)
            for item in graph.relationships
            if item.get("source") in ids and item.get("target") in ids
        ]
        nodes = self.node_responses(graph.graph_version, selected)
        return GraphViewResponse(
            graph_version=graph.graph_version,
            nodes=nodes,
            edges=edges,
            node_count=len(nodes),
            edge_count=len(edges),
        )

    def node_responses(
        self, graph_version: str, items: list[dict[str, object]]
    ) -> list[GraphNodeResponse]:
        """只在展示读模型中合并教师覆盖, 不污染 Agent 使用的原始图谱属性."""
        node_keys = {str(item["stable_key"]) for item in items}
        overrides = self.repository.display_overrides(graph_version, node_keys)
        return [self._node(item, overrides.get(str(item["stable_key"]))) for item in items]

    @staticmethod
    def _scenario_for_unit(
        graph: StoredGraph, unit_key: str, unit_title: str
    ) -> dict[str, object] | None:
        for node in graph.nodes:
            if node.get("type") != "Scenario":
                continue
            properties = node.get("properties")
            if not isinstance(properties, dict):
                continue
            reference = str(properties.get("对应课程小节（必填）", "")).strip()
            if not reference:
                reference = str(properties.get("CourseUnit", "")).strip()
            if reference in (unit_key, unit_title) or unit_title in reference:
                return node
        return None

    @classmethod
    def _node(
        cls,
        item: dict[str, object],
        override: KnowledgeNodeDisplayOverride | None = None,
    ) -> GraphNodeResponse:
        properties = item.get("properties")
        normalized = properties if isinstance(properties, dict) else {}
        label = next(
            (str(normalized[key]) for key in LABEL_FIELDS if normalized.get(key)),
            str(item["stable_key"]),
        )
        short_label = (
            override.short_name_zh
            if override
            else next(
                (str(normalized[key]) for key in SHORT_LABEL_FIELDS if normalized.get(key)),
                label,
            )
        )
        return GraphNodeResponse(
            id=str(item["stable_key"]),
            type=str(item["type"]),
            label=label,
            short_label=short_label,
            properties=normalized,
            display_revision=override.revision if override else 0,
            has_display_override=override is not None,
        )

    @staticmethod
    def _edge(item: dict[str, object]) -> GraphEdgeResponse:
        properties = item.get("properties")
        return GraphEdgeResponse(
            id=str(item["stable_key"]),
            source=str(item["source"]),
            target=str(item["target"]),
            type=str(item["type"]),
            properties=properties if isinstance(properties, dict) else {},
        )

    @staticmethod
    def _prompt_node(item: dict[str, object]) -> dict[str, object]:
        properties = item.get("properties")
        return {
            "id": str(item["stable_key"]),
            "type": str(item["type"]),
            "properties": properties if isinstance(properties, dict) else {},
        }
