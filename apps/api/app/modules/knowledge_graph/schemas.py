from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ValidationIssueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    severity: Literal["error", "warning", "suggestion"]
    code: str
    sheet_name: str
    row_number: int | None
    column_name: str | None
    message: str


class ImportJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    template_version: str
    source_filename: str
    source_hash: str
    source_size: int
    status: str
    error_count: int
    warning_count: int
    created_at: datetime
    updated_at: datetime
    idempotent_replay: bool = False


class GraphChangeSetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    import_job_id: uuid.UUID
    status: str
    compiler_version: str
    teaching_preview: list[dict[str, object]]
    nodes: list[dict[str, object]]
    relationships: list[dict[str, object]]
    summary: dict[str, int]
    rejection_reason: str | None


class ReviewDecisionRequest(BaseModel):
    decision: Literal["approve", "reject"]
    reason: str | None = Field(default=None, max_length=1000)


class PublicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    change_set_id: uuid.UUID
    graph_version: str
    environment: str
    status: str
    is_active: bool
    storage_backend: str
    published_at: datetime
    rolled_back_at: datetime | None


class ParsedWorkbook(BaseModel):
    sheets: dict[str, list[dict[str, object]]]


class CompiledGraph(BaseModel):
    teaching_preview: list[dict[str, object]]
    nodes: list[dict[str, object]]
    relationships: list[dict[str, object]]
    summary: dict[str, int]


class GraphNodeResponse(BaseModel):
    id: str
    type: str
    label: str
    properties: dict[str, object]


class GraphEdgeResponse(BaseModel):
    id: str
    source: str
    target: str
    type: str
    properties: dict[str, object]


class GraphViewResponse(BaseModel):
    graph_version: str
    nodes: list[GraphNodeResponse]
    edges: list[GraphEdgeResponse]
    node_count: int
    edge_count: int


class StudentScaffoldResponse(BaseModel):
    attempt_id: uuid.UUID
    unit_id: str
    graph_version: str
    scenario: GraphNodeResponse | None
    phenomena: list[GraphNodeResponse]
    knowledge_resources: list[GraphNodeResponse]
    strategies: list[GraphNodeResponse]
    scaffolds: list[ScaffoldHintResponse]
    edges: list[GraphEdgeResponse]


class ScaffoldHintResponse(BaseModel):
    id: str
    phenomenon_id: str
    level: str
    trigger: str
    content: str | None
    revealed: bool
    used: bool


class ScaffoldEventRequest(BaseModel):
    node_id: str = Field(min_length=1, max_length=180)
    event_type: Literal["revealed", "used"]
    level: str = Field(min_length=1, max_length=40)
    client_event_id: str = Field(min_length=8, max_length=100)


class ScaffoldInteractionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    attempt_id: uuid.UUID
    graph_version: str
    scaffold_node_key: str
    phenomenon_node_key: str | None
    event_type: str
    level: str
    scaffold_snapshot: dict[str, object]
    created_at: datetime


class GraphLearningEvidenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    round_evaluation_id: uuid.UUID
    attempt_id: uuid.UUID
    student_message_id: uuid.UUID
    graph_version: str
    phenomenon_node_keys: list[str]
    strategy_node_keys: list[str]
    knowledge_resource_node_keys: list[str]
    score: float
    evidence_summary: str
    mapping_method: str
    created_at: datetime


class WeakUnitKnowledgeInsight(BaseModel):
    unit_id: str
    unit_title: str
    attempt_count: int
    average_score: float
    needs_attention: bool
    phenomenon_ids: list[str]
    knowledge_resource_ids: list[str]
    strategy_ids: list[str]
    scaffold_reveal_count: int
    scaffold_use_count: int
    students_using_scaffolds: int


class TeacherKnowledgeInsightsResponse(BaseModel):
    scope: Literal["classroom", "student"]
    scope_id: uuid.UUID
    graph_version: str
    completed_attempts: int
    average_score: float | None
    weak_units: list[WeakUnitKnowledgeInsight]


class LearningAssetResponse(BaseModel):
    id: uuid.UUID
    kind: Literal["video", "slides"]
    filename: str
    content_type: str
    size_bytes: int
    updated_at: datetime


class LearningContentResponse(BaseModel):
    graph_version: str
    node_id: str
    node_type: str
    title: str
    summary: str
    markdown_body: str
    assets: list[LearningAssetResponse]
    status: Literal["draft", "published"]
    updated_at: datetime | None = None


class LearningContentUpdateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    summary: str = Field(max_length=4000)
    markdown_body: str = Field(min_length=1, max_length=100_000)
    status: Literal["draft", "published"]
