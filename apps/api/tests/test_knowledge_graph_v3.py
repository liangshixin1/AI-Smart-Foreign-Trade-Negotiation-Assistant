from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker
from test_auth import auth_header, login

from app.modules.assessment.schemas import GraphRecommendationCandidate
from app.modules.auth.models import User
from app.modules.curriculum.models import Chapter, TrainingUnit
from app.modules.knowledge_graph.consumption_service import base_display_label
from app.modules.knowledge_graph.models import (
    KnowledgeGraphKnowledgePointSnapshot,
    KnowledgeGraphPhenomenonKnowledgeEdge,
    KnowledgeGraphPhenomenonSnapshot,
    KnowledgeGraphScenarioPhenomenonBinding,
    KnowledgeGraphStageSnapshot,
    KnowledgeGraphTranslationOverlay,
)
from app.modules.knowledge_graph.recommendation_service import GraphRecommendationService
from app.modules.knowledge_graph.v3_validation import validate_expert_workbook_v3
from app.modules.knowledge_graph.xlsx_parser import parse_expert_workbook_v3
from app.modules.training.models import Attempt

TEMPLATE = (
    Path(__file__).resolve().parents[3]
    / "content/knowledge-graph/templates/expert-knowledge-graph-v3.xlsx"
)
V21_TEMPLATE = TEMPLATE.with_name("expert-knowledge-graph-v2.1.xlsx")


