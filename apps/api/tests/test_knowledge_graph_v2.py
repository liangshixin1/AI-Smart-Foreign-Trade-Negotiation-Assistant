from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi.testclient import TestClient
from test_auth import auth_header, login

TEMPLATE = (
    Path(__file__).resolve().parents[3]
    / "content"
    / "knowledge-graph"
    / "templates"
    / "teacher-knowledge-graph-v2.xlsx"
)


def _minimal_pptx() -> bytes:
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", "<Types />")
        archive.writestr("ppt/presentation.xml", "<p:presentation />")
    return buffer.getvalue()


def _publish_v2(client: TestClient) -> tuple[dict[str, str], dict[str, str], dict[str, object]]:
    teacher = auth_header(login(client, "teacher")["access_token"])
    technician = auth_header(login(client, "technician")["access_token"])
    imported = client.post(
        "/api/v1/knowledge-graph/imports",
        headers={
            **teacher,
            "X-File-Name": "knowledge-graph-v2.xlsx",
            "X-Template-Version": "2.0",
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
    return teacher, technician, change


def test_v2_reuses_global_nodes_and_learning_content_is_editable(client: TestClient) -> None:
    teacher, _, change = _publish_v2(client)
    summary = change["summary"]
    assert summary["case_count"] == 20
    assert summary["phenomenon_count"] == 40
    assert summary["knowledge_resource_count"] == 77
    assert summary["strategy_count"] == 25
    strategy_nodes = [node for node in change["nodes"] if node["stable_key"] == "strategy:NS001"]
    assert len(strategy_nodes) == 1
    addressed = [
        edge
        for edge in change["relationships"]
        if edge["source"] == "strategy:NS001" and edge["type"] == "ADDRESSES"
    ]
    assert len(addressed) == 2

    student = auth_header(login(client, "student")["access_token"])
    graph = client.get("/api/v1/knowledge-graph/student/graph", headers=student)
    assert graph.status_code == 200
    assert graph.json()["node_count"] == 142

    content_url = "/api/v1/knowledge-graph/student/content/knowledge%3AK001"
    initial = client.get(content_url, headers=student)
    assert initial.status_code == 200
    assert initial.json()["title"].startswith("CIF")
    updated = client.put(
        "/api/v1/knowledge-graph/teacher/content/knowledge%3AK001",
        headers=teacher,
        json={
            "title": "CIF 成本、保险费加运费",
            "summary": "用于识别 CIF 条件下的费用与风险边界。",
            "markdown_body": "# CIF\n\n## 学习目标\n\n区分费用承担与风险转移。",
            "status": "published",
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["assets"] == []
    assert client.get(content_url, headers=student).json()["title"] == "CIF 成本、保险费加运费"

    video = b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isom"
    uploaded_video = client.put(
        "/api/v1/knowledge-graph/teacher/content/knowledge%3AK001/assets/video",
        headers={**teacher, "X-File-Name": "CIF-introduction.mp4"},
        content=video,
    )
    assert uploaded_video.status_code == 200, uploaded_video.text
    assert uploaded_video.json()["assets"][0]["kind"] == "video"
    student_video = client.get(f"{content_url}/assets/video", headers=student)
    assert student_video.status_code == 200
    assert student_video.content == video
    assert student_video.headers["content-type"] == "video/mp4"

    uploaded_slides = client.put(
        "/api/v1/knowledge-graph/teacher/content/knowledge%3AK001/assets/slides",
        headers={**teacher, "X-File-Name": "CIF-theory.pptx"},
        content=_minimal_pptx(),
    )
    assert uploaded_slides.status_code == 200, uploaded_slides.text
    assert {asset["kind"] for asset in uploaded_slides.json()["assets"]} == {
        "video",
        "slides",
    }
    assert client.get(f"{content_url}/assets/slides", headers=student).status_code == 200

    rejected_legacy_ppt = client.put(
        "/api/v1/knowledge-graph/teacher/content/knowledge%3AK001/assets/slides",
        headers={**teacher, "X-File-Name": "legacy.ppt"},
        content=b"legacy-ppt",
    )
    assert rejected_legacy_ppt.status_code == 422
    forbidden_upload = client.put(
        "/api/v1/knowledge-graph/teacher/content/knowledge%3AK001/assets/video",
        headers={**student, "X-File-Name": "student.mp4"},
        content=video,
    )
    assert forbidden_upload.status_code == 403


def test_round_evaluation_selects_only_fixed_v2_candidates(
    client: TestClient, curriculum_enrollment: None
) -> None:
    del curriculum_enrollment
    _publish_v2(client)
    student = auth_header(login(client, "student")["access_token"])
    attempt = client.post(
        "/api/v1/attempts",
        headers=student,
        json={"unit_id": "chapter-0-section-1", "difficulty": "standard"},
    )
    assert attempt.status_code == 201, attempt.text
    with client.stream(
        "POST",
        f"/api/v1/attempts/{attempt.json()['id']}/messages/stream",
        headers=student,
        json={
            "client_message_id": "knowledge-v2-round-0001",
            "content": "Please send your catalogue before we discuss any purchase commitment.",
        },
    ) as response:
        assert response.status_code == 200
        events = [
            json.loads(line.removeprefix("data: "))
            for line in response.iter_lines()
            if line.startswith("data: ")
        ]
    completed = next(item for item in events if "recommendations" in item)
    assert completed["recommendations"]
    assert {item["node_type"] for item in completed["recommendations"]} <= {
        "knowledge_resource",
        "strategy",
    }
    allowed_prefixes = ("knowledge:K", "strategy:NS")
    assert all(
        item["node_id"].startswith(allowed_prefixes) for item in completed["recommendations"]
    )
