from __future__ import annotations

import uuid

from app.core.errors import AppError
from app.db.types import utc_now
from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.knowledge_graph.unavailable import GraphStoreUnavailable
from app.modules.knowledge_graph.models import KnowledgeGraphChangeSet, KnowledgeGraphPublication
from app.modules.knowledge_graph.repository import KnowledgeGraphRepository


class KnowledgeReviewService:
    def __init__(self, repository: KnowledgeGraphRepository, graph_store: GraphStore) -> None:
        self.repository = repository
        self.graph_store = graph_store

    def require_change_set(self, change_set_id: uuid.UUID) -> KnowledgeGraphChangeSet:
        change_set = self.repository.get_change_set(change_set_id)
        if change_set is None:
            raise AppError(
                code="knowledge_graph.change_set_not_found",
                message="找不到该变更集。",
                status_code=404,
            )
        return change_set

    def submit_review(
        self, change_set: KnowledgeGraphChangeSet, actor_id: uuid.UUID
    ) -> KnowledgeGraphChangeSet:
        if change_set.status == "in_review":
            return change_set
        if change_set.status != "review_ready":
            raise AppError(
                code="knowledge_graph.invalid_review_transition",
                message="只有已通过校验的变更集可提交评审。",
                status_code=409,
            )
        change_set.status = "in_review"
        job = self.repository.get_import(change_set.import_job_id)
        if job:
            job.status = "in_review"
        self.repository.audit(actor_id, "change_set.submitted", "change_set", change_set.id)
        self.repository.commit()
        self.repository.refresh(change_set)
        return change_set

    def decide(
        self,
        change_set: KnowledgeGraphChangeSet,
        actor_id: uuid.UUID,
        decision: str,
        reason: str | None,
    ) -> KnowledgeGraphChangeSet:
        if change_set.status not in {"in_review", "approved", "rejected"}:
            raise AppError(
                code="knowledge_graph.invalid_decision_transition",
                message="变更集必须先提交评审。",
                status_code=409,
            )
        if decision == "reject" and not (reason or "").strip():
            raise AppError(
                code="knowledge_graph.rejection_reason_required",
                message="驳回时必须说明原因。",
                status_code=422,
            )
        change_set.status = "approved" if decision == "approve" else "rejected"
        change_set.rejection_reason = None if decision == "approve" else reason
        change_set.reviewed_by_user_id = actor_id
        change_set.reviewed_at = utc_now()
        job = self.repository.get_import(change_set.import_job_id)
        if job:
            job.status = change_set.status
        self.repository.audit(
            actor_id,
            f"change_set.{change_set.status}",
            "change_set",
            change_set.id,
            {"reason": reason or ""},
        )
        self.repository.commit()
        self.repository.refresh(change_set)
        return change_set

    def publish(
        self, change_set: KnowledgeGraphChangeSet, actor_id: uuid.UUID
    ) -> KnowledgeGraphPublication:
        existing = self.repository.publication_for_change_set(change_set.id)
        if existing is not None:
            return existing
        if change_set.status not in {"approved", "publication_failed"}:
            raise AppError(
                code="knowledge_graph.publication_not_approved",
                message="只有已批准的变更集才能发布。",
                status_code=409,
            )
        graph_version = f"demo-{utc_now():%Y%m%d%H%M%S}-{str(change_set.id)[:8]}"
        try:
            self.graph_store.publish(
                graph_version,
                change_set.nodes,
                change_set.relationships,
            )
        except Exception as exc:
            change_set.status = "publication_failed"
            job = self.repository.get_import(change_set.import_job_id)
            if job:
                job.status = "publication_failed"
            self.repository.audit(
                actor_id,
                "graph.publication_failed",
                "change_set",
                change_set.id,
                {"backend": self.graph_store.backend_name, "error_type": type(exc).__name__},
            )
            self.repository.commit()
            message = str(exc) if isinstance(exc, GraphStoreUnavailable) else "Neo4j 写入失败。"
            raise AppError(
                code="knowledge_graph.storage_unavailable",
                message=message,
                status_code=503,
                retryable=True,
            ) from exc
        publication = self.repository.add_publication(
            change_set,
            actor_id,
            graph_version,
            self.graph_store.backend_name,
        )
        change_set.status = "published"
        job = self.repository.get_import(change_set.import_job_id)
        if job:
            job.status = "published"
        self.repository.audit(actor_id, "graph.published", "publication", publication.id)
        try:
            self.repository.commit()
        except Exception:
            # Cancel Neo4j activation if the relational audit commit fails.
            self.graph_store.deactivate(graph_version)
            raise
        self.repository.refresh(publication)
        return publication

    def rollback(
        self, publication: KnowledgeGraphPublication, actor_id: uuid.UUID
    ) -> KnowledgeGraphPublication:
        if publication.status == "rolled_back":
            return publication
        if not publication.is_active:
            raise AppError(
                code="knowledge_graph.publication_not_active",
                message="只能回滚当前激活的演示版本。",
                status_code=409,
            )
        try:
            self.graph_store.deactivate(publication.graph_version)
        except Exception as exc:
            raise AppError(
                code="knowledge_graph.storage_unavailable",
                message="Neo4j 不可用，回滚未执行。",
                status_code=503,
                retryable=True,
            ) from exc
        publication.status = "rolled_back"
        publication.is_active = False
        publication.rolled_back_at = utc_now()
        change_set = self.repository.get_change_set(publication.change_set_id)
        if change_set:
            change_set.status = "approved"
            job = self.repository.get_import(change_set.import_job_id)
            if job:
                job.status = "approved"
        self.repository.audit(actor_id, "graph.rolled_back", "publication", publication.id)
        self.repository.commit()
        self.repository.refresh(publication)
        return publication
