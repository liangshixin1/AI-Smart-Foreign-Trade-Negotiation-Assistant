from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker
from test_auth import auth_header, login

from app.modules.auth.models import User
from app.modules.curriculum.models import Chapter, TrainingUnit
from app.modules.training.models import Attempt

TEMPLATE = (
    Path(__file__).resolve().parents[3]
    / "content"
    / "knowledge-graph"
    / "templates"
    / "expert-knowledge-graph-v2.1.xlsx"
)


def _publish_v21(
    client: TestClient,
) -> tuple[dict[str, str], dict[str, str], dict[str, object], dict[str, object]]:
    teacher = auth_header(login(client, "teacher")["access_token"])
    technician = auth_header(login(client, "technician")["access_token"])
    imported = client.post(
        "/api/v1/knowledge-graph/imports",
        headers={
            **teacher,
            "X-File-Name": "expert-knowledge-graph-v2.1.xlsx",
            "X-Template-Version": "2.1",
        },
        content=TEMPLATE.read_bytes(),
    )
    assert imported.status_code == 201, imported.text
    assert imported.json()["status"] == "review_ready"
    change = client.get(
        f"/api/v1/knowledge-graph/imports/{imported.json()['id']}/change-set",
        headers=teacher,
    ).json()
    client.post(
        f"/api/v1/knowledge-graph/change-sets/{change['id']}/submit-review", headers=teacher
    )
    client.post(
        f"/api/v1/knowledge-graph/change-sets/{change['id']}/decision",
        headers=technician,
        json={"decision": "approve"},
    )
    published = client.post(
        f"/api/v1/knowledge-graph/change-sets/{change['id']}/publish", headers=technician
    )
    assert published.status_code == 200, published.text
    return teacher, technician, change, published.json()


def test_expert_v21_imports_stage_first_bilingual_graph(client: TestClient) -> None:
    teacher, _, change, _ = _publish_v21(client)
    assert change["compiler_version"] == "expert-stage-compiler/2.1"
    assert change["summary"] == {
        "stage_count": 9,
        "case_count": 20,
        "phenomenon_count": 66,
        "knowledge_resource_count": 94,
        "strategy_count": 24,
        "node_count": 505,
        "relationship_count": 676,
        "new_node_count": 505,
        "reused_node_count": 0,
        "conflict_count": 0,
    }
    stage = next(node for node in change["nodes"] if node["stable_key"] == "stage:S1")
    assert stage["properties"]["StageNameZH"] == "询盘"
    assert stage["properties"]["StageNameEN"] == "Inquiry"
    assert any(
        edge["source"] == "stage:S1"
        and edge["target"] == "scenario:S01"
        and edge["type"] == "CONTAINS_SCENARIO"
        for edge in change["relationships"]
    )
    assert any(
        edge["source"] == "stage:S1"
        and edge["target"] == "phenomenon:P1.01"
        and edge["type"] == "CONTAINS_PHENOMENON"
        for edge in change["relationships"]
    )

    graph = client.get("/api/v1/knowledge-graph/teacher/graph", headers=teacher)
    assert graph.status_code == 200, graph.text
    assert graph.json()["node_count"] == 213
    stage_view = next(node for node in graph.json()["nodes"] if node["type"] == "Stage")
    assert stage_view["short_label"] == "询盘"
    assert stage_view["label"] == "询盘"


def test_expert_v21_training_uses_stage_candidates(
    client: TestClient,
    session_factory: sessionmaker[Session],
    curriculum_enrollment: None,
    users: dict[str, User],
) -> None:
    del curriculum_enrollment
    _, _, _, publication = _publish_v21(client)
    with session_factory() as db:
        unit, course_version_id = db.execute(
            select(TrainingUnit, Chapter.course_version_id)
            .join(Chapter, Chapter.id == TrainingUnit.chapter_id)
            .where(TrainingUnit.unit_key == "chapter-7-section-1")  # gitleaks:allow
        ).one()
        attempt = Attempt(
            student_id=users["student"].id,
            unit_id=unit.id,
            course_version_id=course_version_id,
            status="in_progress",
            difficulty="standard",
            content_bindings={"knowledge_graph_version": str(publication["graph_version"])},
        )
        db.add(attempt)
        db.commit()
        attempt_id = attempt.id
    student = auth_header(login(client, "student")["access_token"])
    scaffold = client.get(
        f"/api/v1/knowledge-graph/student/attempts/{attempt_id}/scaffolds",
        headers=student,
    )
    assert scaffold.status_code == 200, scaffold.text
    payload = scaffold.json()
    assert payload["scenario"]["id"] == "scenario:S15"
    assert {item["id"] for item in payload["phenomena"]} == {
        f"phenomenon:P7.0{index}" for index in range(1, 8)
    }
    assert len(payload["knowledge_resources"]) == 20
    assert len(payload["strategies"]) == 1
    assert len(payload["scaffolds"]) == 14
    assert all(item["short_label"] for item in payload["knowledge_resources"])
