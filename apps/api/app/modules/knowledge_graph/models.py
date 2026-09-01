from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import utc_now


class KnowledgeImportJob(Base):
    __tablename__ = "knowledge_import_jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    template_version: Mapped[str] = mapped_column(String(30), index=True)
    source_filename: Mapped[str] = mapped_column(String(255))
    source_hash: Mapped[str] = mapped_column(String(64), index=True)
    source_size: Mapped[int] = mapped_column(Integer)
    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    warning_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class KnowledgeWorkbookAsset(Base):
    __tablename__ = "knowledge_workbook_assets"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    import_job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_import_jobs.id", ondelete="CASCADE"), unique=True
    )
    content: Mapped[bytes] = mapped_column(LargeBinary)
    content_type: Mapped[str] = mapped_column(String(120))


class KnowledgeValidationIssue(Base):
    __tablename__ = "knowledge_validation_issues"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    import_job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_import_jobs.id", ondelete="CASCADE"), index=True
    )
    severity: Mapped[str] = mapped_column(String(20), index=True)
    code: Mapped[str] = mapped_column(String(80))
    sheet_name: Mapped[str] = mapped_column(String(80))
    row_number: Mapped[int | None] = mapped_column(Integer)
    column_name: Mapped[str | None] = mapped_column(String(120))
    message: Mapped[str] = mapped_column(Text)


class KnowledgeGraphChangeSet(Base):
    __tablename__ = "knowledge_graph_change_sets"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    import_job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_import_jobs.id", ondelete="CASCADE"), unique=True
    )
    status: Mapped[str] = mapped_column(String(32), index=True)
    compiler_version: Mapped[str] = mapped_column(String(80))
    teaching_preview: Mapped[list[dict[str, object]]] = mapped_column(JSON)
    nodes: Mapped[list[dict[str, object]]] = mapped_column(JSON)
    relationships: Mapped[list[dict[str, object]]] = mapped_column(JSON)
    summary: Mapped[dict[str, int]] = mapped_column(JSON)
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class KnowledgeGraphKnowledgeType(Base):
    """专家定义的七类知识点字典, 代码值不可由教师界面随意改名。"""

    __tablename__ = "knowledge_graph_knowledge_types"

    code: Mapped[str] = mapped_column(String(40), primary_key=True)
    name_zh: Mapped[str] = mapped_column(String(40))
    sort_order: Mapped[int] = mapped_column(Integer)


class KnowledgeGraphStageSnapshot(Base):
    __tablename__ = "knowledge_graph_stage_snapshots"
    __table_args__ = (UniqueConstraint("change_set_id", "stage_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    change_set_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_graph_change_sets.id", ondelete="CASCADE"), index=True
    )
    stage_id: Mapped[str] = mapped_column(String(20), index=True)
    sequence: Mapped[int] = mapped_column(Integer)
    name_en: Mapped[str] = mapped_column(String(255))
    short_en: Mapped[str] = mapped_column(String(120))
    description_en: Mapped[str] = mapped_column(Text)
    obe_outcome_en: Mapped[str] = mapped_column(Text)
    source_row_number: Mapped[int] = mapped_column(Integer)
    source_row_hash: Mapped[str] = mapped_column(String(64))


class KnowledgeGraphPhenomenonSnapshot(Base):
    __tablename__ = "knowledge_graph_phenomenon_snapshots"
    __table_args__ = (UniqueConstraint("change_set_id", "phenomenon_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    change_set_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_graph_change_sets.id", ondelete="CASCADE"), index=True
    )
    phenomenon_id: Mapped[str] = mapped_column(String(20), index=True)
    stage_id: Mapped[str] = mapped_column(String(20), index=True)
    name_en: Mapped[str] = mapped_column(String(255))
    description_en: Mapped[str] = mapped_column(Text)
    risk: Mapped[str] = mapped_column(String(20), index=True)
    frequency: Mapped[str] = mapped_column(String(20), index=True)
    linked_knowledge_count: Mapped[int] = mapped_column(Integer)
    source_row_number: Mapped[int] = mapped_column(Integer)
    source_row_hash: Mapped[str] = mapped_column(String(64))


