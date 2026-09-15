# [导读] 业务名词: 仿真用逐段台词和角色演出呈现训练; 态势是按原话证据计算的状态, 不等同正式成绩
# [导读] 。
# [导读] 用途: 回归验证仿真台词、生成租约、态势规则和失败恢复。
# [导读] 为什么: 用可重复输入固定业务边界, 既检查成功结果, 也防止重试、权限或无效输入破坏已有行
# [导读] 为。
# [导读] 结构: 本文件有 10 个测试函数; 按各用例的准备、操作、断言顺序阅读, 公共夹具见
# [导读] tests/conftest.py。
# [导读] 提醒: 测试中的用户、令牌、案例和模型输出是测试数据; 通过这些用例不等于已验证真实外部模
# [导读] 型或线上环境。
from __future__ import annotations

import json
import uuid
from collections.abc import Iterator

from conftest import TEST_PASSWORD
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.integrations.llm.base import (
    LLMMessage,
    LLMRequest,
    LLMResponse,
    LLMStreamChunk,
)
from app.integrations.llm.mock import MockLLMProvider
from app.modules.assessment.models import RoundEvaluation
from app.modules.assessment.round_payload_repair import salvage_simulation_round
from app.modules.curriculum.models import TrainingUnit
from app.modules.progress.models import ProgressRecord
from app.modules.simulation.models import (
    AttemptCreationRequest,
    SimulationSession,
    SimulationStateEvent,
    SimulationStateSnapshot,
    SimulationTurnPresentation,
)
from app.modules.simulation.profile_service import load_profile
from app.modules.simulation.repository import SimulationRepository
from app.modules.simulation.schemas import SimulationObservationCandidate
from app.modules.simulation.state_rules import apply_observation, initial_state
from app.modules.simulation.validators import parse_turn_output, validate_turn
from app.modules.training.models import Attempt, Message


class RecordingMockProvider:
    def __init__(self) -> None:
        self.delegate = MockLLMProvider()
        self.requests: list[LLMRequest] = []

    def complete(self, request: LLMRequest) -> LLMResponse:
        self.requests.append(request)
        return self.delegate.complete(request)

    def stream(self, request: LLMRequest) -> Iterator[LLMStreamChunk]:
        self.requests.append(request)
        yield from self.delegate.stream(request)


class MalformedOptionalRoundProvider(RecordingMockProvider):
    def complete(self, request: LLMRequest) -> LLMResponse:
        response = super().complete(request)
        if request.metadata.get("evaluation_kind") != "round":
            return response
        payload = json.loads(response.content)
        payload["checklist_results"] = [{"item": "rewritten item", "satisfied": True}]
        payload["knowledge_recommendations"] = [{"node_id": 3}]
        payload["learning_diagnostic"] = {"learner_stage": "developing"}
        payload["simulation_observation"] = {"events": "not-a-list"}
        return response.model_copy(update={"content": json.dumps(payload)})


def _student_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "student@example.test", "password": TEST_PASSWORD},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _teacher_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "teacher@example.test", "password": TEST_PASSWORD},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _unlock_representative_unit(
    session_factory: sessionmaker[Session], student_id: uuid.UUID
) -> None:
    with session_factory() as db:
        prerequisite = db.scalar(
            select(TrainingUnit).where(TrainingUnit.unit_key == "chapter-2-section-2")
        )
        assert prerequisite is not None
        completed = Attempt(
            student_id=student_id,
            unit_id=prerequisite.id,
            course_version_id=prerequisite.chapter.course_version_id,
            status="completed",
            difficulty="standard",
            content_bindings={},
        )
        db.add(completed)
        db.flush()
        db.add(
            ProgressRecord(
                student_id=student_id,
                course_version_id=prerequisite.chapter.course_version_id,
                unit_id=prerequisite.id,
                completed_attempt_id=completed.id,
                latest_score=80,
                best_score=80,
            )
        )
        db.commit()


def _event(
    *,
    kind: str,
    target: str,
    message_id: uuid.UUID,
    quote: str,
    signature: str,
) -> dict[str, object]:
    return {
        "kind": kind,
        "target_key": target,
        "confidence": 0.9,
        "evidence": [{"message_id": str(message_id), "quote": quote}],
        "reason": "公开表达提供了可验证依据。",
        "normalized_fact_signature": signature,
    }


