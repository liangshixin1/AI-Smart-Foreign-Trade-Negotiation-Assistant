from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import utc_now


class CorrectionSession(Base):
    __tablename__ = "document_correction_sessions"
    attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id"), primary_key=True)
    bindings: Mapped[dict[str, Any]] = mapped_column(JSON)
    case_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    document_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    answer_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    case_hash: Mapped[str] = mapped_column(String(64))
    document_hash: Mapped[str] = mapped_column(String(64))
    answer_hash: Mapped[str] = mapped_column(String(64))
    revision: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(24), default="draft")
    submitted_revision: Mapped[int | None] = mapped_column(Integer)
    feedback: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class Annotation(Base):
    __tablename__ = "document_annotations"
    __table_args__ = (UniqueConstraint("attempt_id", "target_ref"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id"), index=True)
    target_ref: Mapped[str] = mapped_column(String(120))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    revision: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class Operation(Base):
    __tablename__ = "document_operations"
    __table_args__ = (UniqueConstraint("attempt_id", "client_operation_id"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id"), index=True)
    client_operation_id: Mapped[str] = mapped_column(String(120))
    request_hash: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    response: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class CorrectionResult(Base):
    __tablename__ = "document_correction_results"
    attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id"), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    annotation_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
