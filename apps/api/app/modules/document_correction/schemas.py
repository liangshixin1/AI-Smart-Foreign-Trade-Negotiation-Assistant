from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


ValueType = Literal[
    "text",
    "multiline_text",
    "party",
    "currency_amount",
    "date",
    "integer_days",
    "enum",
    "goods_description",
    "clause_list",
    "field_relation",
]


class Clause(StrictModel):
    item_id: str
    text: str
    value_type: ValueType
    value: Any
    inputs: list[str]


class DocumentField(StrictModel):
    field_id: str
    tag: str
    label: str
    value_type: ValueType
    value: Any
    display_value: str
    items: list[Clause]
    inputs: list[str]


class DocumentSection(StrictModel):
    section_id: str
    title: str
    fields: list[DocumentField]


class Document(StrictModel):
    schema_version: Literal["lc.document.v1"]
    document_type: Literal["mt700_review_copy"]
    document_number: str
    title: str
    watermark: str
    sections: list[DocumentSection]


class AnnotationInput(StrictModel):
    expected_revision: int = Field(ge=0)
    client_operation_id: str = Field(min_length=8, max_length=120)
    issue_category: Literal["", "contract_mismatch", "unperformable", "ambiguous", "other"] = ""
    proposed_value: Any = None
    evidence_ref: str = Field(default="", max_length=120)
    optional_note: str = Field(default="", max_length=2000)


class RevisionInput(StrictModel):
    expected_revision: int = Field(ge=0)
    client_operation_id: str = Field(min_length=8, max_length=120)


class SubmitInput(StrictModel):
    expected_revision: int = Field(ge=0)


class Feedback(StrictModel):
    summary: str = Field(min_length=1, max_length=800)
    strengths: list[str] = Field(max_length=5)
    improvements: list[str] = Field(max_length=5)
    next_actions: list[str] = Field(max_length=5)
    knowledge_recommendations: list[str] = Field(max_length=8)
