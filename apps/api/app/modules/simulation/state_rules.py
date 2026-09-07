from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from typing import Literal

from app.modules.simulation.schemas import (
    AlignmentMetricResponse,
    MetricResponse,
    MilestoneResponse,
    SimulationObservationCandidate,
    SimulationProfile,
    SimulationStateResponse,
    StateEventCandidate,
)
from app.modules.training.hashing import stable_hash

EVENT_DELTAS: dict[str, tuple[int, int]] = {
    "clarifies_terms": (3, 0),
    "evidence_backed_proposal": (2, 2),
    "reciprocal_offer": (0, 4),
    "repairs_misunderstanding": (4, 2),
    "unacknowledged_contradiction": (-4, -2),
    "explicit_personal_attack": (-4, -4),
    "empty_flattery": (0, 0),
    "reasoned_refusal": (0, 0),
}
CONDITIONAL_ACCEPTANCE = re.compile(
    r"\b(might|may|could|would)\s+accept\b|\baccept\b.*\bif\b", re.I
)
EXPLICIT_ACCEPTANCE = re.compile(
    r"\b(accept|accepted|agree|agreed|confirm|confirmed)\b|同意|接受|确认", re.I
)
PublicMessages = dict[uuid.UUID, tuple[str, str]]


@dataclass(frozen=True)
class AcceptedRuleEvent:
    candidate: StateEventCandidate
    dedupe_key: str
    trust_delta: int
    willingness_delta: int


@dataclass(frozen=True)
class RuleComputation:
    state: SimulationStateResponse
    accepted: list[AcceptedRuleEvent]
    rejected: list[tuple[StateEventCandidate, str]]


def metric(value: int, delta: int = 0) -> MetricResponse:
    band: Literal["cautious", "steady", "positive"] = (
        "cautious" if value <= 34 else "steady" if value <= 69 else "positive"
    )
    return MetricResponse(value=value, band=band, delta=delta)


def initial_state(profile: SimulationProfile) -> SimulationStateResponse:
    return SimulationStateResponse(
        revision=0,
        source_round_id=None,
        analysis_status="ready",
        trust=metric(50),
        willingness=metric(50),
        alignment=AlignmentMetricResponse(
            value=0, confirmed=0, required=len(profile.required_term_keys)
        ),
        term_ledger=[
            {"key": key, "version": 0, "status": "unaddressed"}
            for key in profile.required_term_keys
        ],
        milestones=[
            MilestoneResponse(key=key, status="pending", message_ids=[])
            for key in profile.required_milestone_keys
        ],
        public_changes=[],
        commercial_outcome="negotiating",
        rules_version=profile.rules_version,
    )


def apply_observation(
    previous: SimulationStateResponse,
    observation: SimulationObservationCandidate,
    profile: SimulationProfile,
    messages: PublicMessages,
    existing_keys: set[str],
    source_round_id: uuid.UUID,
) -> RuleComputation:
    ledger = _updated_ledger(previous.term_ledger, observation, profile, messages)
    milestones = _updated_milestones(previous.milestones, observation, profile, messages)
    term_versions = {str(item.get("key")): _as_int(item.get("version")) for item in ledger}
    accepted: list[AcceptedRuleEvent] = []
    rejected: list[tuple[StateEventCandidate, str]] = []
    for candidate in observation.events:
        reason = _event_rejection(candidate, profile, messages)
        version = term_versions.get(candidate.target_key, 0)
        dedupe = stable_hash(
            {
                "kind": candidate.kind,
                "target": candidate.target_key,
                "term_version": version,
                "signature": candidate.normalized_fact_signature.strip().casefold(),
            }
        )
        if reason is None and dedupe in existing_keys:
            reason = "duplicate_event"
        if reason is not None:
            rejected.append((candidate, reason))
            continue
        trust, willingness = EVENT_DELTAS[candidate.kind]
        accepted.append(AcceptedRuleEvent(candidate, dedupe, trust, willingness))
        existing_keys.add(dedupe)
    trust_delta = max(-8, min(8, sum(item.trust_delta for item in accepted)))
    willingness_delta = max(-8, min(8, sum(item.willingness_delta for item in accepted)))
    trust_value = max(0, min(100, previous.trust.value + trust_delta))
    willingness_value = max(0, min(100, previous.willingness.value + willingness_delta))
    confirmed = sum(item.get("status") == "confirmed" for item in ledger)
    required = len(profile.required_term_keys)
    alignment = round(confirmed / required * 100) if required else 0
    state = SimulationStateResponse(
        revision=previous.revision + 1,
        source_round_id=source_round_id,
        analysis_status="ready",
        trust=metric(trust_value, trust_delta),
        willingness=metric(willingness_value, willingness_delta),
        alignment=AlignmentMetricResponse(value=alignment, confirmed=confirmed, required=required),
        term_ledger=ledger,
        milestones=milestones,
        public_changes=[],
        commercial_outcome="provisional_agreement" if confirmed == required else "negotiating",
        rules_version=profile.rules_version,
    )
    return RuleComputation(state=state, accepted=accepted, rejected=rejected)


