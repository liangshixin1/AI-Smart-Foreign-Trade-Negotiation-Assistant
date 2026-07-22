from __future__ import annotations

import uuid
from collections.abc import Iterator

from conftest import TEST_PASSWORD
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.integrations.llm.base import (
    LLMProviderError,
    LLMRequest,
    LLMResponse,
    LLMStreamChunk,
    LLMUsage,
)
from app.integrations.llm.mock import MockLLMProvider
from app.modules.assessment.models import CompetencyEvidence, Evaluation, RoundEvaluation
from app.modules.progress.models import ProgressRecord
from app.modules.training.models import (
    Attempt,
    AttemptDraft,
    AttemptRetry,
    Message,
    ScenarioSnapshot,
    Submission,
)


class PurposeFailureProvider:
    def __init__(self, failed_purpose: str, *, invalid_json: bool = False) -> None:
        self.failed_purpose = failed_purpose
        self.invalid_json = invalid_json
        self.delegate = MockLLMProvider()

    def complete(self, request: LLMRequest) -> LLMResponse:
        if request.purpose != self.failed_purpose:
            return self.delegate.complete(request)
        if self.invalid_json:
            return LLMResponse(
                provider="test",
                model="invalid-json-model",
                content="not-json",
                finish_reason="stop",
                usage=LLMUsage(),
            )
        raise LLMProviderError("simulated_failure", "模拟 Agent 失败。", retryable=True)


class FirstEvaluationInvalidProvider:
    def __init__(self) -> None:
        self.delegate = MockLLMProvider()
        self.evaluation_calls = 0

    def complete(self, request: LLMRequest) -> LLMResponse:
        if request.purpose == "evaluation":
            self.evaluation_calls += 1
            if self.evaluation_calls == 1:
                return LLMResponse(
                    provider="test",
                    model="repair-test-model",
                    content="not-json",
                    finish_reason="stop",
                    usage=LLMUsage(),
                )
        return self.delegate.complete(request)


class CapturingAdaptiveProvider(MockLLMProvider):
    def __init__(self) -> None:
        self.conversation_requests: list[LLMRequest] = []

    def stream(self, request: LLMRequest) -> Iterator[LLMStreamChunk]:
        if request.purpose == "conversation":
            self.conversation_requests.append(request)
        yield from super().stream(request)


def student_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "student@example.test", "password": TEST_PASSWORD},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_mock_provider_completes_traceable_training_loop(
    client: TestClient,
    curriculum_enrollment: None,
    session_factory: sessionmaker[Session],
) -> None:
    del curriculum_enrollment
    headers = student_headers(client)
    created = client.post(
        "/api/v1/attempts",
        headers=headers,
        json={"unit_id": "chapter-0-section-1", "difficulty": "standard"},
    )
    assert created.status_code == 201, created.text
    attempt = created.json()
    assert attempt["status"] == "in_progress"
    assert attempt["scenario"]["scenario_title"] == "CIF Shanghai 价格还盘"
    assert "private" not in attempt["scenario"]
    attempt_id = attempt["id"]

    client_message_id = "message-client-0001"
    replied = client.post(
        f"/api/v1/attempts/{attempt_id}/messages",
        headers=headers,
        json={
            "client_message_id": client_message_id,
            "content": "Given our order volume, could you consider USD 275 CIF Shanghai?",
        },
    )
    assert replied.status_code == 200
    assert [item["role"] for item in replied.json()["messages"]] == [
        "assistant",
        "student",
        "assistant",
    ]
    assert len(replied.json()["round_evaluations"]) == 1
    assert "learning_diagnostic" not in replied.json()["round_evaluations"][0]

    duplicate = client.post(
        f"/api/v1/attempts/{attempt_id}/messages",
        headers=headers,
        json={
            "client_message_id": client_message_id,
            "content": "Given our order volume, could you consider USD 275 CIF Shanghai?",
        },
    )
    assert duplicate.status_code == 200
    assert len(duplicate.json()["messages"]) == 3

    submit_headers = {**headers, "Idempotency-Key": "submit-attempt-0001"}
    completed = client.post(f"/api/v1/attempts/{attempt_id}/submit", headers=submit_headers)
    assert completed.status_code == 200
    body = completed.json()
    assert body["status"] == "completed"
    assert body["evaluation"]["overall_score"] == 72
    assert len(body["evaluation"]["dimensions"]) == 5
    assert "learning_diagnostic" not in body["evaluation"]
    assert (
        body["evaluation"]["dimensions"][0]["evidence"][0]["quote"]
        in (body["messages"][1]["content"])
    )

    repeated_submit = client.post(f"/api/v1/attempts/{attempt_id}/submit", headers=submit_headers)
    assert repeated_submit.status_code == 200
    assert repeated_submit.json()["evaluation"]["id"] == body["evaluation"]["id"]

    progress = client.get("/api/v1/me/progress", headers=headers)
    assert progress.status_code == 200
    assert progress.json()["completed_units"] == 1
    assert progress.json()["items"][0]["unit_id"] == "chapter-0-section-1"

    teacher_login = client.post(
        "/api/v1/auth/login",
        json={"identifier": "teacher@example.test", "password": TEST_PASSWORD},
    )
    teacher_headers = {"Authorization": f"Bearer {teacher_login.json()['access_token']}"}
    replay = client.get(f"/api/v1/teacher/attempts/{attempt_id}", headers=teacher_headers)
    assert replay.status_code == 200
    assert replay.json()["final_learning_diagnostic"]["framework_version"] == "zpd-da-v1"
    assert len(replay.json()["final_learning_diagnostic"]["dimensions"]) == 6
    assert len(replay.json()["round_learning_diagnostics"]) == 1
    assert (
        replay.json()["round_learning_diagnostics"][0]["diagnostic"]["framework_version"]
        == "zpd-da-v1"
    )

    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(Attempt)) == 1
        assert db.scalar(select(func.count()).select_from(ScenarioSnapshot)) == 1
        assert db.scalar(select(func.count()).select_from(Message)) == 3
        assert db.scalar(select(func.count()).select_from(Submission)) == 1
        assert db.scalar(select(func.count()).select_from(Evaluation)) == 1
        assert db.scalar(select(func.count()).select_from(RoundEvaluation)) == 1
        assert db.scalar(select(func.count()).select_from(CompetencyEvidence)) == 5
        assert db.scalar(select(func.count()).select_from(ProgressRecord)) == 1


