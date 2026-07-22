from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import utc_now


class Evaluation(Base):
    __tablename__ = "evaluations"
    __table_args__ = (UniqueConstraint("attempt_id", "run_no"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id"), index=True)
    submission_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("submissions.id"), index=True)
    run_no: Mapped[int] = mapped_column(Integer)
    evaluation_status: Mapped[str] = mapped_column(String(24))
    overall_score: Mapped[float] = mapped_column(Float)
    level: Mapped[str] = mapped_column(String(40))
    summary: Mapped[str] = mapped_column(Text)
    strengths: Mapped[list[str]] = mapped_column(JSON)
    improvements: Mapped[list[str]] = mapped_column(JSON)
    next_actions: Mapped[list[str]] = mapped_column(JSON)
    knowledge_tags: Mapped[list[str]] = mapped_column(JSON)
    learning_diagnostic: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    provider: Mapped[str] = mapped_column(String(40))
    model_name: Mapped[str] = mapped_column(String(120))
    prompt_template_id: Mapped[str] = mapped_column(String(120))
    prompt_version: Mapped[str] = mapped_column(String(50))
    raw_output_reference: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    dimensions: Mapped[list[EvaluationDimension]] = relationship(
        back_populates="evaluation", cascade="all, delete-orphan"
    )


class EvaluationDimension(Base):
    __tablename__ = "evaluation_dimensions"
    __table_args__ = (UniqueConstraint("evaluation_id", "dimension_key"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    evaluation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("evaluations.id", ondelete="CASCADE"), index=True
    )
    dimension_key: Mapped[str] = mapped_column(String(100))
    label: Mapped[str] = mapped_column(String(120))
    score: Mapped[float] = mapped_column(Float)
    weight: Mapped[float] = mapped_column(Float)
    comment: Mapped[str] = mapped_column(Text)
    evaluation: Mapped[Evaluation] = relationship(back_populates="dimensions")
    evidence: Mapped[list[CompetencyEvidence]] = relationship(
        back_populates="dimension", cascade="all, delete-orphan"
    )


class CompetencyEvidence(Base):
    __tablename__ = "competency_evidence"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    dimension_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("evaluation_dimensions.id", ondelete="CASCADE"), index=True
    )
    message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("messages.id"), index=True)
    quote: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(Text)
    dimension: Mapped[EvaluationDimension] = relationship(back_populates="evidence")


class RoundEvaluation(Base):
    __tablename__ = "round_evaluations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id"), index=True)
    student_message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("messages.id"), index=True)
    assistant_message_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("messages.id"), unique=True, index=True
    )
    status: Mapped[str] = mapped_column(String(24))
    score: Mapped[float] = mapped_column(Float)
    pros: Mapped[str] = mapped_column(String(240))
    cons: Mapped[str] = mapped_column(String(240))
    detailed_evaluation: Mapped[str] = mapped_column(Text)
    next_step_suggestion: Mapped[str] = mapped_column(Text)
    checklist_results: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list)
    recommendations: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list)
    learning_diagnostic: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    provider: Mapped[str] = mapped_column(String(40))
    model_name: Mapped[str] = mapped_column(String(120))
    prompt_template_id: Mapped[str] = mapped_column(String(120))
    prompt_version: Mapped[str] = mapped_column(String(50))
    raw_output_reference: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
