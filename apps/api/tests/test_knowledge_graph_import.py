from __future__ import annotations

import io
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker
from test_auth import auth_header, login

from app.modules.knowledge_graph.models import KnowledgeGraphAuditEvent, KnowledgeImportJob

NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
TEMPLATE = (
    Path(__file__).resolve().parents[3]
    / "content"
    / "knowledge-graph"
    / "templates"
    / "teacher-case-dsl-v1.xlsx"
)


def upload(client: TestClient, headers: dict[str, str], content: bytes) -> Response:
    return client.post(
        "/api/v1/knowledge-graph/imports",
        headers={
            **headers,
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "X-File-Name": "teacher-case-demo.xlsx",
            "X-Template-Version": "1.0",
        },
        content=content,
    )


def workbook_without_case_title(content: bytes) -> bytes:
    source = zipfile.ZipFile(io.BytesIO(content))
    output = io.BytesIO()
    with source, zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as target:
        for item in source.infolist():
            payload = source.read(item.filename)
            if item.filename == "xl/worksheets/sheet2.xml":
                root = ET.fromstring(payload)
                for cell in root.findall(f".//{{{NS_MAIN}}}c"):
                    if cell.attrib.get("r") == "B6":
                        for text in [
                            *cell.findall(f".//{{{NS_MAIN}}}t"),
                            *cell.findall(f".//{{{NS_MAIN}}}v"),
                        ]:
                            text.text = ""
                payload = ET.tostring(root, encoding="utf-8", xml_declaration=True)
            target.writestr(item, payload)
    return output.getvalue()


def test_teacher_dsl_import_review_publish_and_rollback(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    content = TEMPLATE.read_bytes()
    teacher = auth_header(login(client, "teacher")["access_token"])
    technician = auth_header(login(client, "technician")["access_token"])

    imported = upload(client, teacher, content)
    assert imported.status_code == 201, imported.text
    job = imported.json()
    assert job["status"] == "review_ready"
    assert job["error_count"] == 0
    assert job["warning_count"] >= 0

    replay = upload(client, teacher, content)
    assert replay.status_code == 201
    assert replay.json()["id"] == job["id"]
    assert replay.json()["idempotent_replay"] is True
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(KnowledgeImportJob)) == 1

    issues = client.get(f"/api/v1/knowledge-graph/imports/{job['id']}/issues", headers=teacher)
    assert issues.status_code == 200
    assert all(issue["severity"] == "warning" for issue in issues.json())

    change_response = client.get(
        f"/api/v1/knowledge-graph/imports/{job['id']}/change-set", headers=teacher
    )
    assert change_response.status_code == 200
    change_set = change_response.json()
    assert change_set["summary"]["case_count"] >= 4
    assert change_set["summary"]["node_count"] >= 60
    assert change_set["summary"]["relationship_count"] >= 60
    assert change_set["summary"]["conflict_count"] == 0
    assert all(item["title"] and item["course_unit"] for item in change_set["teaching_preview"])

    submitted = client.post(
        f"/api/v1/knowledge-graph/change-sets/{change_set['id']}/submit-review",
        headers=teacher,
    )
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "in_review"
    assert (
        client.post(
            f"/api/v1/knowledge-graph/change-sets/{change_set['id']}/decision",
            headers=teacher,
            json={"decision": "approve"},
        ).status_code
        == 403
    )

    approved = client.post(
        f"/api/v1/knowledge-graph/change-sets/{change_set['id']}/decision",
        headers=technician,
        json={"decision": "approve"},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    published = client.post(
        f"/api/v1/knowledge-graph/change-sets/{change_set['id']}/publish",
        headers=technician,
    )
    assert published.status_code == 200
    publication = published.json()
    assert publication["is_active"] is True
    assert publication["storage_backend"] == "memory"
    assert (
        client.get("/api/v1/knowledge-graph/publications/active", headers=technician).json()["id"]
        == publication["id"]
    )

    rolled_back = client.post(
        f"/api/v1/knowledge-graph/publications/{publication['id']}/rollback",
        headers=technician,
    )
    assert rolled_back.status_code == 200
    assert rolled_back.json()["status"] == "rolled_back"
    assert (
        client.get("/api/v1/knowledge-graph/publications/active", headers=technician).json() is None
    )
    restored = upload(client, teacher, content)
    assert restored.json()["idempotent_replay"] is True
    assert restored.json()["status"] == "approved"
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(KnowledgeGraphAuditEvent)) == 5


def test_invalid_required_cell_reports_exact_location(client: TestClient) -> None:
    teacher = auth_header(login(client, "teacher")["access_token"])
    invalid = workbook_without_case_title(TEMPLATE.read_bytes())
    response = upload(client, teacher, invalid)
    assert response.status_code == 201, response.text
    job = response.json()
    assert job["status"] == "validation_failed"
    issues = client.get(
        f"/api/v1/knowledge-graph/imports/{job['id']}/issues", headers=teacher
    ).json()
    required = next(issue for issue in issues if issue["code"] == "content.required")
    assert required["sheet_name"] == "01_案例总表"
    assert required["row_number"] == 6
    assert required["column_name"] == "案例名称（必填）"
    unavailable = client.get(
        f"/api/v1/knowledge-graph/imports/{job['id']}/change-set", headers=teacher
    )
    assert unavailable.status_code == 409


def test_student_cannot_import_or_download_teacher_template(client: TestClient) -> None:
    student = auth_header(login(client, "student")["access_token"])
    assert (
        client.get(
            "/api/v1/knowledge-graph/templates/teacher-case/latest", headers=student
        ).status_code
        == 403
    )
    assert upload(client, student, TEMPLATE.read_bytes()).status_code == 403
