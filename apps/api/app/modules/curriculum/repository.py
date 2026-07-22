from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.classrooms.models import Classroom, Enrollment
from app.modules.curriculum.models import Chapter, CourseVersion, TrainingUnit
from app.modules.progress.models import ProgressRecord
from app.modules.training.models import Attempt


class CurriculumRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def current_course(self, student_id: uuid.UUID) -> CourseVersion | None:
        statement = (
            select(CourseVersion)
            .join(Classroom, Classroom.course_version_id == CourseVersion.id)
            .join(Enrollment, Enrollment.classroom_id == Classroom.id)
            .where(
                Enrollment.student_id == student_id,
                Enrollment.status == "active",
                Classroom.status == "active",
                CourseVersion.status == "published",
            )
            .options(
                selectinload(CourseVersion.course),
                selectinload(CourseVersion.chapters)
                .selectinload(Chapter.units)
                .selectinload(TrainingUnit.rubric),
            )
        )
        return self.db.scalar(statement)

    def unit_for_student(self, student_id: uuid.UUID, unit_key: str) -> TrainingUnit | None:
        statement = (
            select(TrainingUnit)
            .join(Chapter, TrainingUnit.chapter_id == Chapter.id)
            .join(CourseVersion, Chapter.course_version_id == CourseVersion.id)
            .join(Classroom, Classroom.course_version_id == CourseVersion.id)
            .join(Enrollment, Enrollment.classroom_id == Classroom.id)
            .where(
                Enrollment.student_id == student_id,
                Enrollment.status == "active",
                Classroom.status == "active",
                TrainingUnit.unit_key == unit_key,
                TrainingUnit.status == "published",
            )
            .options(selectinload(TrainingUnit.rubric))
        )
        return self.db.scalar(statement)

    def unit_statuses(
        self, student_id: uuid.UUID, course_version_id: uuid.UUID
    ) -> tuple[dict[uuid.UUID, uuid.UUID], dict[uuid.UUID, tuple[str, uuid.UUID]]]:
        completed_rows = self.db.execute(
            select(ProgressRecord.unit_id, ProgressRecord.completed_attempt_id).where(
                ProgressRecord.student_id == student_id,
                ProgressRecord.course_version_id == course_version_id,
            )
        )
        completed: dict[uuid.UUID, uuid.UUID] = {
            row.unit_id: row.completed_attempt_id for row in completed_rows
        }
        attempts = self.db.scalars(
            select(Attempt)
            .where(
                Attempt.student_id == student_id,
                Attempt.course_version_id == course_version_id,
            )
            .order_by(Attempt.created_at.asc())
        )
        latest = {attempt.unit_id: (attempt.status, attempt.id) for attempt in attempts}
        return completed, latest
