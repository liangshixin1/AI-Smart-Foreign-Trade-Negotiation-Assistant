from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.assessment.schemas import LearningDiagnosticCandidate
from app.modules.knowledge_graph.schemas import (
    GraphLearningEvidenceResponse,
    ScaffoldInteractionResponse,
)
from app.modules.training.schemas import AttemptResponse


class ClassroomItem(BaseModel):
    id: uuid.UUID
    name: str
    student_count: int


class ClassroomOverview(BaseModel):
    student_count: int
    active_students_7d: int
    completed_attempts: int
    average_score: float | None
    attention_count: int
    weak_dimensions: list[CompetencySummary]


class StudentItem(BaseModel):
    id: uuid.UUID
    student_no: str
    display_name: str
    email: str
    status: str
    completed_units: int
    total_units: int
    completion_rate: float
    current_unit_title: str | None
    latest_score: float | None
    last_active_at: datetime | None
    risk_reasons: list[str]


class StudentCreate(BaseModel):
    student_no: str = Field(min_length=1, max_length=64)
    display_name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    initial_password: str = Field(min_length=8, max_length=128)


class StudentUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = Field(
        default=None, min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    )
    status: str | None = Field(default=None, pattern="^(active|disabled)$")
    new_password: str | None = Field(default=None, min_length=8, max_length=128)


class ImportStudentsRequest(BaseModel):
    rows: list[StudentCreate] = Field(min_length=1, max_length=500)


class ImportResult(BaseModel):
    created: int
    enrolled: int


class AttemptSummary(BaseModel):
    id: uuid.UUID
    unit_id: str
    unit_title: str
    status: str
    overall_score: float | None
    created_at: datetime
    completed_at: datetime | None


class DimensionTrendPoint(BaseModel):
    attempt_id: uuid.UUID
    score: float
    created_at: datetime


class CompetencySummary(BaseModel):
    dimension_key: str
    label: str
    average_score: float
    latest_score: float
    evidence_count: int
    attempt_count: int
    needs_attention: bool
    trend: list[DimensionTrendPoint]


class StudentDetail(BaseModel):
    student: StudentItem
    attempts: list[AttemptSummary]
    competencies: list[CompetencySummary]


class AttemptReplay(BaseModel):
    attempt: AttemptResponse
    course_version_id: uuid.UUID
    content_bindings: dict[str, str]
    submission_created_at: datetime | None
    frozen_submission: dict[str, object] | None
    scaffold_interactions: list[ScaffoldInteractionResponse]
    graph_learning_evidence: list[GraphLearningEvidenceResponse]
    round_learning_diagnostics: list[RoundLearningDiagnostic]
    final_learning_diagnostic: LearningDiagnosticCandidate | None


class RoundLearningDiagnostic(BaseModel):
    round_evaluation_id: uuid.UUID
    student_message_id: uuid.UUID
    created_at: datetime
    diagnostic: LearningDiagnosticCandidate