def test_state_rules_are_evidence_bound_deduplicated_and_capped() -> None:
    profile = load_profile()
    student_id = uuid.uuid4()
    assistant_id = uuid.uuid4()
    round_id = uuid.uuid4()
    messages = {
        student_id: ("student", "We can confirm 1,000 units and accept USD 278."),
        assistant_id: ("assistant", "We agree and confirm USD 278 for 1,000 units."),
    }
    observation = SimulationObservationCandidate.model_validate(
        {
            "events": [
                _event(
                    kind="evidence_backed_proposal",
                    target="unit_price",
                    message_id=student_id,
                    quote="confirm 1,000 units",
                    signature=f"proposal-{index}",
                )
                for index in range(6)
            ],
            "term_candidates": [
                {
                    "key": "unit_price",
                    "status": "confirmed",
                    "normalized_value": "USD 278",
                    "conditions": ["1,000 units"],
                    "proposed_by": "student",
                    "supporting_message_ids": [str(student_id), str(assistant_id)],
                    "accepted_by": ["student", "assistant"],
                    "acceptance_evidence": [
                        {
                            "message_id": str(student_id),
                            "quote": "confirm 1,000 units and accept USD 278",
                        },
                        {
                            "message_id": str(assistant_id),
                            "quote": "agree and confirm USD 278 for 1,000 units",
                        },
                    ],
                }
            ],
            "milestone_candidates": [
                {
                    "key": "reasoned_counteroffer",
                    "message_ids": [str(student_id)],
                    "reason": "学生原话包含数量依据。",
                }
            ],
        }
    )
    computed = apply_observation(
        initial_state(profile), observation, profile, messages, set(), round_id
    )
    assert computed.state.trust.delta == 8
    assert computed.state.willingness.delta == 8
    assert computed.state.alignment.confirmed == 1
    assert computed.state.milestones[0].status == "evidenced"

    repeated = apply_observation(
        computed.state,
        observation,
        profile,
        messages,
        {item.dedupe_key for item in computed.accepted},
        uuid.uuid4(),
    )
    assert repeated.state.trust.delta == 0
    assert repeated.state.willingness.delta == 0
    assert {reason for _, reason in repeated.rejected} == {"duplicate_event"}


def test_conditional_or_one_sided_acceptance_does_not_confirm_a_term() -> None:
    profile = load_profile()
    student_id = uuid.uuid4()
    assistant_id = uuid.uuid4()
    observation = SimulationObservationCandidate.model_validate(
        {
            "term_candidates": [
                {
                    "key": "unit_price",
                    "status": "confirmed",
                    "normalized_value": "USD 278",
                    "conditions": [],
                    "proposed_by": "student",
                    "supporting_message_ids": [str(student_id), str(assistant_id)],
                    "accepted_by": ["student", "assistant"],
                    "acceptance_evidence": [
                        {"message_id": str(student_id), "quote": "I accept USD 278."},
                        {
                            "message_id": str(assistant_id),
                            "quote": "We could accept USD 278 if volume increases.",
                        },
                    ],
                }
            ]
        }
    )
    result = apply_observation(
        initial_state(profile),
        observation,
        profile,
        {
            student_id: ("student", "I accept USD 278."),
            assistant_id: (
                "assistant",
                "We could accept USD 278 if volume increases.",
            ),
        },
        set(),
        uuid.uuid4(),
    )
    assert result.state.term_ledger[0]["status"] == "discussing"
    assert result.state.alignment.value == 0


def test_changed_exchange_condition_reopens_a_confirmed_dependent_term() -> None:
    profile = load_profile()
    student_id = uuid.uuid4()
    previous = initial_state(profile)
    previous.term_ledger[0] = {
        "key": "unit_price",
        "version": 1,
        "status": "confirmed",
        "normalized_value": "USD 283",
        "conditions": ["1,000 units"],
    }
    observation = SimulationObservationCandidate.model_validate(
        {
            "term_candidates": [
                {
                    "key": "quantity_exchange",
                    "status": "proposed",
                    "normalized_value": "1,200 units",
                    "conditions": [],
                    "proposed_by": "student",
                    "supporting_message_ids": [str(student_id)],
                }
            ]
        }
    )
    result = apply_observation(
        previous,
        observation,
        profile,
        {student_id: ("student", "We can increase the order to 1,200 units.")},
        set(),
        uuid.uuid4(),
    )
    assert result.state.term_ledger[0]["status"] == "reopened"
    assert result.state.alignment.value == 0


