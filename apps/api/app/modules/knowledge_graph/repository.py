from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.modules.knowledge_graph.models import (
    KnowledgeGraphAuditEvent,
    KnowledgeGraphChangeSet,
    KnowledgeGraphPublication,
    KnowledgeImportJob,
    KnowledgeValidationIssue,
    KnowledgeWorkbookAsset,
)
from app.modules.knowledge_graph.types import ImportIssue


class KnowledgeGraphRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def find_import(
        self, owner_id: uuid.UUID, source_hash: str, template_version: str
    ) -> KnowledgeImportJob | None:
        return self.db.scalar(
            select(KnowledgeImportJob).where(
                KnowledgeImportJob.uploaded_by_user_id == owner_id,
                KnowledgeImportJob.source_hash == source_hash,
                KnowledgeImportJob.template_version == template_version,
            )
        )

    def get_import(self, job_id: uuid.UUID) -> KnowledgeImportJob | None:
        return self.db.get(KnowledgeImportJob, job_id)

    def add_import(
        self,
        *,
        owner_id: uuid.UUID,
        filename: str,
        source_hash: str,
        content: bytes,
        template_version: str,
    ) -> KnowledgeImportJob:
        job = KnowledgeImportJob(
            uploaded_by_user_id=owner_id,
            source_filename=filename,
            source_hash=source_hash,
            source_size=len(content),
            template_version=template_version,
            status="validating",
        )
        self.db.add(job)
        self.db.flush()
        self.db.add(
            KnowledgeWorkbookAsset(
                import_job_id=job.id,
                content=content,
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        )
        return job

    def add_issues(self, job_id: uuid.UUID, issues: list[ImportIssue]) -> None:
        for issue in issues:
            self.db.add(
                KnowledgeValidationIssue(
                    import_job_id=job_id,
                    severity=issue.severity,
                    code=issue.code,
                    sheet_name=issue.sheet_name,
                    row_number=issue.row_number,
                    column_name=issue.column_name,
                    message=issue.message,
                )
            )

    def issues(self, job_id: uuid.UUID) -> list[KnowledgeValidationIssue]:
        return list(
            self.db.scalars(
                select(KnowledgeValidationIssue)
                .where(KnowledgeValidationIssue.import_job_id == job_id)
                .order_by(
                    KnowledgeValidationIssue.severity,
                    KnowledgeValidationIssue.sheet_name,
                    KnowledgeValidationIssue.row_number,
                )
            )
        )

    def add_change_set(
        self,
        job_id: uuid.UUID,
        *,
        compiler_version: str,
        teaching_preview: list[dict[str, object]],
        nodes: list[dict[str, object]],
        relationships: list[dict[str, object]],
        summary: dict[str, int],
    ) -> KnowledgeGraphChangeSet:
        change_set = KnowledgeGraphChangeSet(
            import_job_id=job_id,
            status="review_ready",
            compiler_version=compiler_version,
            teaching_preview=teaching_preview,
            nodes=nodes,
            relationships=relationships,
            summary=summary,
        )
        self.db.add(change_set)
        return change_set

    def get_change_set(self, change_set_id: uuid.UUID) -> KnowledgeGraphChangeSet | None:
        return self.db.get(KnowledgeGraphChangeSet, change_set_id)

    def change_set_for_import(self, job_id: uuid.UUID) -> KnowledgeGraphChangeSet | None:
        return self.db.scalar(
            select(KnowledgeGraphChangeSet).where(KnowledgeGraphChangeSet.import_job_id == job_id)
        )

    def publication_for_change_set(
        self, change_set_id: uuid.UUID
    ) -> KnowledgeGraphPublication | None:
        return self.db.scalar(
            select(KnowledgeGraphPublication).where(
                KnowledgeGraphPublication.change_set_id == change_set_id
            )
        )

    def get_publication(self, publication_id: uuid.UUID) -> KnowledgeGraphPublication | None:
        return self.db.get(KnowledgeGraphPublication, publication_id)

    def active_publication(self, environment: str = "demo") -> KnowledgeGraphPublication | None:
        return self.db.scalar(
            select(KnowledgeGraphPublication).where(
                KnowledgeGraphPublication.environment == environment,
                KnowledgeGraphPublication.is_active.is_(True),
            )
        )

    def active_node_keys(self) -> set[str]:
        publication = self.active_publication()
        if publication is None:
            return set()
        nodes = publication.graph_payload.get("nodes", [])
        if not isinstance(nodes, list):
            return set()
        return {
            str(node["stable_key"])
            for node in nodes
            if isinstance(node, dict) and "stable_key" in node
        }

    def add_publication(
        self,
        change_set: KnowledgeGraphChangeSet,
        actor_id: uuid.UUID,
        graph_version: str,
        storage_backend: str,
    ) -> KnowledgeGraphPublication:
        self.db.execute(
            update(KnowledgeGraphPublication)
            .where(KnowledgeGraphPublication.environment == "demo")
            .values(is_active=False)
        )
        publication = KnowledgeGraphPublication(
            change_set_id=change_set.id,
            graph_version=graph_version,
            environment="demo",
            status="published",
            is_active=True,
            storage_backend=storage_backend,
            graph_payload={"nodes": change_set.nodes, "relationships": change_set.relationships},
            published_by_user_id=actor_id,
        )
        self.db.add(publication)
        return publication

    def audit(
        self,
        actor_id: uuid.UUID,
        action: str,
        target_type: str,
        target_id: object,
        details: dict[str, object] | None = None,
    ) -> None:
        self.db.add(
            KnowledgeGraphAuditEvent(
                actor_user_id=actor_id,
                action=action,
                target_type=target_type,
                target_id=str(target_id),
                details=details or {},
            )
        )

    def commit(self) -> None:
        self.db.commit()

    def refresh(self, instance: object) -> None:
        self.db.refresh(instance)
