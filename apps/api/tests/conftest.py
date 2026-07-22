from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import Settings
from app.core.security import hash_password
from app.db.base import Base
from app.main import create_app
from app.modules.auth.models import Role, User, UserRole
from app.modules.classrooms.models import Classroom, Enrollment
from app.modules.curriculum.import_service import CurriculumImporter

TEST_PASSWORD = "Correct-Horse-Battery-Staple"


@pytest.fixture
def session_factory() -> Generator[sessionmaker[Session], None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    yield factory
    engine.dispose()


@pytest.fixture
def users(session_factory: sessionmaker[Session]) -> dict[str, User]:
    created: dict[str, User] = {}
    with session_factory() as db:
        for role_code in ("student", "teacher", "technician"):
            role = Role(code=role_code, name=role_code.title())
            user = User(
                email=f"{role_code}@example.test",
                student_no="2026001" if role_code == "student" else None,
                display_name=f"{role_code.title()} User",
                password_hash=hash_password(TEST_PASSWORD),
            )
            user.user_roles.append(UserRole(role=role))
            db.add(user)
            created[role_code] = user
        db.commit()
    return created


@pytest.fixture
def client(
    session_factory: sessionmaker[Session], users: dict[str, User]
) -> Generator[TestClient, None, None]:
    del users
    settings = Settings(
        app_env="test",
        database_url="sqlite://",
        auth_token_pepper="test-pepper-with-more-than-thirty-two-characters",
        access_token_ttl_seconds=3600,
        refresh_token_ttl_seconds=7200,
        llm_provider="mock",
    )
    with TestClient(create_app(settings=settings, session_factory=session_factory)) as test_client:
        yield test_client


@pytest.fixture
def curriculum_enrollment(session_factory: sessionmaker[Session], users: dict[str, User]) -> None:
    content_root = Path(__file__).resolve().parents[3] / "content"
    with session_factory() as db:
        version = CurriculumImporter(db, content_root).import_slice()
        classroom = Classroom(
            name="Test Classroom",
            course_version_id=version.id,
            owner_teacher_id=users["teacher"].id,
        )
        db.add(classroom)
        db.flush()
        db.add(Enrollment(classroom_id=classroom.id, student_id=users["student"].id))
        db.commit()
