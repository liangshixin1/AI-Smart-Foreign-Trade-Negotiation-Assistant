from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker
from test_auth import auth_header, login

from app.modules.classrooms.models import Classroom


def test_teacher_can_manage_roster_and_student_cannot(
    client: TestClient,
    curriculum_enrollment: None,
    session_factory: sessionmaker[Session],
) -> None:
    del curriculum_enrollment
    with session_factory() as db:
        classroom_id = db.scalar(select(Classroom.id))
    assert classroom_id is not None
    path = f"/api/v1/teacher/classrooms/{classroom_id}/students"
    student = auth_header(login(client, "student")["access_token"])
    teacher = auth_header(login(client, "teacher")["access_token"])
    assert client.get(path, headers=student).status_code == 403

    created = client.post(
        path,
        headers=teacher,
        json={
            "student_no": "2026999",
            "display_name": "内测学生",
            "email": "beta@example.test",
            "initial_password": "Beta-Password-2026",
        },
    )
    assert created.status_code == 201
    student_id = created.json()["id"]
    roster = client.get(path, headers=teacher)
    assert roster.status_code == 200
    assert any(item["student_no"] == "2026999" for item in roster.json())
    attempt = client.post(
        "/api/v1/attempts",
        headers=student,
        json={"unit_id": "chapter-0-section-1", "difficulty": "standard"},
    )
    assert attempt.status_code == 201
    attempt_id = attempt.json()["id"]
    student_id = client.get("/api/v1/me", headers=student).json()["user"]["id"]
    detail = client.get(
        f"/api/v1/teacher/students/{student_id}/progress",
        headers=teacher,
    )
    assert detail.status_code == 200
    assert detail.json()["attempts"][0]["id"] == attempt_id
    replay = client.get(f"/api/v1/teacher/attempts/{attempt_id}", headers=teacher)
    assert replay.status_code == 200
    assert replay.json()["attempt"]["scenario"] is not None
    overview = client.get(f"/api/v1/teacher/classrooms/{classroom_id}/overview", headers=teacher)
    assert overview.status_code == 200
    assert overview.json()["active_students_7d"] == 1
    assert client.delete(f"{path}/{student_id}", headers=teacher).status_code == 204


def test_roster_import_is_atomic_when_file_contains_duplicates(
    client: TestClient,
    curriculum_enrollment: None,
    session_factory: sessionmaker[Session],
) -> None:
    del curriculum_enrollment
    with session_factory() as db:
        classroom_id = db.scalar(select(Classroom.id))
    assert classroom_id is not None
    teacher = auth_header(login(client, "teacher")["access_token"])
    path = f"/api/v1/teacher/classrooms/{classroom_id}/students"
    before = len(client.get(path, headers=teacher).json())
    response = client.post(
        f"{path}/import",
        headers=teacher,
        json={
            "rows": [
                {
                    "student_no": "2026101",
                    "display_name": "学生甲",
                    "email": "same@example.test",
                    "initial_password": "Initial-Password-2026",
                },
                {
                    "student_no": "2026102",
                    "display_name": "学生乙",
                    "email": "same@example.test",
                    "initial_password": "Initial-Password-2026",
                },
            ]
        },
    )
    assert response.status_code == 409
    assert len(client.get(path, headers=teacher).json()) == before


def test_technician_config_never_returns_api_keys(client: TestClient) -> None:
    headers = auth_header(login(client, "technician")["access_token"])
    response = client.get("/api/v1/technician/llm-config", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"provider", "base_url", "timeout_seconds", "max_retries", "agents"}
    assert all(set(agent) == {"purpose", "configured", "model"} for agent in body["agents"])

    invalid = client.put(
        "/api/v1/technician/llm-config",
        headers=headers,
        json={
            "base_url": "https://api.deepseek.com",
            "timeout_seconds": 30,
            "max_retries": 1,
            "scenario_model": "deepseek-v4-flash\nINJECTED=true",
            "conversation_model": "deepseek-v4-flash",
            "evaluation_model": "deepseek-v4-flash",
        },
    )
    assert invalid.status_code == 422
    assert "api_key" not in invalid.text.lower()


def test_teacher_competencies_are_aggregated_from_structured_dimensions(
    client: TestClient,
    curriculum_enrollment: None,
) -> None:
    del curriculum_enrollment
    student = auth_header(login(client, "student")["access_token"])
    teacher = auth_header(login(client, "teacher")["access_token"])
    created = client.post(
        "/api/v1/attempts",
        headers=student,
        json={"unit_id": "chapter-0-section-1", "difficulty": "standard"},
    ).json()
    client.post(
        f"/api/v1/attempts/{created['id']}/messages",
        headers=student,
        json={"client_message_id": "teacher-metric-message", "content": "Please send the catalog."},
    )
    client.post(
        f"/api/v1/attempts/{created['id']}/submit",
        headers={**student, "Idempotency-Key": "teacher-metric-submit"},
    )
    student_id = client.get("/api/v1/me", headers=student).json()["user"]["id"]
    detail = client.get(f"/api/v1/teacher/students/{student_id}/progress", headers=teacher)
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["student"]["completion_rate"] == 5
    assert len(body["competencies"]) == 5
    assert all(item["evidence_count"] == 1 for item in body["competencies"])
    assert all(item["trend"][0]["attempt_id"] == created["id"] for item in body["competencies"])
