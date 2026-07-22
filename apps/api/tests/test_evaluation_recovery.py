from __future__ import annotations

import json

from conftest import TEST_PASSWORD
from fastapi.testclient import TestClient

from app.integrations.llm.base import LLMRequest, LLMResponse
from app.integrations.llm.mock import MockLLMProvider


class MissingFinalDiagnosticProvider:
    """模拟 DeepSeek 正式评价遗漏 learning_diagnostic 的真实回归场景。"""

    def __init__(self) -> None:
        self.delegate = MockLLMProvider()
        self.evaluation_calls = 0

    def complete(self, request: LLMRequest) -> LLMResponse:
        response = self.delegate.complete(request)
        if request.purpose != "evaluation" or request.metadata.get("evaluation_kind") == "round":
            return response
        self.evaluation_calls += 1
        payload = json.loads(response.content)
        payload.pop("learning_diagnostic", None)
        return LLMResponse(
            provider=response.provider,
            model=response.model,
            content=json.dumps(payload, ensure_ascii=False),
            finish_reason=response.finish_reason,
            usage=response.usage,
        )


def _student_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "student@example.test", "password": TEST_PASSWORD},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_missing_final_diagnostic_does_not_block_formal_evaluation(
    client: TestClient, curriculum_enrollment: None
) -> None:
    del curriculum_enrollment
    headers = _student_headers(client)
    created = client.post(
        "/api/v1/attempts",
        headers=headers,
        json={"unit_id": "chapter-0-section-1", "difficulty": "standard"},
    ).json()
    message = client.post(
        f"/api/v1/attempts/{created['id']}/messages",
        headers=headers,
        json={
            "client_message_id": "message-missing-diagnostic-0001",
            "content": "Could you offer USD 278 if we increase the order?",
        },
    )
    assert message.status_code == 200
    provider = MissingFinalDiagnosticProvider()
    client.app.state.llm_provider = provider
    completed = client.post(
        f"/api/v1/attempts/{created['id']}/submit",
        headers={**headers, "Idempotency-Key": "submit-missing-diagnostic-0001"},
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"
    assert provider.evaluation_calls == 2

    teacher_login = client.post(
        "/api/v1/auth/login",
        json={"identifier": "teacher@example.test", "password": TEST_PASSWORD},
    )
    replay = client.get(
        f"/api/v1/teacher/attempts/{created['id']}",
        headers={"Authorization": f"Bearer {teacher_login.json()['access_token']}"},
    )
    assert replay.status_code == 200
    diagnostic = replay.json()["final_learning_diagnostic"]
    assert diagnostic["framework_version"] == "zpd-da-v1"
    assert len(diagnostic["dimensions"]) == 6
    assert "逐轮动态诊断聚合" in diagnostic["adaptability_summary"]
