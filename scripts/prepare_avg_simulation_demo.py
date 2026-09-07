"""Prepare the isolated demo student prerequisite for AVG browser QA only."""

from __future__ import annotations

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import build_engine, build_session_factory
from app.modules.auth.models import User
from app.modules.curriculum.models import TrainingUnit
from app.modules.progress.models import ProgressRecord
from app.modules.training.models import Attempt


def main() -> None:
    settings = get_settings()
    if settings.app_env == "production":
        raise RuntimeError(
            "The AVG demo prerequisite may not be created in production."
        )
    factory = build_session_factory(build_engine(settings))
    with factory() as db:
        student = db.scalar(select(User).where(User.email == "student@example.test"))
        prerequisite = db.scalar(
            select(TrainingUnit).where(TrainingUnit.unit_key == "chapter-2-section-2")
        )
        if student is None or prerequisite is None:
            raise RuntimeError(
                "Seed users and curriculum before preparing the AVG demo."
            )
        existing = db.scalar(
            select(ProgressRecord).where(
                ProgressRecord.student_id == student.id,
                ProgressRecord.course_version_id
                == prerequisite.chapter.course_version_id,
                ProgressRecord.unit_id == prerequisite.id,
            )
        )
        if existing is not None:
            print("AVG demo prerequisite already exists; no changes made.")
            return
        completed = Attempt(
            student_id=student.id,
            unit_id=prerequisite.id,
            course_version_id=prerequisite.chapter.course_version_id,
            status="completed",
            difficulty="standard",
            experience_mode="chat",
            content_bindings={"fixture": "isolated-avg-browser-qa"},
        )
        db.add(completed)
        db.flush()
        db.add(
            ProgressRecord(
                student_id=student.id,
                course_version_id=prerequisite.chapter.course_version_id,
                unit_id=prerequisite.id,
                completed_attempt_id=completed.id,
                latest_score=80,
                best_score=80,
            )
        )
        db.commit()
    print("AVG demo prerequisite is ready in the configured non-production database.")


if __name__ == "__main__":
    main()
