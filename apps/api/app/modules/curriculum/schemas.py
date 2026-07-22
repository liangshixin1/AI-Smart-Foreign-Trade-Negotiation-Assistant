from __future__ import annotations

import uuid

from pydantic import BaseModel


class UnitMapItem(BaseModel):
    id: str
    title: str
    description: str
    training_mode: str
    estimated_minutes: int
    status: str
    sort_order: int
    active_attempt_id: uuid.UUID | None = None


class ChapterMapItem(BaseModel):
    id: str
    title: str
    sort_order: int
    units: list[UnitMapItem]


class CourseMapResponse(BaseModel):
    course_id: str
    course_title: str
    course_version: str
    completed_units: int
    total_units: int
    chapters: list[ChapterMapItem]


class RubricDimensionResponse(BaseModel):
    key: str
    label: str
    weight: float


class UnitDetailResponse(BaseModel):
    id: str
    title: str
    description: str
    learning_objectives: list[str]
    training_mode: str
    prerequisite_unit_ids: list[str]
    estimated_minutes: int
    difficulty_options: list[str]
    knowledge_tags: list[str]
    rubric_dimensions: list[RubricDimensionResponse]
    status: str
