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
