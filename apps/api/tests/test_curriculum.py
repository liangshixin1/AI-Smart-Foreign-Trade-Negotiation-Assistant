from __future__ import annotations

from pathlib import Path

from conftest import TEST_PASSWORD
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.modules.curriculum.import_service import CurriculumImporter
from app.modules.curriculum.models import CourseVersion, TrainingUnit


def student_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "student@example.test", "password": TEST_PASSWORD},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_import_is_idempotent(session_factory: sessionmaker[Session]) -> None:
    content_root = Path(__file__).resolve().parents[3] / "content"
    with session_factory() as db:
        importer = CurriculumImporter(db, content_root)
        first = importer.import_slice()
        second = importer.import_slice()
        assert first.id == second.id
        assert db.scalar(select(func.count()).select_from(CourseVersion)) == 1
        assert db.scalar(select(func.count()).select_from(TrainingUnit)) == 20


def test_student_can_read_current_map_and_unit(
    client: TestClient, curriculum_enrollment: None
) -> None:
    del curriculum_enrollment
    headers = student_headers(client)
    course_map = client.get("/api/v1/courses/current/map", headers=headers)
    assert course_map.status_code == 200
    body = course_map.json()
    assert body["course_version"] == "2.2.1-beta.22"
    assert body["total_units"] == 20
    assert body["chapters"][0]["units"][0]["id"] == "chapter-0-section-1"
    assert any(
        unit["id"] == "chapter-3-section-1"
        for chapter in body["chapters"]
        for unit in chapter["units"]
    )
    statuses = {
        unit["id"]: unit["status"] for chapter in body["chapters"] for unit in chapter["units"]
    }
    assert statuses["chapter-0-section-1"] == "available"
    assert statuses["chapter-1-section-1"] == "locked"

    unit = client.get("/api/v1/units/chapter-3-section-1", headers=headers)
    assert unit.status_code == 200
    assert unit.json()["training_mode"] == "negotiation"
    assert len(unit.json()["rubric_dimensions"]) == 5

    locked_attempt = client.post(
        "/api/v1/attempts",
        headers=headers,
        json={"unit_id": "chapter-1-section-1", "difficulty": "standard"},
    )
    assert locked_attempt.status_code == 409
    assert locked_attempt.json()["error"]["code"] == "training.prerequisite_incomplete"


def test_teacher_cannot_use_student_curriculum_endpoint(
    client: TestClient, curriculum_enrollment: None
) -> None:
    del curriculum_enrollment
    login = client.post(
        "/api/v1/auth/login",
        json={"identifier": "teacher@example.test", "password": TEST_PASSWORD},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get("/api/v1/courses/current/map", headers=headers).status_code == 403
