# [导读] 业务名词: 图谱连接阶段、现象、知识和策略; Scaffold 是本次训练固定支持库, PI 十阶段是项
# [导读] 目采用的贸易流程分类。
# [导读] 用途: 回归验证图谱学习支持、推荐与证据消费。
# [导读] 为什么: 用可重复输入固定业务边界, 既检查成功结果, 也防止重试、权限或无效输入破坏已有行
# [导读] 为。
# [导读] 结构: 本文件有 5 个测试函数; 按各用例的准备、操作、断言顺序阅读, 公共夹具见
# [导读] tests/conftest.py。
# [导读] 提醒: 测试中的用户、令牌、案例和模型输出是测试数据; 通过这些用例不等于已验证真实外部模
# [导读] 型或线上环境。
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker
from test_auth import auth_header, login

from app.integrations.knowledge_graph.memory import MemoryGraphStore
from app.integrations.knowledge_graph.unavailable import UnavailableGraphStore
from app.modules.assessment.models import Evaluation, RoundEvaluation
from app.modules.classrooms.models import Classroom
from app.modules.curriculum.models import Chapter, TrainingUnit
from app.modules.knowledge_graph.learning_evidence_service import GraphLearningEvidenceService
from app.modules.knowledge_graph.models import GraphLearningEvidence
from app.modules.knowledge_graph.prompt_context import KnowledgeContextProvider
from app.modules.training.models import Attempt, Message, Submission

TEMPLATE = (
    Path(__file__).resolve().parents[3]
    / "content"
    / "knowledge-graph"
    / "templates"
    / "teacher-case-dsl-v1.xlsx"
)


