from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import utc_now


class Attempt(Base):
    __tablename__ = "attempts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    unit_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("training_units.id"), index=True)
    course_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("course_versions.id"))
    retry_of_attempt_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("attempts.id"))
    status: Mapped[str] = mapped_column(String(32), index=True)
    difficulty: Mapped[str] = mapped_column(String(32))
    content_bindings: Mapped[dict[str, str]] = mapped_column(JSON)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
    scenario: Mapped[ScenarioSnapshot | None] = relationship(
        back_populates="attempt", uselist=False, cascade="all, delete-orphan"
    )
    messages: Mapped[list[Message]] = relationship(
        back_populates="attempt", order_by="Message.sequence_no", cascade="all, delete-orphan"
    )


class AttemptDraft(Base):
    __tablename__ = "attempt_drafts"

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), primary_key=True
    )
    content: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class AttemptRetry(Base):
    __tablename__ = "attempt_retries"
    __table_args__ = (UniqueConstraint("student_id", "idempotency_key"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    source_attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id"), index=True)
    created_attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id"), unique=True)
    idempotency_key: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ScenarioSnapshot(Base):
    __tablename__ = "scenario_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), unique=True
    )
    public_payload: Mapped[dict[str, object]] = mapped_column(JSON)
    private_payload: Mapped[dict[str, object]] = mapped_column(JSON)
    content_hash: Mapped[str] = mapped_column(String(64))
    provider: Mapped[str] = mapped_column(String(40))
    model_name: Mapped[str] = mapped_column(String(120))
    prompt_template_id: Mapped[str] = mapped_column(String(120))
    prompt_version: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    attempt: Mapped[Attempt] = relationship(back_populates="scenario")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        UniqueConstraint("attempt_id", "sequence_no"),
        UniqueConstraint("attempt_id", "client_message_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), index=True
    )
    sequence_no: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="completed")
    client_message_id: Mapped[str | None] = mapped_column(String(100))
    failure_code: Mapped[str | None] = mapped_column(String(80))
    provider: Mapped[str | None] = mapped_column(String(40))
    model_name: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    attempt: Mapped[Attempt] = relationship(back_populates="messages")


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("attempt_id"), UniqueConstraint("idempotency_key"))

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), index=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(120))
    conversation_hash: Mapped[str] = mapped_column(String(64))
    frozen_payload: Mapped[dict[str, object]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class AttemptEvent(Base):
    __tablename__ = "attempt_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), index=True
    )
    from_status: Mapped[str | None] = mapped_column(String(32))
    to_status: Mapped[str] = mapped_column(String(32))
    reason: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class LLMInvocation(Base):
    __tablename__ = "llm_invocations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), index=True
    )
    purpose: Mapped[str] = mapped_column(String(32))
    correlation_id: Mapped[str] = mapped_column(String(100), unique=True)
    provider: Mapped[str] = mapped_column(String(40))
    model_name: Mapped[str] = mapped_column(String(120))
    prompt_template_id: Mapped[str] = mapped_column(String(120))
    prompt_version: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20))
    usage: Mapped[dict[str, int]] = mapped_column(JSON, default=dict)
    error_category: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
