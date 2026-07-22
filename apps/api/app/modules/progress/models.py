from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import utc_now


class ProgressRecord(Base):
    __tablename__ = "progress_records"
    __table_args__ = (UniqueConstraint("student_id", "course_version_id", "unit_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    course_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("course_versions.id"))
    unit_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("training_units.id"), index=True)
    completed_attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id"))
    latest_score: Mapped[float] = mapped_column(Float)
    best_score: Mapped[float] = mapped_column(Float)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
