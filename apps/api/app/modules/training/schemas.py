from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ScenarioPublic(BaseModel):
    scenario_title: str = Field(min_length=1)
    scenario_summary: str = Field(min_length=1)
    student_task: str = Field(min_length=1)
    student_role: str = Field(min_length=1)
    ai_role: str = Field(min_length=1)
    product: str = Field(min_length=1)
    negotiation_targets: list[str] = Field(min_length=1)
    checklist: list[str] = Field(min_length=1)
    opening_message: str = Field(min_length=1)


class ScenarioPrivate(BaseModel):
    seller_strategy: str = Field(min_length=1)
    opening_anchor: str = Field(min_length=1)
    bottom_line_reminder: str = Field(min_length=1)


class ScenarioCandidate(BaseModel):
    public: ScenarioPublic
    private: ScenarioPrivate


class CreateAttemptRequest(BaseModel):
    unit_id: str
    difficulty: str = "standard"


class MessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=8000)
    client_message_id: str = Field(min_length=8, max_length=100)


class DraftRequest(BaseModel):
    content: str = Field(max_length=8000)


class MessageResponse(BaseModel):
    id: uuid.UUID
    sequence_no: int
    role: str
    content: str
    status: str
    created_at: datetime


class ChecklistAssessmentResponse(BaseModel):
    item: str
    satisfied: bool
    rationale: str


class GraphRecommendationResponse(BaseModel):
    node_id: str
    node_type: str
    title: str
    confidence: float
    reason: str
    reveal_level: int


class RoundEvaluationResponse(BaseModel):
    id: uuid.UUID
    student_message_id: uuid.UUID
    assistant_message_id: uuid.UUID
    status: str
    score: float
    pros: str
    cons: str
    detailed_evaluation: str
    next_step_suggestion: str
    checklist_results: list[ChecklistAssessmentResponse]
    recommendations: list[GraphRecommendationResponse]
    model_name: str
    prompt_version: str
    created_at: datetime


class EvidenceResponse(BaseModel):
    message_id: uuid.UUID
    quote: str
    reason: str


class DimensionResponse(BaseModel):
    dimension_key: str
    label: str
    score: float
    weight: float
    comment: str
    evidence: list[EvidenceResponse]


class EvaluationResponse(BaseModel):
    id: uuid.UUID
    overall_score: float
    level: str
    summary: str
    strengths: list[str]
    improvements: list[str]
    next_actions: list[str]
    knowledge_tags: list[str]
    model_name: str
    prompt_version: str
    evaluation_status: str
    created_at: datetime
    dimensions: list[DimensionResponse]


class AttemptResponse(BaseModel):
    id: uuid.UUID
    unit_id: str
    unit_title: str
    training_mode: str
    status: str
    difficulty: str
    scenario: ScenarioPublic | None
    messages: list[MessageResponse]
    round_evaluations: list[RoundEvaluationResponse]
    evaluation: EvaluationResponse | None
    draft_content: str
    retry_of_attempt_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class AttemptHistoryItemResponse(BaseModel):
    id: uuid.UUID
    unit_id: str
    unit_title: str
    training_mode: str
    status: str
    overall_score: float | None
    retry_of_attempt_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class ProgressItemResponse(BaseModel):
    unit_id: str
    completed_attempt_id: uuid.UUID
    latest_score: float
    best_score: float
    completed_at: datetime


class ProgressResponse(BaseModel):
    completed_units: int
    items: list[ProgressItemResponse]