class KnowledgeGraphKnowledgePointSnapshot(Base):
    __tablename__ = "knowledge_graph_knowledge_point_snapshots"
    __table_args__ = (UniqueConstraint("change_set_id", "knowledge_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    change_set_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_graph_change_sets.id", ondelete="CASCADE"), index=True
    )
    knowledge_id: Mapped[str] = mapped_column(String(20), index=True)
    knowledge_type_code: Mapped[str] = mapped_column(
        ForeignKey("knowledge_graph_knowledge_types.code"), index=True
    )
    home_stage_id: Mapped[str] = mapped_column(String(20), index=True)
    name_en: Mapped[str] = mapped_column(String(255))
    definition_en: Mapped[str] = mapped_column(Text)
    phenomena_served: Mapped[int] = mapped_column(Integer)
    stages_served: Mapped[int] = mapped_column(Integer)
    source_row_number: Mapped[int] = mapped_column(Integer)
    source_row_hash: Mapped[str] = mapped_column(String(64))


class KnowledgeGraphPhenomenonKnowledgeEdge(Base):
    __tablename__ = "knowledge_graph_phenomenon_knowledge_edges"
    __table_args__ = (UniqueConstraint("change_set_id", "phenomenon_id", "knowledge_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    change_set_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_graph_change_sets.id", ondelete="CASCADE"), index=True
    )
    stage_id: Mapped[str] = mapped_column(String(20), index=True)
    phenomenon_id: Mapped[str] = mapped_column(String(20), index=True)
    knowledge_id: Mapped[str] = mapped_column(String(20), index=True)
    addressing_note_en: Mapped[str] = mapped_column(Text)
    source_row_number: Mapped[int] = mapped_column(Integer)
    source_row_hash: Mapped[str] = mapped_column(String(64))


