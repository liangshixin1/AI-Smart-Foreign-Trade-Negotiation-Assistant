from __future__ import annotations

import argparse
from pathlib import Path

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import build_engine, build_session_factory
from app.modules.auth.models import Role, User, UserRole
from app.modules.classrooms.models import Classroom, Enrollment
from app.modules.curriculum.import_service import CurriculumImporter
from app.modules.curriculum.models import CourseVersion

DEV_USERS = (
    ("student@example.test", "2026001", "学生示例", "student"),
    ("teacher@example.test", None, "教师示例", "teacher"),
    ("technician@example.test", None, "技术员示例", "technician"),
)


def seed_dev_users() -> None:
    settings = get_settings()
    if settings.app_env == "production":
        raise RuntimeError("Development users cannot be seeded in production.")
    if settings.dev_seed_password is None:
        raise RuntimeError("Set DEV_SEED_PASSWORD before seeding development users.")
    factory = build_session_factory(build_engine(settings))
    with factory() as db:
        roles: dict[str, Role] = {}
        for code, name in (
            ("student", "学生"),
            ("teacher", "教师"),
            ("technician", "技术员"),
        ):
            role = db.scalar(select(Role).where(Role.code == code))
            if role is None:
                role = Role(code=code, name=name)
                db.add(role)
                db.flush()
            roles[code] = role
        for email, student_no, display_name, role_code in DEV_USERS:
            user = db.scalar(select(User).where(User.email == email))
            if user is None:
                user = User(
                    email=email,
                    student_no=student_no,
                    display_name=display_name,
                    password_hash=hash_password(settings.dev_seed_password),
                )
                db.add(user)
                db.flush()
                db.add(UserRole(user=user, role=roles[role_code]))
            else:
                user.password_hash = hash_password(settings.dev_seed_password)
        db.commit()
    print("Development users are ready. Password was read from DEV_SEED_PASSWORD.")


def import_curriculum(content_root: Path) -> None:
    settings = get_settings()
    factory = build_session_factory(build_engine(settings))
    with factory() as db:
        version = CurriculumImporter(db, content_root).import_slice()
    print(f"Curriculum version ready: {version.version} ({version.manifest_hash[:12]})")


def ensure_dev_curriculum(content_root: Path) -> None:
    """Initialize curriculum only when no published version exists."""
    settings = get_settings()
    factory = build_session_factory(build_engine(settings))
    with factory() as db:
        existing = db.scalar(
            select(CourseVersion)
            .where(CourseVersion.status == "published")
            .order_by(CourseVersion.published_at.desc())
        )
        if existing is not None:
            print(
                "Published curriculum already exists; "
                f"keeping version {existing.version} unchanged."
            )
            return
    import_curriculum(content_root)


def seed_dev_classroom() -> None:
    settings = get_settings()
    if settings.app_env == "production":
        raise RuntimeError("Development classroom cannot be seeded in production.")
    factory = build_session_factory(build_engine(settings))
    with factory() as db:
        teacher = db.scalar(select(User).where(User.email == "teacher@example.test"))
        student = db.scalar(select(User).where(User.email == "student@example.test"))
        version = db.scalar(
            select(CourseVersion)
            .where(CourseVersion.status == "published")
            .order_by(CourseVersion.published_at.desc())
        )
        if teacher is None or student is None or version is None:
            raise RuntimeError("Seed users and import curriculum before creating the classroom.")
        classroom = db.scalar(select(Classroom).where(Classroom.name == "阶段2示例班"))
        if classroom is None:
            classroom = Classroom(
                name="阶段2示例班",
                course_version_id=version.id,
                owner_teacher_id=teacher.id,
            )
            db.add(classroom)
            db.flush()
        elif classroom.course_version_id != version.id:
            classroom.course_version_id = version.id
        enrollment = db.scalar(
            select(Enrollment).where(
                Enrollment.classroom_id == classroom.id,
                Enrollment.student_id == student.id,
            )
        )
        if enrollment is None:
            db.add(Enrollment(classroom_id=classroom.id, student_id=student.id))
        db.commit()
    print("Development classroom and enrollment are ready.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "command",
        choices=[
            "seed-dev-users",
            "import-curriculum",
            "ensure-dev-curriculum",
            "seed-dev-classroom",
        ],
    )
    parser.add_argument(
        "--content-root",
        type=Path,
        default=Path(__file__).resolve().parents[3] / "content",
    )
    args = parser.parse_args()
    if args.command == "seed-dev-users":
        seed_dev_users()
    elif args.command == "import-curriculum":
        import_curriculum(args.content_root)
    elif args.command == "ensure-dev-curriculum":
        ensure_dev_curriculum(args.content_root)
    elif args.command == "seed-dev-classroom":
        seed_dev_classroom()


if __name__ == "__main__":
    main()
