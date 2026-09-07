from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.modules.assessment.models import RoundEvaluation
from app.modules.simulation.models import (
    SimulationStateEvent,
    SimulationStateSnapshot,
)
from app.modules.simulation.profile_service import load_profile_version
from app.modules.simulation.repository import SimulationRepository
from app.modules.simulation.schemas import (
    PublicChangeResponse,
    SimulationObservationCandidate,
    SimulationStateResponse,
)
from app.modules.simulation.state_rules import apply_observation
from app.modules.training.hashing import stable_hash
from app.modules.training.models import Attempt

EVENT_LABELS = {
    "clarifies_terms": "澄清了具体条款",
    "evidence_backed_proposal": "提出了有依据的方案",
    "reciprocal_offer": "提出了互惠交换",
    "repairs_misunderstanding": "主动修复了误解",
    "unacknowledged_contradiction": "出现未说明的前后矛盾",
    "explicit_personal_attack": "出现针对个人的攻击",
    "empty_flattery": "礼貌表达不改变态势",
    "reasoned_refusal": "有依据的拒绝保持专业边界",
}


class SimulationStateService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = SimulationRepository(db)

    def mark_pending(self, attempt_id: uuid.UUID) -> None:
        session = self.repository.session(attempt_id)
        if session is not None:
            session.analysis_status = "pending"
            self.db.commit()

    def mark_failed(self, attempt_id: uuid.UUID) -> None:
        session = self.repository.session(attempt_id)
        if session is not None:
            session.analysis_status = "failed"
            self.db.commit()

    def process(self, attempt: Attempt, evaluation: RoundEvaluation) -> SimulationStateResponse:
        session = self.repository.session(attempt.id)
        snapshot = self.repository.latest_snapshot(attempt.id)
        if session is None or snapshot is None:
            raise ValueError("Simulation state requires an initialized session")
        if attempt.status != "in_progress":
            return self.current(attempt.id)
        if snapshot.source_round_id == evaluation.id:
            return self.current(attempt.id)
        profile = load_profile_version(session.profile_id, session.profile_version)
        if (session.profile_id, session.profile_version) != (profile.id, profile.version):
            raise ValueError("Simulation session references an unavailable immutable profile")
        previous = SimulationStateResponse.model_validate(snapshot.payload)
        observation = SimulationObservationCandidate.model_validate(
            evaluation.simulation_observation
            or {
                "schema_version": "simulation.observation.v1",
                "events": [],
                "term_candidates": [],
                "milestone_candidates": [],
            }
        )
        messages = {
            item.id: (item.role, item.content)
            for item in attempt.messages
            if item.status == "completed" and item.role in {"student", "assistant"}
        }
        computation = apply_observation(
            previous,
            observation,
            profile,
            messages,
            self.repository.event_keys(attempt.id),
            evaluation.id,
        )
        changes: list[PublicChangeResponse] = []
        applied_ids: list[str] = []
        for applied in computation.accepted:
            event = SimulationStateEvent(
                attempt_id=attempt.id,
                round_evaluation_id=evaluation.id,
                student_message_id=evaluation.student_message_id,
                assistant_message_id=evaluation.assistant_message_id,
                event_kind=applied.candidate.kind,
                target_key=applied.candidate.target_key,
                term_version=_term_version(computation.state, applied.candidate.target_key),
                evidence=[item.model_dump(mode="json") for item in applied.candidate.evidence],
                confidence=applied.candidate.confidence,
                dedupe_key=applied.dedupe_key,
                decision="accepted",
                validation_reason="validated",
                rules_version=profile.rules_version,
                source_conversation_revision=attempt.conversation_revision,
            )
            self.db.add(event)
            self.db.flush()
            applied_ids.append(str(event.id))
            delta_parts = []
            if applied.trust_delta:
                delta_parts.append(f"沟通信任 {applied.trust_delta:+d}")
            if applied.willingness_delta:
                delta_parts.append(f"合作意愿 {applied.willingness_delta:+d}")
            changes.append(
                PublicChangeResponse(
                    label=" · ".join(delta_parts) or "态势保持",
                    reason=applied.candidate.reason,
                    event_id=event.id,
                    evidence=applied.candidate.evidence,
                )
            )
        for candidate, reason in computation.rejected:
            if reason == "duplicate_event":
                continue
            self.db.add(
                SimulationStateEvent(
                    attempt_id=attempt.id,
                    round_evaluation_id=evaluation.id,
                    student_message_id=evaluation.student_message_id,
                    assistant_message_id=evaluation.assistant_message_id,
                    event_kind=candidate.kind,
                    target_key=candidate.target_key,
                    term_version=_term_version(computation.state, candidate.target_key),
                    evidence=[item.model_dump(mode="json") for item in candidate.evidence],
                    confidence=candidate.confidence,
                    dedupe_key=stable_hash(
                        {
                            "round": str(evaluation.id),
                            "candidate": candidate.model_dump(mode="json"),
                        }
                    ),
                    decision="rejected",
                    validation_reason=reason,
                    rules_version=profile.rules_version,
                    source_conversation_revision=attempt.conversation_revision,
                )
            )
        state = computation.state.model_copy(update={"public_changes": changes})
        stored = SimulationStateSnapshot(
            attempt_id=attempt.id,
            state_revision=state.revision,
            source_round_id=evaluation.id,
            parent_revision=previous.revision,
            payload=state.model_dump(mode="json"),
            applied_event_ids=applied_ids,
            rules_version=profile.rules_version,
        )
        self.db.add(stored)
        session.latest_state_revision = state.revision
        session.latest_state_payload = state.model_dump(mode="json")
        session.analysis_status = "ready"
        self.db.commit()
        return state

    def current(self, attempt_id: uuid.UUID) -> SimulationStateResponse:
        session = self.repository.session(attempt_id)
        if session is None:
            raise ValueError("Simulation session not found")
        state = SimulationStateResponse.model_validate(session.latest_state_payload)
        if session.analysis_status in {"pending", "failed"}:
            state = state.model_copy(update={"analysis_status": session.analysis_status})
        return state

    @staticmethod
    def from_snapshot(snapshot: SimulationStateSnapshot) -> SimulationStateResponse:
        return SimulationStateResponse.model_validate(snapshot.payload)


def _term_version(state: SimulationStateResponse, key: str) -> int:
    for item in state.term_ledger:
        if item.get("key") == key:
            value = item.get("version")
            return value if isinstance(value, int) and not isinstance(value, bool) else 0
    return 0
