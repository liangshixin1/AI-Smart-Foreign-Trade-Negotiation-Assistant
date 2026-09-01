from __future__ import annotations

import hashlib
import json
import uuid

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.modules.knowledge_graph.models import (
    KnowledgeGraphAuditEvent,
    KnowledgeGraphChangeSet,
    KnowledgeGraphKnowledgePointSnapshot,
    KnowledgeGraphKnowledgeType,
    KnowledgeGraphPhenomenonKnowledgeEdge,
    KnowledgeGraphPhenomenonSnapshot,
    KnowledgeGraphPublication,
    KnowledgeGraphScenarioPhenomenonBinding,
    KnowledgeGraphScenarioStageBinding,
    KnowledgeGraphStageSnapshot,
    KnowledgeGraphTranslationOverlay,
    KnowledgeImportJob,
    KnowledgeNodeDisplayOverride,
    KnowledgeValidationIssue,
    KnowledgeWorkbookAsset,
)
from app.modules.knowledge_graph.types import ImportIssue, ParsedWorkbookData
from app.modules.knowledge_graph.v3_contract import EXPERT_V3_KNOWLEDGE_TYPES
from app.modules.knowledge_graph.v3_extensions import V3_SCENARIOS


def _row_hash(row: dict[str, object]) -> str:
    payload = {key: value for key, value in row.items() if key != "__row__"}
    return hashlib.sha256(
        json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()


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
        self.db.flush()
        return change_set

    def add_expert_v3_snapshots(
        self,
        change_set_id: uuid.UUID,
        data: ParsedWorkbookData,
        translations: dict[str, list[dict[str, object]]],
    ) -> None:
        """持久化不可变专家事实和独立翻译/平台绑定, 便于审计与回滚。"""

        for order, (code, name_zh) in enumerate(EXPERT_V3_KNOWLEDGE_TYPES.items(), 1):
            self.db.merge(KnowledgeGraphKnowledgeType(code=code, name_zh=name_zh, sort_order=order))
        for row in data.sheets["01_L1_Stages"]:
            self.db.add(
                KnowledgeGraphStageSnapshot(
                    change_set_id=change_set_id,
                    stage_id=str(row["Stage ID"]),
                    sequence=int(str(row["Seq"])),
                    name_en=str(row["Stage name"]),
                    short_en=str(row["Short"]),
                    description_en=str(row["Description"]),
                    obe_outcome_en=str(row["OBE teaching outcome"]),
                    source_row_number=int(str(row["__row__"])),
                    source_row_hash=_row_hash(row),
                )
            )
        phenomena_by_stage: dict[str, list[str]] = {}
        for row in data.sheets["02_L2_Phenomena"]:
            stage_id = str(row["Stage ID"])
            phenomenon_id = str(row["Phenomenon ID"])
            phenomena_by_stage.setdefault(stage_id, []).append(phenomenon_id)
            self.db.add(
                KnowledgeGraphPhenomenonSnapshot(
                    change_set_id=change_set_id,
                    phenomenon_id=phenomenon_id,
                    stage_id=stage_id,
                    name_en=str(row["Phenomenon (business problem)"]),
                    description_en=str(row["Brief description"]),
                    risk=str(row["Risk"]),
                    frequency=str(row["Frequency"]),
                    linked_knowledge_count=int(str(row["Linked L3 count"])),
                    source_row_number=int(str(row["__row__"])),
                    source_row_hash=_row_hash(row),
                )
            )
        for row in data.sheets["03_L3_Knowledge"]:
            self.db.add(
                KnowledgeGraphKnowledgePointSnapshot(
                    change_set_id=change_set_id,
                    knowledge_id=str(row["Knowledge ID"]),
                    knowledge_type_code=str(row["Type"]),
                    home_stage_id=str(row["Home stage ID"]),
                    name_en=str(row["Name"]),
                    definition_en=str(row["Definition"]),
                    phenomena_served=int(str(row["Phenomena served"])),
                    stages_served=int(str(row["Stages served"])),
                    source_row_number=int(str(row["__row__"])),
                    source_row_hash=_row_hash(row),
                )
            )
        for row in data.sheets["04_Edges"]:
            self.db.add(
                KnowledgeGraphPhenomenonKnowledgeEdge(
                    change_set_id=change_set_id,
                    stage_id=str(row["Stage ID"]),
                    phenomenon_id=str(row["Phenomenon ID"]),
                    knowledge_id=str(row["Knowledge ID"]),
                    addressing_note_en=str(row["How this knowledge addresses the phenomenon"]),
                    source_row_number=int(str(row["__row__"])),
                    source_row_hash=_row_hash(row),
                )
            )
        field_maps = {
            "stages": ("stage", ("name_zh", "short_name_zh", "description_zh", "obe_outcome_zh")),
            "phenomena": ("phenomenon", ("name_zh", "short_name_zh", "description_zh")),
            "knowledge": ("knowledge_point", ("name_zh", "short_name_zh", "definition_zh")),
        }
        for group, (entity_type, fields) in field_maps.items():
            for item in translations[group]:
                for field_name in fields:
                    self.db.add(
                        KnowledgeGraphTranslationOverlay(
                            change_set_id=change_set_id,
                            entity_type=entity_type,
                            entity_id=str(item["id"]),
                            field_name=field_name,
                            translated_text=str(item[field_name]),
                            translation_status="reviewed",
                        )
                    )
        for scenario in V3_SCENARIOS:
            self.db.add(
                KnowledgeGraphScenarioStageBinding(
                    change_set_id=change_set_id,
                    scenario_id=scenario["id"],
                    stage_id=scenario["stage_id"],
                    course_unit_id=scenario["unit"],
                )
            )
            for phenomenon_id in phenomena_by_stage[scenario["stage_id"]]:
                self.db.add(
                    KnowledgeGraphScenarioPhenomenonBinding(
                        change_set_id=change_set_id,
                        scenario_id=scenario["id"],
                        phenomenon_id=phenomenon_id,
                        mapping_method="stage_scope",
                    )
                )

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

    def previous_publication(
        self, publication: KnowledgeGraphPublication
    ) -> KnowledgeGraphPublication | None:
        return self.db.scalar(
            select(KnowledgeGraphPublication)
            .where(
                KnowledgeGraphPublication.environment == publication.environment,
                KnowledgeGraphPublication.id != publication.id,
                KnowledgeGraphPublication.published_at < publication.published_at,
            )
            .order_by(KnowledgeGraphPublication.published_at.desc())
        )

    def activate_publication(self, publication: KnowledgeGraphPublication) -> None:
        self.db.execute(
            update(KnowledgeGraphPublication)
            .where(KnowledgeGraphPublication.environment == publication.environment)
            .values(is_active=False)
        )
        publication.status = "published"
        publication.is_active = True
        publication.rolled_back_at = None

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

    def display_override(
        self, graph_version: str, node_key: str
    ) -> KnowledgeNodeDisplayOverride | None:
        return self.db.scalar(
            select(KnowledgeNodeDisplayOverride).where(
                KnowledgeNodeDisplayOverride.graph_version == graph_version,
                KnowledgeNodeDisplayOverride.node_key == node_key,
            )
        )

    def display_overrides(
        self, graph_version: str, node_keys: set[str]
    ) -> dict[str, KnowledgeNodeDisplayOverride]:
        if not node_keys:
            return {}
        rows = self.db.scalars(
            select(KnowledgeNodeDisplayOverride).where(
                KnowledgeNodeDisplayOverride.graph_version == graph_version,
                KnowledgeNodeDisplayOverride.node_key.in_(node_keys),
            )
        )
        return {item.node_key: item for item in rows}

    def add_display_override(
        self,
        *,
        graph_version: str,
        node_key: str,
        short_name_zh: str,
        actor_id: uuid.UUID,
    ) -> KnowledgeNodeDisplayOverride:
        override = KnowledgeNodeDisplayOverride(
            graph_version=graph_version,
            node_key=node_key,
            short_name_zh=short_name_zh,
            updated_by_user_id=actor_id,
        )
        self.db.add(override)
        return override

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