def test_teacher_cannot_create_student_attempt(
    client: TestClient, curriculum_enrollment: None
) -> None:
    del curriculum_enrollment
    login = client.post(
        "/api/v1/auth/login",
        json={"identifier": "teacher@example.test", "password": TEST_PASSWORD},
    )
    response = client.post(
        "/api/v1/attempts",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
        json={"unit_id": "chapter-0-section-1", "difficulty": "standard"},
    )
    assert response.status_code == 403


def test_streaming_message_triggers_structured_round_evaluation(
    client: TestClient,
    curriculum_enrollment: None,
    session_factory: sessionmaker[Session],
) -> None:
    del curriculum_enrollment
    headers = student_headers(client)
    created = client.post(
        "/api/v1/attempts",
        headers=headers,
        json={"unit_id": "chapter-0-section-1", "difficulty": "standard"},
    ).json()
    with client.stream(
        "POST",
        f"/api/v1/attempts/{created['id']}/messages/stream",
        headers=headers,
        json={
            "client_message_id": "message-stream-0001",
            "content": "Could you offer USD 278 if we increase the order?",
        },
    ) as response:
        body = "".join(response.iter_text())
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: message.started" in body
    assert "event: message.delta" in body
    assert "event: message.completed" in body
    assert "event: round_evaluation.started" in body
    assert "event: round_evaluation.completed" in body
    assert '"score": 74.0' in body
    assert '"pros": "还盘理由明确，并保持了合作语气。"' in body
    assert '"satisfied": true' in body
    assert "learning_diagnostic" not in body
    assert "event: stream.closed" in body

    attempt = client.get(f"/api/v1/attempts/{created['id']}", headers=headers).json()
    assert attempt["round_evaluations"][0]["score"] == 74
    assert attempt["round_evaluations"][0]["next_step_suggestion"]
    assert "learning_diagnostic" not in attempt["round_evaluations"][0]
    assert attempt["round_evaluations"][0]["checklist_results"] == [
        {
            "item": "引用数量或市场依据",
            "satisfied": True,
            "rationale": "本轮已经给出数量条件作为谈判依据。",
        },
        {
            "item": "确认价格和付款条件",
            "satisfied": False,
            "rationale": "目前尚未同时确认价格和付款条件。",
        },
    ]
    with session_factory() as db:
        evaluation = db.scalar(select(RoundEvaluation))
        assert evaluation is not None
        assert evaluation.learning_diagnostic["learner_stage"] == "developing"

    teacher_login = client.post(
        "/api/v1/auth/login",
        json={"identifier": "teacher@example.test", "password": TEST_PASSWORD},
    )
    replay = client.get(
        f"/api/v1/teacher/attempts/{created['id']}",
        headers={"Authorization": f"Bearer {teacher_login.json()['access_token']}"},
    )
    assert replay.status_code == 200
    assert replay.json()["round_learning_diagnostics"][0]["diagnostic"]["challenge_level"] == 2