def _publish(client: TestClient) -> dict[str, object]:
    teacher = auth_header(login(client, "teacher")["access_token"])
    technician = auth_header(login(client, "technician")["access_token"])
    imported = client.post(
        "/api/v1/knowledge-graph/imports",
        headers={
            **teacher,
            "X-File-Name": "phase2.xlsx",
            "X-Template-Version": "1.0",
        },
        content=TEMPLATE.read_bytes(),
    ).json()
    change = client.get(
        f"/api/v1/knowledge-graph/imports/{imported['id']}/change-set", headers=teacher
    ).json()
    client.post(
        f"/api/v1/knowledge-graph/change-sets/{change['id']}/submit-review",
        headers=teacher,
    )
    client.post(
        f"/api/v1/knowledge-graph/change-sets/{change['id']}/decision",
        headers=technician,
        json={"decision": "approve"},
    )
    response = client.post(
        f"/api/v1/knowledge-graph/change-sets/{change['id']}/publish",
        headers=technician,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_publication_failure_is_explicit_and_retryable(client: TestClient) -> None:
    teacher = auth_header(login(client, "teacher")["access_token"])
    technician = auth_header(login(client, "technician")["access_token"])
    imported = client.post(
        "/api/v1/knowledge-graph/imports",
        headers={
            **teacher,
            "X-File-Name": "failure.xlsx",
            "X-Template-Version": "1.0",
        },
        content=TEMPLATE.read_bytes(),
    ).json()
    change = client.get(
        f"/api/v1/knowledge-graph/imports/{imported['id']}/change-set", headers=teacher
    ).json()
    client.post(
        f"/api/v1/knowledge-graph/change-sets/{change['id']}/submit-review",
        headers=teacher,
    )
    client.post(
        f"/api/v1/knowledge-graph/change-sets/{change['id']}/decision",
        headers=technician,
        json={"decision": "approve"},
    )
    client.app.state.graph_store = UnavailableGraphStore("Neo4j test outage")
    failed = client.post(
        f"/api/v1/knowledge-graph/change-sets/{change['id']}/publish",
        headers=technician,
    )
    assert failed.status_code == 503
    assert failed.json()["error"]["code"] == "knowledge_graph.storage_unavailable"
    assert failed.json()["error"]["retryable"] is True
    refreshed = client.get(
        f"/api/v1/knowledge-graph/imports/{imported['id']}/change-set", headers=teacher
    )
    assert refreshed.json()["status"] == "publication_failed"


def _attempt_for_graph(
    factory: sessionmaker[Session], student_id: uuid.UUID, graph_version: str
) -> tuple[uuid.UUID, uuid.UUID]:
    with factory() as db:
        unit, course_version_id = db.execute(
            select(TrainingUnit, Chapter.course_version_id)
            .join(Chapter, Chapter.id == TrainingUnit.chapter_id)
            .where(TrainingUnit.title == "应对虚盘")
        ).one()
        attempt = Attempt(
            student_id=student_id,
            unit_id=unit.id,
            course_version_id=course_version_id,
            status="in_progress",
            difficulty="standard",
            content_bindings={"knowledge_graph_version": graph_version},
        )
        db.add(attempt)
        db.commit()
        return attempt.id, unit.id


def test_student_scaffolds_are_progressive_idempotent_and_version_pinned(
    client: TestClient,
    session_factory: sessionmaker[Session],
    curriculum_enrollment: None,
    users: dict[str, object],
) -> None:
    del curriculum_enrollment
    publication = _publish(client)
    student_id = users["student"].id  # type: ignore[attr-defined]
    attempt_id, _ = _attempt_for_graph(
        session_factory, student_id, str(publication["graph_version"])
    )
    headers = auth_header(login(client, "student")["access_token"])

    response = client.get(
        f"/api/v1/knowledge-graph/student/attempts/{attempt_id}/scaffolds",
        headers=headers,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["graph_version"] == publication["graph_version"]
    assert payload["phenomena"] and payload["strategies"] and payload["knowledge_resources"]
    assert all(item["content"] is None for item in payload["scaffolds"])
    first = payload["scaffolds"][0]
    bound_graph = client.get(
        f"/api/v1/knowledge-graph/student/attempts/{attempt_id}/graph", headers=headers
    )
    assert bound_graph.status_code == 200, bound_graph.text
    assert bound_graph.json()["graph_version"] == publication["graph_version"]

    event = {
        "node_id": first["id"],
        "event_type": "revealed",
        "level": first["level"],
        "client_event_id": "reveal-event-0001",
    }
    created = client.post(
        f"/api/v1/knowledge-graph/student/attempts/{attempt_id}/scaffold-events",
        headers=headers,
        json=event,
    )
    assert created.status_code == 201, created.text
    replay = client.post(
        f"/api/v1/knowledge-graph/student/attempts/{attempt_id}/scaffold-events",
        headers=headers,
        json=event,
    )
    assert replay.json()["id"] == created.json()["id"]

    store = client.app.state.graph_store
    assert isinstance(store, MemoryGraphStore)
    store.publish("future-version", [], [])
    refreshed = client.get(
        f"/api/v1/knowledge-graph/student/attempts/{attempt_id}/scaffolds",
        headers=headers,
    ).json()
    assert refreshed["graph_version"] == publication["graph_version"]
    assert next(item for item in refreshed["scaffolds"] if item["id"] == first["id"])["content"]


def test_teacher_graph_prompt_boundaries_and_learning_evidence(
    client: TestClient,
    session_factory: sessionmaker[Session],
    curriculum_enrollment: None,
    users: dict[str, object],
) -> None:
    del curriculum_enrollment
    publication = _publish(client)
    teacher = auth_header(login(client, "teacher")["access_token"])
    graph_response = client.get("/api/v1/knowledge-graph/teacher/graph", headers=teacher)
    assert graph_response.status_code == 200
    graph = graph_response.json()
    assert {item["type"] for item in graph["nodes"]} <= {
        "Scenario",
        "Phenomenon",
        "NegotiationStrategy",
        "Terminology",
        "TradeRule",
        "DocumentKnowledge",
        "BusinessProcess",
        "CommunicationKnowledge",
        "MarketKnowledge",
    }

    student_id = users["student"].id  # type: ignore[attr-defined]
    attempt_id, unit_database_id = _attempt_for_graph(
        session_factory, student_id, str(publication["graph_version"])
    )
    with session_factory() as db:
        unit = db.get(TrainingUnit, unit_database_id)
        assert unit is not None
        provider = KnowledgeContextProvider(db, client.app.state.graph_store)
        scenario_context = provider.scenario(unit)
        conversation_context = provider.conversation(unit, str(publication["graph_version"]))
        assert scenario_context is not None and '"phenomena"' in scenario_context.system_message
        assert '"strategies"' not in scenario_context.system_message
        assert conversation_context is not None
        assert '"strategies"' in conversation_context.system_message

        student_message = Message(
            attempt_id=attempt_id,
            sequence_no=1,
            role="student",
            content="Please issue a firm offer.",
            status="completed",
            client_message_id="phase2-message",
        )
        assistant_message = Message(
            attempt_id=attempt_id,
            sequence_no=2,
            role="assistant",
            content="We can issue a firm offer.",
            status="completed",
        )
        db.add_all([student_message, assistant_message])
        db.flush()
        evaluation = RoundEvaluation(
            attempt_id=attempt_id,
            student_message_id=student_message.id,
            assistant_message_id=assistant_message.id,
            status="completed",
            score=76,
            pros="识别了虚盘",
            cons="尚未设定有效期",
            detailed_evaluation="本轮已推动对方报实盘。",
            next_step_suggestion="追问实盘有效期。",
            checklist_results=[],
            provider="mock",
            model_name="mock",
            prompt_template_id="round-test",
            prompt_version="1.0",
        )
        db.add(evaluation)
        db.commit()
        attempt = db.get(Attempt, attempt_id)
        assert attempt is not None
        GraphLearningEvidenceService(db, client.app.state.graph_store).record(
            attempt,
            unit,
            evaluation.id,
            student_message.id,
            evaluation.score,
            evaluation.detailed_evaluation,
        )
        evidence = db.scalar(
            select(GraphLearningEvidence).where(
                GraphLearningEvidence.round_evaluation_id == evaluation.id
            )
        )
        assert evidence is not None
        assert evidence.mapping_method == "unit_scope_inferred"
        assert evidence.graph_version == publication["graph_version"]
        assert evidence.phenomenon_node_keys and evidence.strategy_node_keys

    replay = client.get(f"/api/v1/teacher/attempts/{attempt_id}", headers=teacher)
    assert replay.status_code == 200, replay.text
    assert replay.json()["graph_learning_evidence"][0]["mapping_method"] == "unit_scope_inferred"
    bound_graph = client.get(
        f"/api/v1/knowledge-graph/teacher/attempts/{attempt_id}/graph", headers=teacher
    )
    assert bound_graph.status_code == 200, bound_graph.text
    assert bound_graph.json()["graph_version"] == publication["graph_version"]


def test_classroom_insights_exclude_attempts_from_historical_course_versions(
    client: TestClient,
    session_factory: sessionmaker[Session],
    curriculum_enrollment: None,
    users: dict[str, object],
) -> None:
    """同名旧课程关卡不得污染当前班级的图谱学情。"""
    del curriculum_enrollment
    _publish(client)
    with session_factory() as db:
        classroom = db.scalar(select(Classroom))
        unit = db.scalar(select(TrainingUnit).where(TrainingUnit.title == "应对虚盘"))
        assert classroom is not None and unit is not None
        for index, (course_version_id, score) in enumerate(
            ((classroom.course_version_id, 82.0), (uuid.uuid4(), 18.0)), start=1
        ):
            attempt = Attempt(
                student_id=users["student"].id,  # type: ignore[attr-defined]
                unit_id=unit.id,
                course_version_id=course_version_id,
                status="completed",
                difficulty="standard",
                content_bindings={},
            )
            db.add(attempt)
            db.flush()
            submission = Submission(
                attempt_id=attempt.id,
                idempotency_key=f"version-isolation-{index}",
                conversation_hash=f"hash-{index}",
                frozen_payload={},
            )
            db.add(submission)
            db.flush()
            db.add(
                Evaluation(
                    attempt_id=attempt.id,
                    submission_id=submission.id,
                    run_no=1,
                    evaluation_status="completed",
                    overall_score=score,
                    level="Pass" if score >= 60 else "Needs work",
                    summary="课程版本隔离测试",
                    strengths=[],
                    improvements=[],
                    next_actions=[],
                    knowledge_tags=[],
                    provider="mock",
                    model_name="mock",
                    prompt_template_id="evaluation-test",
                    prompt_version="1.0",
                )
            )
        db.commit()

    teacher = auth_header(login(client, "teacher")["access_token"])
    response = client.get(
        f"/api/v1/knowledge-graph/teacher/classrooms/{classroom.id}/insights",
        headers=teacher,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["completed_attempts"] == 1
    assert payload["average_score"] == 82.0
    assert payload["weak_units"][0]["attempt_count"] == 1


def test_student_learning_activity_is_idempotent_and_visible_in_profile(
    client: TestClient,
    session_factory: sessionmaker[Session],
    curriculum_enrollment: None,
    users: dict[str, object],
) -> None:
    del curriculum_enrollment
    publication = _publish(client)
    student_id = users["student"].id  # type: ignore[attr-defined]
    attempt_id, _ = _attempt_for_graph(
        session_factory, student_id, str(publication["graph_version"])
    )
    headers = auth_header(login(client, "student")["access_token"])
    scaffold = client.get(
        f"/api/v1/knowledge-graph/student/attempts/{attempt_id}/scaffolds", headers=headers
    ).json()
    node_id = scaffold["knowledge_resources"][0]["id"]
    endpoint = f"/api/v1/knowledge-graph/student/content/{node_id}/activities"
    viewed = {
        "event_type": "viewed",
        "source": "training",
        "attempt_id": str(attempt_id),
        "client_event_id": "learning-view-0001",
    }
    created = client.post(endpoint, headers=headers, json=viewed)
    replay = client.post(endpoint, headers=headers, json=viewed)
    assert created.status_code == 201, created.text
    assert replay.json()["id"] == created.json()["id"]
    teacher_headers = auth_header(login(client, "teacher")["access_token"])
    forbidden = client.post(endpoint, headers=teacher_headers, json=viewed)
    assert forbidden.status_code == 403

    completed = client.post(
        endpoint,
        headers=headers,
        json={**viewed, "event_type": "completed", "client_event_id": "learning-done-0001"},
    )
    repeated = client.post(
        endpoint,
        headers=headers,
        json={**viewed, "event_type": "completed", "client_event_id": "learning-done-0002"},
    )
    assert completed.status_code == 201
    assert repeated.json()["id"] == completed.json()["id"]

    profile = client.get("/api/v1/knowledge-graph/student/me/insights", headers=headers)
    assert profile.status_code == 200, profile.text
    payload = profile.json()
    assert payload["learning_views"] == 1
    assert payload["learning_completions"] == 1
    learned = next(item for item in payload["knowledge_insights"] if item["node_id"] == node_id)
    assert learned["content_view_count"] == 1
    assert learned["content_completion_count"] == 1