class KnowledgeGraphTranslationOverlay(Base):
    __tablename__ = "knowledge_graph_translation_overlays"
    __table_args__ = (
        UniqueConstraint("change_set_id", "entity_type", "entity_id", "field_name", "locale"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    change_set_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_graph_change_sets.id", ondelete="CASCADE"), index=True
    )
    entity_type: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[str] = mapped_column(String(30), index=True)
    field_name: Mapped[str] = mapped_column(String(50))
    locale: Mapped[str] = mapped_column(String(12), default="zh-CN")
    translated_text: Mapped[str] = mapped_column(Text)
    translation_status: Mapped[str] = mapped_column(String(30), default="reviewed")


class KnowledgeGraphScenarioStageBinding(Base):
    __tablename__ = "knowledge_graph_scenario_stage_bindings"
    __table_args__ = (UniqueConstraint("change_set_id", "scenario_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    change_set_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_graph_change_sets.id", ondelete="CASCADE"), index=True
    )
    scenario_id: Mapped[str] = mapped_column(String(30), index=True)
    stage_id: Mapped[str] = mapped_column(String(20), index=True)
    course_unit_id: Mapped[str] = mapped_column(String(120), index=True)


class KnowledgeGraphScenarioPhenomenonBinding(Base):
    __tablename__ = "knowledge_graph_scenario_phenomenon_bindings"
    __table_args__ = (UniqueConstraint("change_set_id", "scenario_id", "phenomenon_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    change_set_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_graph_change_sets.id", ondelete="CASCADE"), index=True
    )
    scenario_id: Mapped[str] = mapped_column(String(30), index=True)
    phenomenon_id: Mapped[str] = mapped_column(String(20), index=True)
    mapping_method: Mapped[str] = mapped_column(String(30), default="stage_scope")


class KnowledgeGraphPublication(Base):
    __tablename__ = "knowledge_graph_publications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    change_set_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_graph_change_sets.id"), unique=True
    )
    graph_version: Mapped[str] = mapped_column(String(80), unique=True)
    environment: Mapped[str] = mapped_column(String(30), index=True)
    status: Mapped[str] = mapped_column(String(30), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    storage_backend: Mapped[str] = mapped_column(String(50))
    graph_payload: Mapped[dict[str, object]] = mapped_column(JSON)
    published_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    rolled_back_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class KnowledgeGraphAuditEvent(Base):
    __tablename__ = "knowledge_graph_audit_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    actor_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    target_type: Mapped[str] = mapped_column(String(50))
    target_id: Mapped[str] = mapped_column(String(80))
    details: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class KnowledgeNodeDisplayOverride(Base):
    """教师对已发布节点展示名称的版本化覆盖, 不修改 Neo4j 原始节点."""

    __tablename__ = "knowledge_node_display_overrides"
    __table_args__ = (UniqueConstraint("graph_version", "node_key"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    graph_version: Mapped[str] = mapped_column(String(80), index=True)
    node_key: Mapped[str] = mapped_column(String(180), index=True)
    short_name_zh: Mapped[str] = mapped_column(String(32))
    revision: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    updated_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    __mapper_args__ = {"version_id_col": revision}  # noqa: RUF012


class KnowledgeScaffoldInteraction(Base):
    __tablename__ = "knowledge_scaffold_interactions"
    __table_args__ = (UniqueConstraint("student_id", "client_event_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    graph_version: Mapped[str] = mapped_column(String(80), index=True)
    scaffold_node_key: Mapped[str] = mapped_column(String(180), index=True)
    phenomenon_node_key: Mapped[str | None] = mapped_column(String(180), index=True)
    event_type: Mapped[str] = mapped_column(String(24), index=True)
    level: Mapped[str] = mapped_column(String(40))
    client_event_id: Mapped[str] = mapped_column(String(100))
    scaffold_snapshot: Mapped[dict[str, object]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class GraphLearningEvidence(Base):
    __tablename__ = "graph_learning_evidence"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    round_evaluation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("round_evaluations.id", ondelete="CASCADE"), unique=True
    )
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), index=True
    )
    student_message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("messages.id"), index=True)
    graph_version: Mapped[str] = mapped_column(String(80), index=True)
    phenomenon_node_keys: Mapped[list[str]] = mapped_column(JSON)
    strategy_node_keys: Mapped[list[str]] = mapped_column(JSON)
    knowledge_resource_node_keys: Mapped[list[str]] = mapped_column(JSON)
    knowledge_point_node_keys: Mapped[list[str]] = mapped_column(JSON, default=list)
    knowledge_type_breakdown: Mapped[dict[str, int]] = mapped_column(JSON, default=dict)
    score: Mapped[float] = mapped_column(Float)
    evidence_summary: Mapped[str] = mapped_column(Text)
    mapping_method: Mapped[str] = mapped_column(String(50), default="unit_scope_inferred")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class KnowledgeLearningContent(Base):
    """教师对已发布图谱节点的版本化教学内容覆盖层。"""

    __tablename__ = "knowledge_learning_contents"
    __table_args__ = (UniqueConstraint("graph_version", "node_key"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    graph_version: Mapped[str] = mapped_column(String(80), index=True)
    node_key: Mapped[str] = mapped_column(String(180), index=True)
    node_type: Mapped[str] = mapped_column(String(50), index=True)
    title: Mapped[str] = mapped_column(String(255))
    summary: Mapped[str] = mapped_column(Text)
    markdown_body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), index=True)
    updated_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class KnowledgeContentAsset(Base):
    """知识或策略节点的受控教学媒体; 不向教师暴露存储地址。"""

    __tablename__ = "knowledge_content_assets"
    __table_args__ = (UniqueConstraint("graph_version", "node_key", "asset_kind"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    graph_version: Mapped[str] = mapped_column(String(80), index=True)
    node_key: Mapped[str] = mapped_column(String(180), index=True)
    asset_kind: Mapped[str] = mapped_column(String(20), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(160))
    size_bytes: Mapped[int] = mapped_column(Integer)
    content: Mapped[bytes] = mapped_column(LargeBinary)
    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
