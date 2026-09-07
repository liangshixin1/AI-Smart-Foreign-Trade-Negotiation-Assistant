from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker
from test_auth import auth_header, login
from test_knowledge_graph_phase2 import _attempt_for_graph, _publish

from app.modules.assessment.models import RoundEvaluation
from app.modules.classrooms.models import Classroom
from app.modules.curriculum.models import TrainingUnit
from app.modules.knowledge_graph.learning_evidence_service import GraphLearningEvidenceService
from app.modules.training.models import Attempt, Message


def test_teacher_insights_use_round_evidence_and_return_node_labels(
    client: TestClient,
    session_factory: sessionmaker[Session],
    curriculum_enrollment: None,
    users: dict[str, object],
) -> None:
    del curriculum_enrollment
    publication = _publish(client)
    student_id = users["student"].id  # type: ignore[attr-defined]
    attempt_id, unit_id = _attempt_for_graph(
        session_factory, student_id, str(publication["graph_version"])
    )
    student_headers = auth_header(login(client, "student")["access_token"])
    scaffold = client.get(
        f"/api/v1/knowledge-graph/student/attempts/{attempt_id}/scaffolds",
        headers=student_headers,
    ).json()
    recommended_node = scaffold["knowledge_resources"][0]
    with session_factory() as db:
        message = Message(
            attempt_id=attempt_id,
            sequence_no=1,
            role="student",
            content="Please confirm a binding validity period.",
            status="completed",
            client_message_id="evidence-message-0001",
        )
        reply = Message(
            attempt_id=attempt_id,
            sequence_no=2,
            role="assistant",
            content="The offer remains valid for fifteen days.",
            status="completed",
        )
        db.add_all([message, reply])
        db.flush()
        round_evaluation = RoundEvaluation(
            attempt_id=attempt_id,
            student_message_id=message.id,
            assistant_message_id=reply.id,
            status="completed",
            score=58,
            pros="识别约束",
            cons="策略不完整",
            detailed_evaluation="已识别实盘约束，但缺少条件交换。",
            next_step_suggestion="补充条件交换策略。",
            checklist_results=[],
            provider="mock",
            model_name="mock",
            prompt_template_id="round-test",
            prompt_version="1.0",
        )
        db.add(round_evaluation)
        db.commit()
        attempt = db.get(Attempt, attempt_id)
        unit = db.get(TrainingUnit, unit_id)
        assert attempt is not None and unit is not None
        GraphLearningEvidenceService(db, client.app.state.graph_store).record(
            attempt,
            unit,
            round_evaluation.id,
            message.id,
            58,
            round_evaluation.detailed_evaluation,
            recommendations=[
                {
                    "node_id": recommended_node["id"],
                    "node_type": "knowledge_resource",
                    "confidence": 0.92,
                    "reason": "本轮应明确实盘有效期。",
                    "reveal_level": 1,
                    "application_state": "missed_required",
                    "evidence_excerpt": "",
                    "contextual_how": "用于识别并处理当前局面。",
                }
            ],
        )
        classroom = db.scalar(select(Classroom))
        assert classroom is not None
        classroom_id = classroom.id

    teacher = auth_header(login(client, "teacher")["access_token"])
    insights = client.get(
        f"/api/v1/knowledge-graph/teacher/classrooms/{classroom_id}/insights",
        headers=teacher,
    )
    assert insights.status_code == 200, insights.text
    payload = insights.json()
    assert payload["evidence_rounds"] == 1
    assert payload["students_with_evidence"] == 1
    assert payload["knowledge_insights"]
    assert payload["knowledge_insights"][0]["needs_attention"] is True
    assert payload["phenomenon_insights"][0]["label"]

    replay = client.get(f"/api/v1/teacher/attempts/{attempt_id}", headers=teacher)
    assert replay.status_code == 200, replay.text
    evidence = replay.json()["graph_learning_evidence"][0]
    assert evidence["node_labels"]
    assert evidence["node_evidence"][0]["application_state"] == "missed_required"
