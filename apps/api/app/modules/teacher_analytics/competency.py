from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.assessment.models import CompetencyEvidence, Evaluation, EvaluationDimension
from app.modules.teacher_analytics.schemas import (
    CompetencySummary,
    DimensionTrendPoint,
)
from app.modules.training.models import Attempt


def competency_summaries(
    db: Session,
    *,
    student_ids: list[uuid.UUID],
    course_version_id: uuid.UUID,
    include_trend: bool,
) -> list[CompetencySummary]:
    if not student_ids:
        return []
    rows = db.execute(
        select(
            EvaluationDimension,
            Evaluation.attempt_id,
            Evaluation.created_at,
            func.count(CompetencyEvidence.id),
        )
        .join(Evaluation, Evaluation.id == EvaluationDimension.evaluation_id)
        .join(Attempt, Attempt.id == Evaluation.attempt_id)
        .outerjoin(
            CompetencyEvidence,
            CompetencyEvidence.dimension_id == EvaluationDimension.id,
        )
        .where(
            Attempt.student_id.in_(student_ids),
            Attempt.course_version_id == course_version_id,
        )
        .group_by(EvaluationDimension.id, Evaluation.id)
        .order_by(Evaluation.created_at.asc())
    ).all()
    grouped: dict[str, list[tuple[EvaluationDimension, uuid.UUID, datetime, int]]] = defaultdict(
        list
    )
    for dimension, attempt_id, created_at, evidence_count in rows:
        grouped[dimension.dimension_key].append(
            (dimension, attempt_id, created_at, int(evidence_count))
        )
    result: list[CompetencySummary] = []
    for key, entries in grouped.items():
        latest = entries[-1]
        average = round(sum(item[0].score for item in entries) / len(entries), 1)
        result.append(
            CompetencySummary(
                dimension_key=key,
                label=latest[0].label,
                average_score=average,
                latest_score=latest[0].score,
                evidence_count=sum(item[3] for item in entries),
                attempt_count=len(entries),
                needs_attention=average < 70 or latest[0].score < 60,
                trend=(
                    [
                        DimensionTrendPoint(
                            attempt_id=item[1], score=item[0].score, created_at=item[2]
                        )
                        for item in entries
                    ]
                    if include_trend
                    else []
                ),
            )
        )
    return sorted(result, key=lambda item: (not item.needs_attention, item.average_score))