def test_short_turn_contract_sanitizes_animation_but_rejects_content_violations() -> None:
    sanitized = parse_turn_output(
        json.dumps(
            {
                "schema_version": "simulation.turn.v1",
                "beats": [
                    {
                        "id": "one",
                        "speaker_id": "david-lim",
                        "text": "Please quantify the volume you can confirm.",
                        "expression": "../../portrait.png",
                        "action": "run-script",
                    }
                ],
            }
        )
    )
    assert sanitized.beats[0].expression == "neutral"
    assert sanitized.beats[0].action == "none"

    for unsafe_text in (
        "Dear Mr. Chen, our offer stands. Yours sincerely, David Lim.",
        "Our manufacturing cost is USD 275.",
        "We agree to USD 278 for this order.",
        "We can discuss the NT-OM320 instead.",
        (
            "This beat contains far too many words and therefore cannot be accepted as a "
            "single concise speech beat for the simulation dialogue contract under current rules."
        ),
    ):
        candidate = parse_turn_output(
            json.dumps(
                {
                    "schema_version": "simulation.turn.v1",
                    "beats": [
                        {
                            "id": "unsafe",
                            "speaker_id": "david-lim",
                            "text": unsafe_text,
                            "expression": "neutral",
                            "action": "none",
                        }
                    ],
                }
            )
        )
        try:
            validate_turn(candidate)
        except ValueError:
            pass
        else:
            raise AssertionError(f"Unsafe dialogue was accepted: {unsafe_text}")


def test_simulation_round_salvages_only_optional_invalid_extensions() -> None:
    candidate, degraded = salvage_simulation_round(
        json.dumps(
            {
                "score": 82,
                "pros": "The counteroffer cites a market comparison.",
                "cons": "No reciprocal condition is offered yet.",
                "detailed_evaluation": "The proposal is reasoned and professional.",
                "next_step_suggestion": "State a target price and offer a volume exchange.",
                "checklist_results": [{"item": "rewritten item", "satisfied": True}],
                "knowledge_recommendations": [{"node_id": 3}],
                "strategy_recommendations": [],
                "learning_diagnostic": {"learner_stage": "developing"},
                "simulation_observation": {"events": "not-a-list"},
            }
        ),
        {"checklist": ["exact item"]},
    )

    assert candidate.score == 82
    assert candidate.checklist_results == []
    assert candidate.knowledge_recommendations == []
    assert candidate.learning_diagnostic.confidence == 0.2
    assert candidate.simulation_observation is not None
    assert candidate.simulation_observation.events == []
    assert set(degraded) == {
        "checklist_results",
        "knowledge_recommendations",
        "learning_diagnostic",
        "simulation_observation",
    }


def test_simulation_round_optional_failures_do_not_block_saved_dialogue(
    client: TestClient,
    curriculum_enrollment: None,
    session_factory: sessionmaker[Session],
    users: dict[str, object],
) -> None:
    del curriculum_enrollment
    student = users["student"]
    _unlock_representative_unit(session_factory, student.id)  # type: ignore[attr-defined]
    client.app.state.settings.simulation_enabled = True
    client.app.state.llm_provider = MalformedOptionalRoundProvider()
    headers = _student_headers(client)
    created = client.post(
        "/api/v1/attempts",
        headers={**headers, "Idempotency-Key": "simulation-degraded-round"},
        json={
            "unit_id": "chapter-3-section-1",
            "difficulty": "standard",
            "experience_mode": "simulation",
        },
    )
    assert created.status_code == 201
    attempt_id = created.json()["id"]

    with client.stream(
        "POST",
        f"/api/v1/attempts/{attempt_id}/messages/stream",
        headers=headers,
        json={
            "client_message_id": "simulation-degraded-round-message",
            "content": "Market comparisons support USD 278 for a larger order.",
        },
    ) as response:
        stream_body = "".join(response.iter_text())

    assert response.status_code == 200
    assert "event: simulation.turn.ready" in stream_body
    assert "event: simulation.state.updated" in stream_body
    recovered = client.get(f"/api/v1/attempts/{attempt_id}/simulation", headers=headers)
    assert recovered.json()["latest_state"]["analysis_status"] == "ready"
    assert recovered.json()["latest_state"]["revision"] == 1
    with session_factory() as db:
        stored = db.scalar(
            select(RoundEvaluation).where(RoundEvaluation.attempt_id == uuid.UUID(attempt_id))
        )
        assert stored is not None
        assert stored.learning_diagnostic["confidence"] == 0.2
        assert stored.simulation_observation["events"] == []