def test_next_streaming_round_receives_previous_zpd_diagnostic(
    client: TestClient, curriculum_enrollment: None
) -> None:
    del curriculum_enrollment
    provider = CapturingAdaptiveProvider()
    client.app.state.llm_provider = provider
    headers = student_headers(client)
    created = client.post(
        "/api/v1/attempts",
        headers=headers,
        json={"unit_id": "chapter-0-section-1", "difficulty": "standard"},
    ).json()
    for index, content in enumerate(
        [
            "Could you offer USD 278 if we increase the order?",
            "We can increase the order to 1,000 units for a better CIF price.",
        ],
        start=1,
    ):
        with client.stream(
            "POST",
            f"/api/v1/attempts/{created['id']}/messages/stream",
            headers=headers,
            json={"client_message_id": f"adaptive-message-{index:04d}", "content": content},
        ) as response:
            assert response.status_code == 200
            _ = "".join(response.iter_text())

    assert len(provider.conversation_requests) == 2
    first_adaptation = provider.conversation_requests[0].messages[-1].content
    second_adaptation = provider.conversation_requests[1].messages[-1].content
    assert '"confidence": 0.2' in first_adaptation
    assert "独立把数量、价格和付款方式组成可执行的交换方案" in second_adaptation
    assert provider.conversation_requests[1].metadata["adaptive_prompt_version"] == "1.0.0"


def test_scenario_failure_enters_explicit_failed_state(
    client: TestClient,
    curriculum_enrollment: None,
    session_factory: sessionmaker[Session],
) -> None:
    del curriculum_enrollment
    client.app.state.llm_provider = PurposeFailureProvider("scenario")
    response = client.post(
        "/api/v1/attempts",
        headers=student_headers(client),
        json={"unit_id": "chapter-0-section-1", "difficulty": "standard"},
    )
    assert response.status_code == 502
    with session_factory() as db:
        attempt = db.scalar(select(Attempt))
        assert attempt is not None and attempt.status == "generation_failed"
        assert db.scalar(select(func.count()).select_from(ScenarioSnapshot)) == 0


def test_conversation_failure_preserves_student_message(
    client: TestClient,
    curriculum_enrollment: None,
    session_factory: sessionmaker[Session],
) -> None:
    del curriculum_enrollment
    headers = student_headers(client)
    created = client.post(
        "/api/v1/attempts",
        headers=headers,
        json={"unit_id": "chapter-0-section-1", "difficulty": "standard"},
    ).json()
    client.app.state.llm_provider = PurposeFailureProvider("conversation")
    response = client.post(
        f"/api/v1/attempts/{created['id']}/messages",
        headers=headers,
        json={"client_message_id": "message-failure-0001", "content": "Please reconsider."},
    )
    assert response.status_code == 502
    with session_factory() as db:
        messages = list(db.scalars(select(Message).order_by(Message.sequence_no)))
        assert [item.role for item in messages] == ["assistant", "student", "assistant"]
        assert messages[1].content == "Please reconsider."
        assert messages[2].status == "failed"


def test_invalid_evaluation_can_be_retried_without_resubmitting(
    client: TestClient,
    curriculum_enrollment: None,
    session_factory: sessionmaker[Session],
) -> None:
    del curriculum_enrollment
    headers = student_headers(client)
    created = client.post(
        "/api/v1/attempts",
        headers=headers,
        json={"unit_id": "chapter-0-section-1", "difficulty": "standard"},
    ).json()
    client.post(
        f"/api/v1/attempts/{created['id']}/messages",
        headers=headers,
        json={"client_message_id": "message-eval-0001", "content": "Could you offer USD 278?"},
    )
    client.app.state.llm_provider = PurposeFailureProvider("evaluation", invalid_json=True)
    failed = client.post(
        f"/api/v1/attempts/{created['id']}/submit",
        headers={**headers, "Idempotency-Key": "submit-invalid-eval-0001"},
    )
    assert failed.status_code == 502
    with session_factory() as db:
        attempt = db.get(Attempt, uuid.UUID(created["id"]))
        assert attempt is not None and attempt.status == "evaluation_failed"
        assert db.scalar(select(func.count()).select_from(Submission)) == 1
        assert db.scalar(select(func.count()).select_from(ProgressRecord)) == 0

    client.app.state.llm_provider = MockLLMProvider()
    retried = client.post(f"/api/v1/attempts/{created['id']}/evaluation/retry", headers=headers)
    assert retried.status_code == 200
    assert retried.json()["status"] == "completed"