def _publish_v3(client: TestClient) -> tuple[dict[str, str], dict[str, object]]:
    teacher = auth_header(login(client, "teacher")["access_token"])
    technician = auth_header(login(client, "technician")["access_token"])
    imported = client.post(
        "/api/v1/knowledge-graph/imports",
        headers={
            **teacher,
            "X-File-Name": TEMPLATE.name,
            "X-Template-Version": "3.0",
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
    return teacher, change


def test_expert_source_eight_sheets_pass_strict_validation() -> None:
    parsed = parse_expert_workbook_v3(TEMPLATE.read_bytes())
    assert validate_expert_workbook_v3(parsed) == []
    assert len(parsed.sheets["01_L1_Stages"]) == 9
    assert len(parsed.sheets["02_L2_Phenomena"]) == 66
    assert len(parsed.sheets["03_L3_Knowledge"]) == 118
    assert len(parsed.sheets["04_Edges"]) == 298


def test_reviewed_v3_name_zh_replaces_legacy_short_name() -> None:
    properties: dict[str, object] = {
        "KnowledgeNameZH": "询盘定义",
        "ShortNameZH": "旧版截断名称",
        "translation_status": "reviewed",
    }
    assert base_display_label(properties, "询盘定义") == "询盘定义"
    assert base_display_label({"ShortNameZH": "旧版短名"}, "正式名称") == "旧版短名"


def test_recommendation_evidence_cannot_be_saved_as_unused() -> None:
    selected = GraphRecommendationCandidate(
        node_id="knowledge:K015",
        confidence=0.9,
        reason="学生引用了明确有效期。",
        reveal_level=1,
        application_state="recalled_unused",
        evidence_excerpt="acceptance reaching you by 15 January 2027",
    )
    result = GraphRecommendationService.validate_selection(
        [
            {
                "node_id": "knowledge:K015",
                "node_type": "knowledge_resource",
                "title": "发盘有效期",
                "contextual_how": "明确有效期限。",
            }
        ],
        [selected],
        [],
    )
    assert result[0]["application_state"] == "applied_partially"
    assert result[0]["evidence_excerpt"] == selected.evidence_excerpt


def test_expert_v3_import_persists_facts_and_compiles_unified_graph(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    teacher, change = _publish_v3(client)
    assert change["compiler_version"] == "expert-fact-compiler/3.1"
    assert change["summary"]["node_count"] == 345
    assert change["summary"]["relationship_count"] == 568
    assert change["summary"]["teacher_node_count"] == 213
    assert change["summary"]["teacher_edge_count"] == 436
    knowledge = [node for node in change["nodes"] if node["type"] == "KnowledgePoint"]
    assert len(knowledge) == 118
    assert all("ShortNameZH" not in node["properties"] for node in knowledge)
    assert {node["properties"]["KnowledgeTypeCode"] for node in knowledge} == {
        "Concept",
        "Correspondence",
        "Cross-cultural",
        "Legal",
        "Procedure",
        "Risk",
        "Strategy",
    }
    assert any(
        edge["source"] == "phenomenon:P1.01"
        and edge["target"] == "knowledge:K001"
        and edge["type"] == "REQUIRES_KNOWLEDGE"
        for edge in change["relationships"]
    )
    assert {
        edge["target"]
        for edge in change["relationships"]
        if edge["source"] == "scenario:S05" and edge["type"] == "FOCUSES_ON"
    } == {"phenomenon:P2.02", "phenomenon:P2.07"}
    graph = client.get("/api/v1/knowledge-graph/teacher/graph", headers=teacher)
    assert graph.status_code == 200, graph.text
    assert graph.json()["node_count"] == 213
    assert graph.json()["edge_count"] == 436
    assert all(
        node["short_label"] == node["label"]
        for node in graph.json()["nodes"]
        if node["type"] in {"stage", "phenomenon", "knowledge_point"}
    )

    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(KnowledgeGraphStageSnapshot)) == 9
        assert db.scalar(select(func.count()).select_from(KnowledgeGraphPhenomenonSnapshot)) == 66
        assert (
            db.scalar(select(func.count()).select_from(KnowledgeGraphKnowledgePointSnapshot)) == 118
        )
        assert (
            db.scalar(select(func.count()).select_from(KnowledgeGraphPhenomenonKnowledgeEdge))
            == 298
        )
        assert db.scalar(select(func.count()).select_from(KnowledgeGraphTranslationOverlay)) == 395
        assert (
            db.scalar(select(func.count()).select_from(KnowledgeGraphScenarioPhenomenonBinding))
            == 52
        )


def test_expert_v3_attempt_reads_unified_knowledge_as_compatible_groups(
    client: TestClient,
    session_factory: sessionmaker[Session],
    curriculum_enrollment: None,
    users: dict[str, User],
) -> None:
    del curriculum_enrollment
    _, change = _publish_v3(client)
    # 发布接口生成的版本可从变更集详情中的后续发布读取; 测试图存储使用相同 change id 前缀。
    technician = auth_header(login(client, "technician")["access_token"])
    publication = client.post(
        f"/api/v1/knowledge-graph/change-sets/{change['id']}/publish", headers=technician
    ).json()
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
            content_bindings={"knowledge_graph_version": publication["graph_version"]},
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
        "phenomenon:P7.01",
        "phenomenon:P7.02",
        "phenomenon:P7.04",
        "phenomenon:P7.06",
    }
    assert len(payload["knowledge_resources"]) == 11
    assert len(payload["strategies"]) == 1
    assert len(payload["scaffolds"]) == 8


def test_expert_v3_knowledge_point_exposes_bilingual_default_learning_content(
    client: TestClient,
) -> None:
    _publish_v3(client)
    student = auth_header(login(client, "student")["access_token"])
    teacher = auth_header(login(client, "teacher")["access_token"])
    content = client.get(
        "/api/v1/knowledge-graph/student/content/knowledge%3AK001", headers=student
    )
    assert content.status_code == 200, content.text
    payload = content.json()
    assert payload["node_type"] == "KnowledgePoint"
    assert payload["title"] == "询盘的定义"
    assert "询盘是就商品" in payload["markdown_body"]

    updated = client.put(
        "/api/v1/knowledge-graph/teacher/content/knowledge%3AK001",
        headers=teacher,
        json={
            "title": "询盘的定义（教师精讲）",
            "summary": "用于课前学习。",
            "markdown_body": "## 询盘\n\n教师补充内容。",
            "status": "published",
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["title"] == "询盘的定义（教师精讲）"


def test_rollback_restores_previous_materialized_graph(client: TestClient) -> None:
    _, v3_change = _publish_v3(client)
    teacher = auth_header(login(client, "teacher")["access_token"])
    technician = auth_header(login(client, "technician")["access_token"])
    v3_publication = client.post(
        f"/api/v1/knowledge-graph/change-sets/{v3_change['id']}/publish", headers=technician
    ).json()
    imported = client.post(
        "/api/v1/knowledge-graph/imports",
        headers={
            **teacher,
            "X-File-Name": V21_TEMPLATE.name,
            "X-Template-Version": "2.1",
        },
        content=V21_TEMPLATE.read_bytes(),
    ).json()
    change = client.get(
        f"/api/v1/knowledge-graph/imports/{imported['id']}/change-set", headers=teacher
    ).json()
    client.post(
        f"/api/v1/knowledge-graph/change-sets/{change['id']}/submit-review", headers=teacher
    )
    client.post(
        f"/api/v1/knowledge-graph/change-sets/{change['id']}/decision",
        headers=technician,
        json={"decision": "approve"},
    )
    current = client.post(
        f"/api/v1/knowledge-graph/change-sets/{change['id']}/publish", headers=technician
    ).json()
    rolled_back = client.post(
        f"/api/v1/knowledge-graph/publications/{current['id']}/rollback",
        headers=technician,
    )
    assert rolled_back.status_code == 200, rolled_back.text
    active = client.get("/api/v1/knowledge-graph/publications/active", headers=technician).json()
    assert active["graph_version"] == v3_publication["graph_version"]
    graph = client.get("/api/v1/knowledge-graph/teacher/graph", headers=teacher).json()
    assert any(node["type"] == "KnowledgePoint" for node in graph["nodes"])
    reactivated = client.post(
        f"/api/v1/knowledge-graph/change-sets/{change['id']}/publish", headers=technician
    )
    assert reactivated.status_code == 200, reactivated.text
    assert reactivated.json()["graph_version"] == current["graph_version"]
    active_again = client.get(
        "/api/v1/knowledge-graph/publications/active", headers=technician
    ).json()
    assert active_again["graph_version"] == current["graph_version"]
