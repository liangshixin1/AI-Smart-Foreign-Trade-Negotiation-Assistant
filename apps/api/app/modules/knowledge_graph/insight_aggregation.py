# [导读] 所属业务: 教学知识图谱、学习内容与证据。
# [导读] 业务名词: 图谱用节点与关系表达阶段、商务现象、知识点和策略; Scaffold 是本次训练固定的学
# [导读] 习支持库。
# [导读] 用途与原因: 从训练证据、学习事件和提示交互聚合节点及阶段学情; 按学生、训练和版本限定统
# [导读] 计范围, 避免跨班级混入证据。
# [导读] 结构: _Metric、KnowledgeInsightAggregator。
# [导读] 提醒: graph_version 与 node_key 一起定位内容; 显示短名不等于稳定编号, 历史证据不能随当
# [导读] 前图谱重写。
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime
from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.knowledge_graph.base import StoredGraph
from app.modules.knowledge_graph.consumption_service import KnowledgeGraphConsumptionService
from app.modules.knowledge_graph.models import (
    GraphLearningEvidence,
    KnowledgeLearningActivity,
    KnowledgeScaffoldInteraction,
)
from app.modules.knowledge_graph.schemas import (
    KnowledgeNodeLearningInsight,
    PhenomenonLearningInsight,
    StageLearningInsight,
    TeacherKnowledgeInsightsResponse,
)
from app.modules.training.models import Attempt

InsightItem = TypeVar(
    "InsightItem", KnowledgeNodeLearningInsight, PhenomenonLearningInsight, StageLearningInsight
)


class _Metric:
    def __init__(self) -> None:
        self.scores: list[float] = []
        self.attempts: set[uuid.UUID] = set()
        self.students: set[uuid.UUID] = set()
        self.recommendations = 0
        self.application_states: list[str] = []

    def add(
        self,
        evidence: GraphLearningEvidence,
        student_id: uuid.UUID,
        application_state: str | None = None,
    ) -> None:
        self.scores.append(float(evidence.score))
        self.attempts.add(evidence.attempt_id)
        self.students.add(student_id)
        if evidence.mapping_method == "fixed_candidates_llm_selected":
            self.recommendations += 1
        if application_state:
            self.application_states.append(application_state)

    @property
    def average(self) -> float | None:
        return round(sum(self.scores) / len(self.scores), 1) if self.scores else None


