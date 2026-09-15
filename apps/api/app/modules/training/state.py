# [导读] 所属业务: 一次训练从创建到提交的生命周期。
# [导读] 业务名词: Attempt 是一次训练记录; Scenario 是该次训练的场景; Submission 是正式提交时冻
# [导读] 结的内容快照。
# [导读] 用途与原因: 检查允许的训练状态迁移并生成事件记录; 集中限制状态跳转, 避免各入口随意把失
# [导读] 败记录标为完成。
# [导读] 结构: transition。
# [导读] 提醒: 重练创建新 Attempt, 重试评价沿用原提交; 场景 private 部分是对手底牌, 不得放入学生
# [导读] 响应。
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