def test_same_public_history_with_different_confirmed_state_changes_behavior_fixture() -> None:
    provider = MockLLMProvider()

    def respond(trust: str, willingness: str) -> dict[str, object]:
        response = provider.complete(
            LLMRequest(
                purpose="conversation",
                prompt_template_id="simulation-conversation-counteroffer",
                prompt_version="1.0.0",
                correlation_id=str(uuid.uuid4()),
                messages=[LLMMessage(role="system", content="same public history")],
                json_output=True,
                metadata={
                    "attempt_id": str(uuid.uuid4()),
                    "simulation_kind": "turn",
                    "trust_band": trust,
                    "willingness_band": willingness,
                },
            )
        )
        return json.loads(response.content)  # type: ignore[no-any-return]

    cautious = respond("cautious", "cautious")
    positive = respond("positive", "positive")
    assert cautious != positive
    assert "explain the commercial basis" in cautious["beats"][0]["text"]  # type: ignore[index]
    assert "remaining payment term" in positive["beats"][0]["text"]  # type: ignore[index]


def test_feature_flag_defaults_off_and_unit_capability_is_server_driven(
    client: TestClient,
    curriculum_enrollment: None,
) -> None:
    del curriculum_enrollment
    assert Settings(_env_file=None).simulation_enabled is False
    client.app.state.settings.simulation_enabled = False
    headers = _student_headers(client)
    unit = client.get("/api/v1/units/chapter-3-section-1", headers=headers)
    assert unit.status_code == 200
    assert unit.json()["supported_experience_modes"] == ["chat"]
    rejected = client.post(
        "/api/v1/attempts",
        headers={**headers, "Idempotency-Key": "simulation-disabled"},
        json={
            "unit_id": "chapter-3-section-1",
            "difficulty": "standard",
            "experience_mode": "simulation",
        },
    )
    assert rejected.status_code == 422
    assert rejected.json()["error"]["code"] == "simulation.not_available"


def test_enabled_flag_does_not_enable_unlisted_units(
    client: TestClient,
    curriculum_enrollment: None,
) -> None:
    del curriculum_enrollment
    client.app.state.settings.simulation_enabled = True
    headers = _student_headers(client)
    unit = client.get("/api/v1/units/chapter-0-section-1", headers=headers)
    assert unit.json()["supported_experience_modes"] == ["chat"]
    rejected = client.post(
        "/api/v1/attempts",
        headers={**headers, "Idempotency-Key": "unsupported-simulation"},
        json={
            "unit_id": "chapter-0-section-1",
            "difficulty": "standard",
            "experience_mode": "simulation",
        },
    )
    assert rejected.status_code == 422
    assert rejected.json()["error"]["code"] == "simulation.not_available"