def test_evaluation_repairs_one_invalid_structured_response(
    client: TestClient, curriculum_enrollment: None
) -> None:
    del curriculum_enrollment
    headers = student_headers(client)
    created = client.post(
        "/api/v1/attempts",
        headers=headers,
        json={"unit_id": "chapter-0-section-1", "difficulty": "standard"},
    ).json()
    client.post(
        f"/api/v1/attempts/{created['id']}/messages",
        headers=headers,
        json={"client_message_id": "message-repair-0001", "content": "Please send the catalog."},
    )
    provider = FirstEvaluationInvalidProvider()
    client.app.state.llm_provider = provider
    response = client.post(
        f"/api/v1/attempts/{created['id']}/submit",
        headers={**headers, "Idempotency-Key": "submit-repair-eval-0001"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "completed"
    assert provider.evaluation_calls == 2


def test_draft_is_saved_restored_and_frozen_after_submission(
    client: TestClient, curriculum_enrollment: None, session_factory: sessionmaker[Session]
) -> None:
    del curriculum_enrollment
    headers = student_headers(client)
    created = client.post(
        "/api/v1/attempts",
        headers=headers,
        json={"unit_id": "chapter-0-section-1", "difficulty": "standard"},
    ).json()
    saved = client.put(
        f"/api/v1/attempts/{created['id']}/draft",
        headers=headers,
        json={"content": "Dear Mr. Lim, please share your latest catalog."},
    )
    assert saved.status_code == 200
    assert saved.json()["draft_content"].startswith("Dear Mr. Lim")
    restored = client.get(f"/api/v1/attempts/{created['id']}", headers=headers)
    assert restored.json()["draft_content"] == saved.json()["draft_content"]
    client.post(
        f"/api/v1/attempts/{created['id']}/messages",
        headers=headers,
        json={"client_message_id": "message-draft-0001", "content": "Please send the catalog."},
    )
    client.post(
        f"/api/v1/attempts/{created['id']}/submit",
        headers={**headers, "Idempotency-Key": "submit-draft-0001"},
    )
    frozen = client.put(
        f"/api/v1/attempts/{created['id']}/draft",
        headers=headers,
        json={"content": "changed"},
    )
    assert frozen.status_code == 409
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(AttemptDraft)) == 1


def test_completed_attempt_retry_is_idempotent_and_visible_in_history(
    client: TestClient, curriculum_enrollment: None, session_factory: sessionmaker[Session]
) -> None:
    del curriculum_enrollment
    headers = student_headers(client)
    created = client.post(
        "/api/v1/attempts",
        headers=headers,
        json={"unit_id": "chapter-0-section-1", "difficulty": "standard"},
    ).json()
    client.post(
        f"/api/v1/attempts/{created['id']}/messages",
        headers=headers,
        json={"client_message_id": "message-retry-0001", "content": "Please send the catalog."},
    )
    client.post(
        f"/api/v1/attempts/{created['id']}/submit",
        headers={**headers, "Idempotency-Key": "submit-retry-0001"},
    )
    retry_headers = {**headers, "Idempotency-Key": "retry-attempt-0001"}
    first = client.post(f"/api/v1/attempts/{created['id']}/retry", headers=retry_headers)
    second = client.post(f"/api/v1/attempts/{created['id']}/retry", headers=retry_headers)
    assert first.status_code == 201
    assert first.json()["retry_of_attempt_id"] == created["id"]
    assert second.json()["id"] == first.json()["id"]
    history = client.get("/api/v1/attempts", headers=headers)
    assert history.status_code == 200
    assert {item["id"] for item in history.json()} == {created["id"], first.json()["id"]}
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(Attempt)) == 2
        assert db.scalar(select(func.count()).select_from(AttemptRetry)) == 1