def _event_rejection(
    candidate: StateEventCandidate,
    profile: SimulationProfile,
    messages: PublicMessages,
) -> str | None:
    if candidate.confidence < 0.8:
        return "confidence_below_threshold"
    if candidate.target_key not in {*profile.required_term_keys, "general"}:
        return "target_not_allowed"
    required_quotes = (
        2
        if candidate.kind
        in {
            "repairs_misunderstanding",
            "unacknowledged_contradiction",
        }
        else 1
    )
    if len(candidate.evidence) < required_quotes:
        return "insufficient_evidence"
    for evidence in candidate.evidence:
        message = messages.get(evidence.message_id)
        if message is None or evidence.quote not in message[1]:
            return "evidence_not_found"
    return None


def _updated_ledger(
    previous: list[dict[str, object]],
    observation: SimulationObservationCandidate,
    profile: SimulationProfile,
    messages: PublicMessages,
) -> list[dict[str, object]]:
    ledger = {str(item.get("key")): dict(item) for item in previous}
    for candidate in observation.term_candidates:
        if candidate.key not in profile.required_term_keys:
            continue
        ids = [*candidate.supporting_message_ids]
        ids.extend(item.message_id for item in candidate.acceptance_evidence)
        if any(message_id not in messages for message_id in ids):
            continue
        old = ledger.get(candidate.key, {"key": candidate.key, "version": 0})
        changed = (
            old.get("normalized_value") != candidate.normalized_value
            or old.get("conditions", []) != candidate.conditions
        )
        version = _as_int(old.get("version")) + (1 if changed else 0)
        if version == 0:
            version = 1
        status = candidate.status
        quotes = [item.quote for item in candidate.acceptance_evidence]
        evidence_roles = {
            messages[item.message_id][0]
            for item in candidate.acceptance_evidence
            if item.message_id in messages
        }
        both_accepted = (
            set(candidate.accepted_by) == {"student", "assistant"}
            and evidence_roles == {"student", "assistant"}
            and len(candidate.acceptance_evidence) >= 2
            and all(EXPLICIT_ACCEPTANCE.search(quote) for quote in quotes)
            and all(candidate.normalized_value.casefold() in quote.casefold() for quote in quotes)
            and all(
                condition.casefold() in quote.casefold()
                for condition in candidate.conditions
                for quote in quotes
            )
        )
        conditional = any(CONDITIONAL_ACCEPTANCE.search(quote) for quote in quotes)
        if status == "confirmed" and (not both_accepted or conditional):
            status = "discussing"
        elif changed and old.get("status") == "confirmed":
            status = "reopened"
        ledger[candidate.key] = {
            "key": candidate.key,
            "version": version,
            "status": status,
            "normalized_value": candidate.normalized_value,
            "conditions": candidate.conditions,
            "proposed_by": candidate.proposed_by,
            "supporting_message_ids": [str(item) for item in candidate.supporting_message_ids],
            "accepted_by": candidate.accepted_by,
            "acceptance_evidence": [
                item.model_dump(mode="json") for item in candidate.acceptance_evidence
            ],
        }
        if changed:
            for dependent in profile.term_dependencies.get(candidate.key, []):
                dependent_item = ledger.get(dependent)
                if dependent_item and dependent_item.get("status") == "confirmed":
                    dependent_item["status"] = "reopened"
    return [ledger[key] for key in profile.required_term_keys]


def _updated_milestones(
    previous: list[MilestoneResponse],
    observation: SimulationObservationCandidate,
    profile: SimulationProfile,
    messages: PublicMessages,
) -> list[MilestoneResponse]:
    result = {item.key: item.model_copy(deep=True) for item in previous}
    for candidate in observation.milestone_candidates:
        if candidate.key not in profile.required_milestone_keys:
            continue
        if any(
            message_id not in messages or messages[message_id][0] != "student"
            for message_id in candidate.message_ids
        ):
            continue
        result[candidate.key] = MilestoneResponse(
            key=candidate.key,
            status="evidenced",
            message_ids=candidate.message_ids,
        )
    return [result[key] for key in profile.required_milestone_keys]


def _as_int(value: object) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) else 0