def test_simulation_mock_loop_is_idempotent_recoverable_and_teacher_visible(
    client: TestClient,
    curriculum_enrollment: None,
    session_factory: sessionmaker[Session],
    users: dict[str, object],
) -> None:
    del curriculum_enrollment
    provider = RecordingMockProvider()
    client.app.state.llm_provider = provider
    student = users["student"]
    _unlock_representative_unit(session_factory, student.id)  # type: ignore[attr-defined]
    client.app.state.settings.simulation_enabled = True
    headers = _student_headers(client)

    unit = client.get("/api/v1/units/chapter-3-section-1", headers=headers)
    assert unit.json()["supported_experience_modes"] == ["chat", "simulation"]
    payload = {
        "unit_id": "chapter-3-section-1",
        "difficulty": "standard",
        "experience_mode": "simulation",
    }
    missing_key = client.post("/api/v1/attempts", headers=headers, json=payload)
    assert missing_key.status_code == 422
    create_headers = {**headers, "Idempotency-Key": "create-simulation-0001"}
    created = client.post("/api/v1/attempts", headers=create_headers, json=payload)
    assert created.status_code == 201, created.text
    attempt = created.json()
    attempt_id = attempt["id"]
    assert attempt["experience_mode"] == "simulation"
    assert attempt["conversation_revision"] == 1
    assert attempt["simulation_summary"]["state_revision"] == 0
    assert len(attempt["messages"]) == 1

    repeated = client.post("/api/v1/attempts", headers=create_headers, json=payload)
    assert repeated.status_code == 201
    assert repeated.json()["id"] == attempt_id
    conflict = client.post(
        "/api/v1/attempts",
        headers=create_headers,
        json={**payload, "difficulty": "challenge"},
    )
    assert conflict.status_code == 409

    session = client.get(f"/api/v1/attempts/{attempt_id}/simulation", headers=headers)
    assert session.status_code == 200, session.text
    body = session.json()
    assert len(body["briefing"]) == 5
    assert len(body["turns"]) == 1
    assert body["turns"][0]["canonical_content"] == attempt["messages"][0]["content"]
    assert body["latest_state"]["trust"]["value"] == 50
    assert "bottom_line" not in json.dumps(body)

    message_payload = {
        "client_message_id": "simulation-message-0001",
        "content": "Given our order volume, we propose USD 278 CIF Shanghai.",
    }
    with client.stream(
        "POST",
        f"/api/v1/attempts/{attempt_id}/messages/stream",
        headers=headers,
        json=message_payload,
    ) as response:
        stream_body = "".join(response.iter_text())
    assert response.status_code == 200
    assert "event: simulation.turn.ready" in stream_body
    assert "event: message.delta" not in stream_body
    assert "event: simulation.state.updated" in stream_body
    assert "event: stream.closed" in stream_body
    turn_request = next(
        request
        for request in provider.requests
        if request.metadata.get("simulation_kind") == "turn"
    )
    turn_prompt = "\n".join(message.content for message in turn_request.messages)
    assert '"schema_version":"simulation.turn.v1"' in turn_prompt
    assert "Yours sincerely" not in turn_prompt
    assert turn_request.max_output_tokens == 512
    round_request = next(
        request
        for request in provider.requests
        if request.metadata.get("evaluation_kind") == "round"
    )
    round_prompt = "\n".join(message.content for message in round_request.messages)
    assert "simulation_observation 严格匹配" in round_prompt
    assert "函电规范性" not in round_prompt

    recovered = client.get(f"/api/v1/attempts/{attempt_id}/simulation", headers=headers)
    recovered_body = recovered.json()
    assert len(recovered_body["turns"]) == 2
    assert recovered_body["latest_state"]["revision"] == 1
    assert recovered_body["latest_state"]["trust"]["value"] == 52
    assert recovered_body["latest_state"]["willingness"]["value"] == 52
    assert recovered_body["latest_state"]["milestones"][0]["status"] == "evidenced"
    assert len(recovered_body["state_history"]) == 2
    assert (
        recovered_body["latest_state"]["public_changes"][0]["evidence"][0]["quote"]
        == message_payload["content"]
    )

    replayed = client.post(
        f"/api/v1/attempts/{attempt_id}/messages",
        headers=headers,
        json=message_payload,
    )
    assert replayed.status_code == 200
    assert len(replayed.json()["messages"]) == 3
    conflicting_message = client.post(
        f"/api/v1/attempts/{attempt_id}/messages",
        headers=headers,
        json={**message_payload, "content": "A different message."},
    )
    assert conflicting_message.status_code == 409

    with session_factory() as db:
        repository = SimulationRepository(db)
        assert repository.claim_generation(uuid.UUID(attempt_id), "tab-a")
        assert not repository.claim_generation(uuid.UUID(attempt_id), "tab-a")
        assert not repository.claim_generation(uuid.UUID(attempt_id), "tab-b")
    blocked_submit = client.post(
        f"/api/v1/attempts/{attempt_id}/submit",
        headers={**headers, "Idempotency-Key": "submit-while-generating"},
    )
    assert blocked_submit.status_code == 409
    assert blocked_submit.json()["error"]["code"] == "simulation.generation_in_progress"
    with session_factory() as db:
        SimulationRepository(db).release_generation(uuid.UUID(attempt_id), "tab-a")

    completed = client.post(
        f"/api/v1/attempts/{attempt_id}/submit",
        headers={**headers, "Idempotency-Key": "submit-simulation-0001"},
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"
    assert completed.json()["evaluation"]["prompt_version"] == "1.0.0"

    teacher = client.get(f"/api/v1/teacher/attempts/{attempt_id}", headers=_teacher_headers(client))
    assert teacher.status_code == 200, teacher.text
    replay = teacher.json()
    assert replay["attempt"]["experience_mode"] == "simulation"
    assert len(replay["simulation"]["turns"]) == 2
    assert len(replay["simulation"]["state_history"]) == 2
    assert (
        replay["simulation"]["state_history"][1]["public_changes"][0]["evidence"][0]["quote"]
        == message_payload["content"]
    )
    assert replay["frozen_submission"]["simulation"]["state_revision"] == 1
    assert replay["content_bindings"]["simulation_profile_version"] == "1.0.0"

    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(AttemptCreationRequest)) == 1
        assert db.scalar(select(func.count()).select_from(SimulationSession)) == 1
        assert db.scalar(select(func.count()).select_from(SimulationTurnPresentation)) == 2
        assert db.scalar(select(func.count()).select_from(SimulationStateSnapshot)) == 2
        assert db.scalar(select(func.count()).select_from(SimulationStateEvent)) == 1
        messages = list(
            db.scalars(select(Message).where(Message.attempt_id == uuid.UUID(attempt_id)))
        )
        assert len(messages) == 3