class KnowledgeInsightAggregator:
    """把版本一致的轮次证据、学习行为和提示使用合并为读模型。"""

    def __init__(self, db: Session, consumption: KnowledgeGraphConsumptionService) -> None:
        self.db = db
        self.consumption = consumption

    def enrich(
        self,
        base: TeacherKnowledgeInsightsResponse,
        student_ids: tuple[uuid.UUID, ...],
        course_version_ids: tuple[uuid.UUID, ...],
    ) -> TeacherKnowledgeInsightsResponse:
        graph = self.consumption.graph_by_version(base.graph_version)
        attempts = self._attempt_students(student_ids, course_version_ids)
        evidence = self._evidence(set(attempts), base.graph_version)
        activities = self._activities(student_ids, base.graph_version)
        interactions = self._interactions(set(attempts), base.graph_version)
        labels, types = self._node_metadata(graph)
        node_metrics, phenomenon_metrics = self._metrics(evidence, attempts)
        views, completions, latest = self._activity_counts(activities)
        knowledge = self._knowledge_insights(
            node_metrics, views, completions, latest, labels, types
        )
        phenomenon_stage, stage_labels = self._stage_maps(graph, labels)
        reveal_counts, use_counts = self._interaction_counts(interactions)
        phenomena = self._phenomenon_insights(
            phenomenon_metrics,
            reveal_counts,
            use_counts,
            labels,
            phenomenon_stage,
            stage_labels,
        )
        return base.model_copy(
            update={
                "evidence_rounds": len(evidence),
                "students_with_evidence": len({attempts[item.attempt_id] for item in evidence}),
                "learning_views": sum(views.values()),
                "learning_completions": sum(completions.values()),
                "stage_insights": self._stage_insights(phenomena, stage_labels),
                "phenomenon_insights": self._sort(phenomena),
                "knowledge_insights": self._sort(knowledge),
            }
        )

    @staticmethod
    def _metrics(
        evidence: list[GraphLearningEvidence], attempts: dict[uuid.UUID, uuid.UUID]
    ) -> tuple[dict[str, _Metric], dict[str, _Metric]]:
        nodes: dict[str, _Metric] = defaultdict(_Metric)
        phenomena: dict[str, _Metric] = defaultdict(_Metric)
        for item in evidence:
            student_id = attempts[item.attempt_id]
            states = {
                str(value.get("node_id")): str(value.get("application_state", ""))
                for value in item.node_evidence
                if value.get("node_id")
            }
            for node_id in item.knowledge_point_node_keys:
                nodes[node_id].add(item, student_id, states.get(node_id))
            for node_id in item.phenomenon_node_keys:
                phenomena[node_id].add(item, student_id)
        return nodes, phenomena

    @staticmethod
    def _activity_counts(
        activities: list[KnowledgeLearningActivity],
    ) -> tuple[dict[str, int], dict[str, int], dict[str, datetime]]:
        views: dict[str, int] = defaultdict(int)
        completions: dict[str, int] = defaultdict(int)
        latest: dict[str, datetime] = {}
        for item in activities:
            target = views if item.event_type == "viewed" else completions
            target[item.node_key] += 1
            latest[item.node_key] = max(latest.get(item.node_key, item.created_at), item.created_at)
        return views, completions, latest

    def _knowledge_insights(
        self,
        metrics: dict[str, _Metric],
        views: dict[str, int],
        completions: dict[str, int],
        latest: dict[str, datetime],
        labels: dict[str, str],
        types: dict[str, tuple[str, str | None]],
    ) -> list[KnowledgeNodeLearningInsight]:
        return [
            KnowledgeNodeLearningInsight(
                node_id=node_id,
                label=labels.get(node_id, node_id),
                node_type=types.get(node_id, ("", None))[0],
                knowledge_type=types.get(node_id, ("", None))[1],
                evidence_count=len(metrics[node_id].scores),
                attempt_count=len(metrics[node_id].attempts),
                student_count=len(metrics[node_id].students),
                average_score=metrics[node_id].average,
                needs_attention=self._needs_attention(metrics[node_id]),
                recommendation_count=metrics[node_id].recommendations,
                content_view_count=views[node_id],
                content_completion_count=completions[node_id],
                last_activity_at=latest.get(node_id),
            )
            for node_id in set(metrics) | set(views) | set(completions)
        ]

    @staticmethod
    def _interaction_counts(
        interactions: list[KnowledgeScaffoldInteraction],
    ) -> tuple[dict[str, int], dict[str, int]]:
        revealed: dict[str, int] = defaultdict(int)
        used: dict[str, int] = defaultdict(int)
        for item in interactions:
            if item.phenomenon_node_key:
                target = revealed if item.event_type == "revealed" else used
                target[item.phenomenon_node_key] += 1
        return revealed, used

    def _phenomenon_insights(
        self,
        metrics: dict[str, _Metric],
        revealed: dict[str, int],
        used: dict[str, int],
        labels: dict[str, str],
        stage_by_phenomenon: dict[str, str],
        stage_labels: dict[str, str],
    ) -> list[PhenomenonLearningInsight]:
        return [
            PhenomenonLearningInsight(
                node_id=node_id,
                label=labels.get(node_id, node_id),
                stage_id=stage_by_phenomenon.get(node_id),
                stage_label=stage_labels.get(stage_by_phenomenon.get(node_id, "")),
                evidence_count=len(metrics[node_id].scores),
                attempt_count=len(metrics[node_id].attempts),
                student_count=len(metrics[node_id].students),
                average_score=metrics[node_id].average,
                needs_attention=self._needs_attention(metrics[node_id]),
                scaffold_reveal_count=revealed[node_id],
                scaffold_use_count=used[node_id],
            )
            for node_id in set(metrics) | set(revealed) | set(used)
        ]

    def _attempt_students(
        self, student_ids: tuple[uuid.UUID, ...], versions: tuple[uuid.UUID, ...]
    ) -> dict[uuid.UUID, uuid.UUID]:
        if not student_ids or not versions:
            return {}
        rows = self.db.execute(
            select(Attempt.id, Attempt.student_id).where(
                Attempt.student_id.in_(student_ids), Attempt.course_version_id.in_(versions)
            )
        ).all()
        return {attempt_id: student_id for attempt_id, student_id in rows}

    def _evidence(self, attempts: set[uuid.UUID], version: str) -> list[GraphLearningEvidence]:
        if not attempts:
            return []
        return list(
            self.db.scalars(
                select(GraphLearningEvidence).where(
                    GraphLearningEvidence.attempt_id.in_(attempts),
                    GraphLearningEvidence.graph_version == version,
                )
            )
        )

    def _activities(
        self, students: tuple[uuid.UUID, ...], version: str
    ) -> list[KnowledgeLearningActivity]:
        if not students:
            return []
        return list(
            self.db.scalars(
                select(KnowledgeLearningActivity).where(
                    KnowledgeLearningActivity.student_id.in_(students),
                    KnowledgeLearningActivity.graph_version == version,
                )
            )
        )

    def _interactions(
        self, attempts: set[uuid.UUID], version: str
    ) -> list[KnowledgeScaffoldInteraction]:
        if not attempts:
            return []
        return list(
            self.db.scalars(
                select(KnowledgeScaffoldInteraction).where(
                    KnowledgeScaffoldInteraction.attempt_id.in_(attempts),
                    KnowledgeScaffoldInteraction.graph_version == version,
                )
            )
        )

    def _node_metadata(
        self, graph: StoredGraph
    ) -> tuple[dict[str, str], dict[str, tuple[str, str | None]]]:
        labels = {
            node.id: node.short_label
            for node in self.consumption.node_responses(graph.graph_version, graph.nodes)
        }
        types: dict[str, tuple[str, str | None]] = {}
        for raw in graph.nodes:
            properties = raw.get("properties")
            props = properties if isinstance(properties, dict) else {}
            kind = props.get("KnowledgeTypeCode") or props.get("Type")
            types[str(raw["stable_key"])] = (
                str(raw.get("type", "")),
                str(kind) if kind else None,
            )
        return labels, types

    @staticmethod
    def _stage_maps(
        graph: StoredGraph, labels: dict[str, str]
    ) -> tuple[dict[str, str], dict[str, str]]:
        mapping = {
            str(edge["target"]): str(edge["source"])
            for edge in graph.relationships
            if edge.get("type") == "CONTAINS_PHENOMENON"
        }
        stages = {
            str(node["stable_key"]): labels.get(str(node["stable_key"]), str(node["stable_key"]))
            for node in graph.nodes
            if node.get("type") == "Stage"
        }
        return mapping, stages

    @staticmethod
    def _stage_insights(
        phenomena: list[PhenomenonLearningInsight], labels: dict[str, str]
    ) -> list[StageLearningInsight]:
        grouped: dict[str, list[PhenomenonLearningInsight]] = defaultdict(list)
        for item in phenomena:
            if item.stage_id:
                grouped[item.stage_id].append(item)
        result: list[StageLearningInsight] = []
        for stage_id, items in grouped.items():
            scored = [item for item in items if item.average_score is not None]
            count = sum(item.evidence_count for item in scored)
            total = sum((item.average_score or 0) * item.evidence_count for item in scored)
            average = round(total / count, 1) if count else None
            result.append(
                StageLearningInsight(
                    node_id=stage_id,
                    label=labels.get(stage_id, stage_id),
                    evidence_count=sum(item.evidence_count for item in items),
                    attempt_count=sum(item.attempt_count for item in items),
                    student_count=max((item.student_count for item in items), default=0),
                    average_score=average,
                    needs_attention=average is not None and average < 70,
                )
            )
        return KnowledgeInsightAggregator._sort(result)

    @staticmethod
    def _needs_attention(metric: _Metric) -> bool:
        return any(
            state in {"misapplied", "recalled_unused", "missed_required"}
            for state in metric.application_states
        ) or (metric.average is not None and metric.average < 70)

    @staticmethod
    def _sort(items: list[InsightItem]) -> list[InsightItem]:
        return sorted(
            items,
            key=lambda item: (
                not item.needs_attention,
                item.average_score is None,
                item.average_score or 0,
                -item.evidence_count,
                item.label,
            ),
        )
