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


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(100), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(32), default="active")
    versions: Mapped[list[CourseVersion]] = relationship(back_populates="course")


class CourseVersion(Base):
    __tablename__ = "course_versions"
    __table_args__ = (UniqueConstraint("course_id", "version"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id"))
    version: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(32))
    source_hash: Mapped[str] = mapped_column(String(64))
    manifest_hash: Mapped[str] = mapped_column(String(64))
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    course: Mapped[Course] = relationship(back_populates="versions")
    chapters: Mapped[list[Chapter]] = relationship(back_populates="course_version")


class TrainingTemplate(Base):
    __tablename__ = "training_templates"
    __table_args__ = (UniqueConstraint("template_key", "version"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    template_key: Mapped[str] = mapped_column(String(100))
    version: Mapped[str] = mapped_column(String(50))
    training_mode: Mapped[str] = mapped_column(String(32))
    input_variables: Mapped[list[str]] = mapped_column(JSON)
    workspace_contract: Mapped[dict[str, object]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32))


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"
    __table_args__ = (UniqueConstraint("prompt_key", "version"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    prompt_key: Mapped[str] = mapped_column(String(120))
    version: Mapped[str] = mapped_column(String(50))
    purpose: Mapped[str] = mapped_column(String(32))
    training_modes: Mapped[list[str]] = mapped_column(JSON)
    input_variables: Mapped[list[str]] = mapped_column(JSON)
    output_schema: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(Text)
    change_log: Mapped[list[dict[str, str]]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32))


class Rubric(Base):
    __tablename__ = "rubrics"
    __table_args__ = (UniqueConstraint("rubric_key", "version"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    rubric_key: Mapped[str] = mapped_column(String(100))
    version: Mapped[str] = mapped_column(String(50))
    pass_score: Mapped[float] = mapped_column(Float)
    dimensions: Mapped[list[dict[str, object]]] = mapped_column(JSON)
    hard_fail_rules: Mapped[list[str]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32))


class Chapter(Base):
    __tablename__ = "chapters"
    __table_args__ = (UniqueConstraint("course_version_id", "chapter_key"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    course_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("course_versions.id"))
    chapter_key: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(200))
    sort_order: Mapped[int] = mapped_column(Integer)
    course_version: Mapped[CourseVersion] = relationship(back_populates="chapters")
    units: Mapped[list[TrainingUnit]] = relationship(back_populates="chapter")


class TrainingUnit(Base):
    __tablename__ = "training_units"
    __table_args__ = (UniqueConstraint("chapter_id", "unit_key"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    chapter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("chapters.id"))
    unit_key: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    learning_objectives: Mapped[list[str]] = mapped_column(JSON)
    training_mode: Mapped[str] = mapped_column(String(32))
    prerequisite_unit_ids: Mapped[list[str]] = mapped_column(JSON)
    estimated_minutes: Mapped[int] = mapped_column(Integer)
    difficulty_options: Mapped[list[str]] = mapped_column(JSON)
    knowledge_tags: Mapped[list[str]] = mapped_column(JSON)
    sort_order: Mapped[int] = mapped_column(Integer)
    version: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(32))
    template_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("training_templates.id"))
    rubric_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rubrics.id"))
    scenario_prompt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("prompt_templates.id"))
    conversation_prompt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("prompt_templates.id"))
    round_evaluation_prompt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("prompt_templates.id"))
    evaluation_prompt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("prompt_templates.id"))
    chapter: Mapped[Chapter] = relationship(back_populates="units")
    template: Mapped[TrainingTemplate] = relationship()
    rubric: Mapped[Rubric] = relationship()
    scenario_prompt: Mapped[PromptTemplate] = relationship(foreign_keys=[scenario_prompt_id])
    conversation_prompt: Mapped[PromptTemplate] = relationship(
        foreign_keys=[conversation_prompt_id]
    )
    round_evaluation_prompt: Mapped[PromptTemplate] = relationship(
        foreign_keys=[round_evaluation_prompt_id]
    )
    evaluation_prompt: Mapped[PromptTemplate] = relationship(foreign_keys=[evaluation_prompt_id])
