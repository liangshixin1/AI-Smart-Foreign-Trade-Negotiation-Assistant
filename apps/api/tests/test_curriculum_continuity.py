from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select

from app.modules.curriculum.continuity import projected_statuses
from app.modules.curriculum.models import Chapter, CourseVersion, TrainingUnit
from app.modules.progress.models import ProgressRecord
from app.modules.training.models import Attempt


def test_new_course_preserves_only_unchanged_units(session_factory, users, curriculum_enrollment):
    with session_factory() as db:
        old = db.scalar(select(CourseVersion))
        units = list(
            db.scalars(
                select(TrainingUnit).join(Chapter).where(Chapter.course_version_id == old.id)
            )
        )
        chosen = [
            next(u for u in units if u.unit_key == key)
            for key in ["chapter-5-section-2", "chapter-6-section-1"]
        ]
        original_ids = []
        for u in chosen:
            a = Attempt(
                student_id=users["student"].id,
                unit_id=u.id,
                course_version_id=old.id,
                status="completed",
                difficulty="standard",
                content_bindings={},
            )
            db.add(a)
            db.flush()
            original_ids.append(a.id)
            db.add(
                ProgressRecord(
                    student_id=a.student_id,
                    course_version_id=old.id,
                    unit_id=u.id,
                    completed_attempt_id=a.id,
                    latest_score=90,
                    best_score=90,
                )
            )
        new = CourseVersion(
            course_id=old.course_id,
            version="continuity-test",
            status="published",
            source_hash=old.source_hash,
            manifest_hash=old.manifest_hash,
            published_at=old.published_at + timedelta(seconds=1),
        )
        db.add(new)
        db.flush()
        chapter = Chapter(course_version_id=new.id, chapter_key="test", title="Test", sort_order=1)
        db.add(chapter)
        db.flush()
        copies = []
        for u in chosen:
            values = {
                c.name: getattr(u, c.name)
                for c in TrainingUnit.__table__.columns
                if c.name not in {"id", "chapter_id"}
            }
            if u.unit_key == "chapter-6-section-1":
                values["version"] = "changed"
            copy = TrainingUnit(chapter_id=chapter.id, **values)
            db.add(copy)
            db.flush()
            copies.append(copy)
        db.commit()
        completed, latest = projected_statuses(db, users["student"].id, new.id)
        assert completed == {copies[0].id: original_ids[0]}
        assert latest[copies[0].id] == ("completed", original_ids[0])
        assert copies[1].id not in latest
        assert db.get(Attempt, original_ids[0]).course_version_id == old.id
        other, _ = projected_statuses(db, users["teacher"].id, new.id)
        assert other == {}
