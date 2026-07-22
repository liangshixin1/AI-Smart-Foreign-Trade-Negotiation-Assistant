from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, Field, model_validator

DiagnosticDimensionKey = Literal[
    "domain_knowledge",
    "language_control",
    "negotiation_strategy",
    "adaptability",
    "intercultural_pragmatics",
    "self_regulation",
]
DIAGNOSTIC_DIMENSION_KEYS = {
    "domain_knowledge",
    "language_control",
    "negotiation_strategy",
    "adaptability",
    "intercultural_pragmatics",
    "self_regulation",
}
DIAGNOSTIC_DIMENSION_ORDER: tuple[DiagnosticDimensionKey, ...] = (
    "domain_knowledge",
    "language_control",
    "negotiation_strategy",
    "adaptability",
    "intercultural_pragmatics",
    "self_regulation",
)


class DiagnosticEvidenceCandidate(BaseModel):
    message_id: uuid.UUID
    quote: str = Field(min_length=1, max_length=600)
    interpretation: str = Field(min_length=1, max_length=300)


class DiagnosticDimensionCandidate(BaseModel):
    dimension_key: DiagnosticDimensionKey
    score: float = Field(ge=0, le=100)
    judgment: str = Field(min_length=1, max_length=500)
    evidence: list[DiagnosticEvidenceCandidate] = Field(default_factory=list, max_length=2)


class KnowledgeMasteryCandidate(BaseModel):
    knowledge_point: str = Field(min_length=1, max_length=160)
    status: Literal["not_observed", "emerging", "developing", "secure"]
    evidence: list[DiagnosticEvidenceCandidate] = Field(default_factory=list, max_length=2)


class LearningDiagnosticCandidate(BaseModel):
    framework_version: Literal["zpd-da-v1"] = "zpd-da-v1"
    learner_stage: Literal["foundation", "developing", "competent", "advanced"]
    challenge_level: int = Field(ge=1, le=4)
    support_level: Literal["explicit_model", "guided_choice", "implicit_prompt", "independent"]
    negotiation_style: Literal[
        "cautious", "analytical", "assertive", "collaborative", "adaptive", "unclear"
    ]
    adaptability_summary: str = Field(min_length=1, max_length=600)
    dimensions: list[DiagnosticDimensionCandidate] = Field(min_length=6, max_length=6)
    knowledge_mastery: list[KnowledgeMasteryCandidate] = Field(default_factory=list, max_length=12)
    next_stretch_target: str = Field(min_length=1, max_length=500)
    mediation_strategy: str = Field(min_length=1, max_length=500)
    confidence: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def dimensions_are_complete(self) -> LearningDiagnosticCandidate:
        keys = [item.dimension_key for item in self.dimensions]
        if len(keys) != len(set(keys)) or set(keys) != DIAGNOSTIC_DIMENSION_KEYS:
            raise ValueError("learning diagnostic dimensions must exactly match the fixed set")
        return self


class EvidenceCandidate(BaseModel):
    message_id: uuid.UUID
    quote: str = Field(min_length=1)
    reason: str = Field(min_length=1)


class DimensionCandidate(BaseModel):
    dimension_key: str
    score: float = Field(ge=0, le=100)
    comment: str = Field(min_length=1)
    evidence: list[EvidenceCandidate] = Field(min_length=1)


class EvaluationCandidate(BaseModel):
    level: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    strengths: list[str]
    improvements: list[str]
    next_actions: list[str] = Field(min_length=1)
    dimensions: list[DimensionCandidate] = Field(min_length=1)
    knowledge_tags: list[str]
    learning_diagnostic: LearningDiagnosticCandidate | None = None


class RubricDimensionSpec(BaseModel):
    key: str
    label: str
    weight: float = Field(gt=0, le=1)


class ChecklistAssessmentCandidate(BaseModel):
    item: str = Field(min_length=1, max_length=500)
    satisfied: bool
    rationale: str = Field(min_length=1, max_length=240)


class GraphRecommendationCandidate(BaseModel):
    node_id: str = Field(min_length=1, max_length=180)
    confidence: float = Field(ge=0, le=1)
    reason: str = Field(min_length=1, max_length=300)
    reveal_level: int = Field(default=1, ge=1, le=3)


class RoundEvaluationCandidate(BaseModel):
    score: float = Field(ge=0, le=100)
    pros: str = Field(min_length=1, max_length=240)
    cons: str = Field(min_length=1, max_length=240)
    detailed_evaluation: str = Field(min_length=1, max_length=4000)
    next_step_suggestion: str = Field(min_length=1, max_length=2000)
    checklist_results: list[ChecklistAssessmentCandidate] = Field(default_factory=list)
    knowledge_recommendations: list[GraphRecommendationCandidate] = Field(
        default_factory=list, max_length=3
    )
    strategy_recommendations: list[GraphRecommendationCandidate] = Field(
        default_factory=list, max_length=3
    )
    learning_diagnostic: LearningDiagnosticCandidate
