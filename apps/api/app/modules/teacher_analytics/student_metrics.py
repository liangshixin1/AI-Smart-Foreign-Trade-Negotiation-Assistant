from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.assessment.models import Evaluation
from app.modules.auth.models import User
from app.modules.curriculum.models import TrainingUnit
from app.modules.progress.models import ProgressRecord
from app.modules.teacher_analytics.schemas import StudentItem
from app.modules.training.models import Attempt


def student_item(
    db: Session, user: User, course_version_id: uuid.UUID | None = None
) -> StudentItem:
    progress_filters = [ProgressRecord.student_id == user.id]
    if course_version_id is not None:
        progress_filters.append(ProgressRecord.course_version_id == course_version_id)
    completed = db.scalar(select(func.count(ProgressRecord.id)).where(*progress_filters)) or 0
    total_units = (
        db.scalar(
            select(func.count(TrainingUnit.id)).where(
                TrainingUnit.chapter.has(course_version_id=course_version_id)
            )
        )
        if course_version_id is not None
        else 0
    ) or 0
    latest = db.scalar(
        select(ProgressRecord).where(*progress_filters).order_by(ProgressRecord.updated_at.desc())
    )
    last_active = db.scalar(
        select(func.max(Attempt.updated_at)).where(Attempt.student_id == user.id)
    )
    normalized_last_active = (
        last_active.replace(tzinfo=UTC)
        if last_active is not None and last_active.tzinfo is None
        else last_active
    )
    risks: list[str] = []
    if normalized_last_active is None or normalized_last_active < datetime.now(UTC) - timedelta(
        days=7
    ):
        risks.append("7天未训练")
    recent_scores = list(
        db.scalars(
            select(Evaluation.overall_score)
            .join(Attempt, Attempt.id == Evaluation.attempt_id)
            .where(Attempt.student_id == user.id)
            .order_by(Evaluation.created_at.desc())
            .limit(2)
        )
    )
    if len(recent_scores) == 2 and all(score < 60 for score in recent_scores):
        risks.append("连续两次评价低于60分")
    repeated_low = db.scalar(
        select(Attempt.unit_id)
        .outerjoin(Evaluation, Evaluation.attempt_id == Attempt.id)
        .where(Attempt.student_id == user.id)
        .group_by(Attempt.unit_id)
        .having(func.count(Attempt.id) >= 3, func.max(Evaluation.overall_score) < 60)
        .limit(1)
    )
    if repeated_low is not None:
        risks.append("同一小节训练至少3次仍未达标")
    failed_evaluations = db.scalar(
        select(func.count(Attempt.id)).where(
            Attempt.student_id == user.id, Attempt.status == "evaluation_failed"
        )
    )
    if failed_evaluations:
        risks.append(f"{failed_evaluations}次正式评价失败待重试")
    latest_attempt = db.scalar(
        select(Attempt).where(Attempt.student_id == user.id).order_by(Attempt.updated_at.desc())
    )
    current_unit = db.get(TrainingUnit, latest_attempt.unit_id) if latest_attempt else None
    return StudentItem(
        id=user.id,
        student_no=user.student_no or "-",
        display_name=user.display_name,
        email=user.email,
        status=user.status,
        completed_units=completed,
        total_units=total_units,
        completion_rate=round(completed / total_units * 100, 1) if total_units else 0,
        current_unit_title=current_unit.title if current_unit else None,
        latest_score=latest.latest_score if latest else None,
        last_active_at=last_active,
        risk_reasons=risks,
    )
