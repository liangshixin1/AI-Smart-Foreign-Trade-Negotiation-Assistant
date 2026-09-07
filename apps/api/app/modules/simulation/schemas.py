from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Expression = Literal["neutral", "thinking", "pleased", "frustrated", "confused"]
Action = Literal["none", "nod", "head_tilt"]
TermStatus = Literal["unaddressed", "proposed", "discussing", "confirmed", "reopened"]
CommercialOutcome = Literal["negotiating", "provisional_agreement", "paused", "no_agreement"]


class SimulationBeat(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=80)
    kind: Literal["speech"] = "speech"
    speaker_id: Literal["david-lim"] = "david-lim"
    text: str = Field(min_length=1, max_length=1200)
    expression: Expression = "neutral"
    action: Action = "none"


class SimulationTurnCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["simulation.turn.v1"]
    beats: list[SimulationBeat] = Field(min_length=1, max_length=3)


class BriefingBeat(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=80)
    kind: Literal["narration"] = "narration"
    speaker_id: Literal["narrator"] = "narrator"
    rendered_text: str = Field(min_length=15, max_length=140)
    fact_refs: list[str] = Field(default_factory=list, max_length=8)
    scene_id: Literal["meeting-room-day"] = "meeting-room-day"
    character_id: Literal["david-lim"] = "david-lim"
    expression: Expression = "neutral"
    action: Action = "none"


class SimulationOpening(BaseModel):
    model_config = ConfigDict(extra="forbid")

    beats: list[SimulationBeat] = Field(min_length=1, max_length=3)


class SimulationBriefingCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["simulation.briefing.v1"]
    briefing: list[BriefingBeat] = Field(min_length=4, max_length=7)
    opening: SimulationOpening


class ObservationEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message_id: uuid.UUID
    quote: str = Field(min_length=1, max_length=600)


class StateEventCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal[
        "clarifies_terms",
        "evidence_backed_proposal",
        "reciprocal_offer",
        "repairs_misunderstanding",
        "unacknowledged_contradiction",
        "explicit_personal_attack",
        "empty_flattery",
        "reasoned_refusal",
    ]
    target_key: str = Field(min_length=1, max_length=80)
    confidence: float = Field(ge=0, le=1)
    evidence: list[ObservationEvidence] = Field(min_length=1, max_length=2)
    reason: str = Field(min_length=1, max_length=300)
    normalized_fact_signature: str = Field(min_length=1, max_length=160)


class TermCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str = Field(min_length=1, max_length=80)
    status: TermStatus
    normalized_value: str = Field(min_length=1, max_length=160)
    conditions: list[str] = Field(default_factory=list, max_length=8)
    proposed_by: Literal["student", "assistant"]
    supporting_message_ids: list[uuid.UUID] = Field(min_length=1, max_length=4)
    accepted_by: list[Literal["student", "assistant"]] = Field(default_factory=list, max_length=2)
    acceptance_evidence: list[ObservationEvidence] = Field(default_factory=list, max_length=4)


class MilestoneCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str = Field(min_length=1, max_length=80)
    message_ids: list[uuid.UUID] = Field(min_length=1, max_length=3)
    reason: str = Field(min_length=1, max_length=240)


class SimulationObservationCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["simulation.observation.v1"] = "simulation.observation.v1"
    events: list[StateEventCandidate] = Field(default_factory=list, max_length=8)
    term_candidates: list[TermCandidate] = Field(default_factory=list, max_length=8)
    milestone_candidates: list[MilestoneCandidate] = Field(default_factory=list, max_length=6)


class SimulationProfile(BaseModel):
    id: str
    version: str
    unit_key: str
    enabled: bool
    experience_mode: Literal["simulation"]
    training_mode: Literal["negotiation"]
    briefing_locale: str
    dialogue_locale: str
    character_id: Literal["david-lim"]
    display_name: str
    asset_pack: str
    asset_pack_version: str
    scene_id: Literal["meeting-room-day"]
    rules_version: str
    briefing_prompt_id: str
    briefing_prompt_version: str
    conversation_prompt_id: str
    conversation_prompt_version: str
    round_prompt_id: str
    round_prompt_version: str
    final_prompt_id: str
    final_prompt_version: str
    rubric_profile_id: str
    rubric_profile_version: str
    required_term_keys: list[str] = Field(min_length=2, max_length=4)
    required_milestone_keys: list[str] = Field(min_length=1, max_length=6)
    term_dependencies: dict[str, list[str]] = Field(default_factory=dict)


class SimulationPresentationResponse(BaseModel):
    schema_version: Literal["simulation.presentation.v1"] = "simulation.presentation.v1"
    presentation_id: uuid.UUID
    message_id: uuid.UUID
    student_message_id: uuid.UUID | None
    conversation_revision: int
    input_state_revision: int
    canonical_content: str
    canonical_text_hash: str
    character_id: str
    asset_pack_version: str
    beats: list[SimulationBeat]
    created_at: datetime


class MetricResponse(BaseModel):
    value: int
    band: Literal["cautious", "steady", "positive"]
    delta: int


class AlignmentMetricResponse(BaseModel):
    value: int
    confirmed: int
    required: int


class PublicChangeResponse(BaseModel):
    label: str
    reason: str
    event_id: uuid.UUID
    evidence: list[ObservationEvidence] = Field(default_factory=list, max_length=2)


class MilestoneResponse(BaseModel):
    key: str
    status: Literal["pending", "evidenced"]
    message_ids: list[uuid.UUID]


class SimulationStateResponse(BaseModel):
    schema_version: Literal["simulation.state.v1"] = "simulation.state.v1"
    revision: int
    source_round_id: uuid.UUID | None
    analysis_status: Literal["ready", "pending", "failed"]
    trust: MetricResponse
    willingness: MetricResponse
    alignment: AlignmentMetricResponse
    term_ledger: list[dict[str, object]]
    milestones: list[MilestoneResponse]
    public_changes: list[PublicChangeResponse]
    commercial_outcome: CommercialOutcome
    rules_version: str


class SimulationResponse(BaseModel):
    schema_version: Literal["simulation.session.v1"] = "simulation.session.v1"
    attempt_id: uuid.UUID
    profile_id: str
    profile_version: str
    character_id: str
    display_name: str
    scene_id: str
    asset_pack: str
    asset_pack_version: str
    briefing_status: str
    briefing: list[BriefingBeat]
    briefing_hash: str
    turns: list[SimulationPresentationResponse]
    state_history: list[SimulationStateResponse] = Field(default_factory=list)
    latest_state: SimulationStateResponse


class SimulationSummaryResponse(BaseModel):
    profile_id: str
    profile_version: str
    asset_pack_version: str
    analysis_status: str
    state_revision: int


class StateRuleResult(BaseModel):
    state: SimulationStateResponse
    accepted_events: list[StateEventCandidate]
    rejected_events: list[tuple[StateEventCandidate, str]]

    @model_validator(mode="after")
    def accepted_and_rejected_do_not_overlap(self) -> StateRuleResult:
        accepted = {id(item) for item in self.accepted_events}
        if any(id(item) in accepted for item, _ in self.rejected_events):
            raise ValueError("event decision overlap")
        return self
