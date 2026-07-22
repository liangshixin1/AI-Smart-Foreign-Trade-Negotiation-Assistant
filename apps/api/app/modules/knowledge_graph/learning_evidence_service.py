from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.knowledge_graph.base import GraphStore
from app.modules.curriculum.models import TrainingUnit
from app.modules.knowledge_graph.consumption_service import KnowledgeGraphConsumptionService
from app.modules.knowledge_graph.models import GraphLearningEvidence
from app.modules.training.models import Attempt


class GraphLearningEvidenceService:
    """把每轮反馈绑定到图谱限定且经 LLM 排序的候选节点。"""

    def __init__(self, db: Session, graph_store: GraphStore) -> None:
        self.db = db
        self.consumption = KnowledgeGraphConsumptionService(db, graph_store)

    def record(
        self,
        attempt: Attempt,
        unit: TrainingUnit,
        round_evaluation_id: uuid.UUID,
        student_message_id: uuid.UUID,
        score: float,
        evidence_summary: str,
        recommendations: list[dict[str, object]] | None = None,
    ) -> None:
        existing = self.db.scalar(
            select(GraphLearningEvidence).where(
                GraphLearningEvidence.round_evaluation_id == round_evaluation_id
            )
        )
        if existing is not None:
            return
        bound_version = attempt.content_bindings.get("knowledge_graph_version")
        version, phenomena, resources, strategies = self.consumption.unit_binding(
            unit.unit_key,
            unit.title,
            str(bound_version) if bound_version else None,
        )
        mapping_method = "unit_scope_inferred"
        if recommendations:
            selected_resources = {
                str(item["node_id"])
                for item in recommendations
                if item.get("node_type") == "knowledge_resource"
            }
            selected_strategies = {
                str(item["node_id"])
                for item in recommendations
                if item.get("node_type") == "strategy"
            }
            resources = sorted(set(resources) & selected_resources)
            strategies = sorted(set(strategies) & selected_strategies)
            graph = self.consumption.graph_by_version(version)
            selected_nodes = set(resources) | set(strategies)
            related_phenomena = {
                str(edge["target"])
                for edge in graph.relationships
                if edge.get("source") in selected_nodes
                and edge.get("type") in {"SUPPORTS", "ADDRESSES"}
            }
            phenomena = sorted(set(phenomena) & related_phenomena)
            mapping_method = "fixed_candidates_llm_selected"
        self.db.add(
            GraphLearningEvidence(
                round_evaluation_id=round_evaluation_id,
                attempt_id=attempt.id,
                student_message_id=student_message_id,
                graph_version=version,
                phenomenon_node_keys=phenomena,
                strategy_node_keys=strategies,
                knowledge_resource_node_keys=resources,
                score=score,
                evidence_summary=evidence_summary[:1000],
                mapping_method=mapping_method,
            )
        )
        self.db.commit()
