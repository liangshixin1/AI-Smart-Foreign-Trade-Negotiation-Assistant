from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import utc_now


class AttemptCreationRequest(Base):
    __tablename__ = "attempt_creation_requests"
    __table_args__ = (UniqueConstraint("student_id", "operation", "idempotency_key"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    operation: Mapped[str] = mapped_column(String(40), default="create_attempt")
    idempotency_key: Mapped[str] = mapped_column(String(120))
    request_hash: Mapped[str] = mapped_column(String(64))
    attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id"), unique=True)
    status: Mapped[str] = mapped_column(String(24), default="started")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class SimulationSession(Base):
    __tablename__ = "simulation_sessions"

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), primary_key=True
    )
    profile_id: Mapped[str] = mapped_column(String(120))
    profile_version: Mapped[str] = mapped_column(String(50))
    schema_version: Mapped[str] = mapped_column(String(50), default="simulation.session.v1")
    briefing_payload: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list)
    briefing_hash: Mapped[str] = mapped_column(String(64))
    briefing_status: Mapped[str] = mapped_column(String(24), default="ready")
    character_id: Mapped[str] = mapped_column(String(80))
    display_name: Mapped[str] = mapped_column(String(120))
    scene_id: Mapped[str] = mapped_column(String(80))
    asset_pack: Mapped[str] = mapped_column(String(120))
    asset_pack_version: Mapped[str] = mapped_column(String(50))
    latest_state_revision: Mapped[int] = mapped_column(Integer, default=0)
    latest_state_payload: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    analysis_status: Mapped[str] = mapped_column(String(24), default="ready")
    generation_owner: Mapped[str | None] = mapped_column(String(100))
    generation_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    generation_revision: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class SimulationTurnPresentation(Base):
    __tablename__ = "simulation_turn_presentations"
    __table_args__ = (UniqueConstraint("assistant_message_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), index=True
    )
    assistant_message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("messages.id"))
    student_message_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("messages.id"))
    schema_version: Mapped[str] = mapped_column(String(50), default="simulation.presentation.v1")
    beats: Mapped[list[dict[str, object]]] = mapped_column(JSON)
    canonical_text_hash: Mapped[str] = mapped_column(String(64))
    source: Mapped[str] = mapped_column(String(40), default="llm")
    input_state_revision: Mapped[int] = mapped_column(Integer)
    conversation_revision: Mapped[int] = mapped_column(Integer)
    prompt_binding: Mapped[dict[str, str]] = mapped_column(JSON)
    asset_pack_version: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class SimulationStateEvent(Base):
    __tablename__ = "simulation_state_events"
    __table_args__ = (UniqueConstraint("attempt_id", "dedupe_key"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), index=True
    )
    round_evaluation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("round_evaluations.id", ondelete="CASCADE"), index=True
    )
    student_message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("messages.id"))
    assistant_message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("messages.id"))
    event_kind: Mapped[str] = mapped_column(String(80))
    target_key: Mapped[str] = mapped_column(String(80))
    term_version: Mapped[int] = mapped_column(Integer, default=0)
    evidence: Mapped[list[dict[str, object]]] = mapped_column(JSON)
    confidence: Mapped[float]
    dedupe_key: Mapped[str] = mapped_column(String(64))
    decision: Mapped[str] = mapped_column(String(24))
    validation_reason: Mapped[str] = mapped_column(Text)
    rules_version: Mapped[str] = mapped_column(String(50))
    source_conversation_revision: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class SimulationStateSnapshot(Base):
    __tablename__ = "simulation_state_snapshots"
    __table_args__ = (UniqueConstraint("attempt_id", "state_revision"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), index=True
    )
    state_revision: Mapped[int] = mapped_column(Integer)
    source_round_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("round_evaluations.id"))
    parent_revision: Mapped[int | None] = mapped_column(Integer)
    payload: Mapped[dict[str, object]] = mapped_column(JSON)
    applied_event_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    rules_version: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
