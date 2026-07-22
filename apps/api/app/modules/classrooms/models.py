from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import utc_now


class Classroom(Base):
    __tablename__ = "classrooms"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160))
    course_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("course_versions.id"))
    owner_teacher_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("classroom_id", "student_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    classroom_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classrooms.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(32), default="active")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
