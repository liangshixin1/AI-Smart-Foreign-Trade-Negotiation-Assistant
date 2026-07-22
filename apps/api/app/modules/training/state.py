from __future__ import annotations

from app.core.errors import AppError
from app.modules.training.models import Attempt, AttemptEvent

TRANSITIONS: dict[str, frozenset[str]] = {
    "not_started": frozenset({"generating_scenario"}),
    "generating_scenario": frozenset({"in_progress", "generation_failed"}),
    "in_progress": frozenset({"submitted"}),
    "submitted": frozenset({"evaluating"}),
    "evaluating": frozenset({"completed", "evaluation_failed"}),
    "evaluation_failed": frozenset({"evaluating"}),
    "completed": frozenset({"retry_created"}),
}


def transition(attempt: Attempt, to_status: str, reason: str) -> AttemptEvent:
    allowed = TRANSITIONS.get(attempt.status, frozenset())
    if to_status not in allowed:
        raise AppError(
            code="training.invalid_state_transition",
            message=f"训练状态不能从 {attempt.status} 变为 {to_status}。",
            status_code=409,
        )
    previous = attempt.status
    attempt.status = to_status
    return AttemptEvent(
        attempt_id=attempt.id,
        from_status=previous,
        to_status=to_status,
        reason=reason,
    )
