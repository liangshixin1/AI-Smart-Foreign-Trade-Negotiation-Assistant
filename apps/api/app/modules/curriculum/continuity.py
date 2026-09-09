"""Project compatible historical evidence without rewriting its version bindings."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.curriculum.models import Chapter, CourseVersion, TrainingUnit
from app.modules.progress.models import ProgressRecord
from app.modules.training.models import Attempt


def compatible_unit_ids(db: Session, version_id: uuid.UUID) -> dict[uuid.UUID, uuid.UUID]:
    version = db.get(CourseVersion, version_id)
    if version is None:
        return {}
    units = list(
        db.scalars(
            select(TrainingUnit)
            .join(Chapter)
            .join(CourseVersion)
            .where(
                CourseVersion.course_id == version.course_id,
                CourseVersion.published_at <= version.published_at,
            )
        )
    )

    def signature(unit: TrainingUnit) -> tuple[object, ...]:
        return (
            unit.unit_key,
            unit.version,
            unit.training_mode,
            unit.template_id,
            unit.rubric_id,
            unit.scenario_prompt_id,
            unit.conversation_prompt_id,
            unit.round_evaluation_prompt_id,
            unit.evaluation_prompt_id,
            tuple(unit.prerequisite_unit_ids),
        )

    chapter_ids = set(db.scalars(select(Chapter.id).where(Chapter.course_version_id == version_id)))
    current = {signature(u): u.id for u in units if u.chapter_id in chapter_ids}
    return {u.id: current[signature(u)] for u in units if signature(u) in current}


def projected_statuses(
    db: Session, student_id: uuid.UUID, version_id: uuid.UUID
) -> tuple[dict[uuid.UUID, uuid.UUID], dict[uuid.UUID, tuple[str, uuid.UUID]]]:
    mapping = compatible_unit_ids(db, version_id)
    records = db.scalars(
        select(ProgressRecord)
        .where(ProgressRecord.student_id == student_id, ProgressRecord.unit_id.in_(mapping))
        .order_by(ProgressRecord.completed_at.asc())
    )
    completed = {mapping[r.unit_id]: r.completed_attempt_id for r in records}
    attempts = db.scalars(
        select(Attempt)
        .where(Attempt.student_id == student_id, Attempt.unit_id.in_(mapping))
        .order_by(Attempt.created_at.asc())
    )
    latest = {mapping[a.unit_id]: (a.status, a.id) for a in attempts}
    return completed, latest
