from __future__ import annotations

import argparse
import json
import uuid

import httpx
from app.core.config import Settings
from app.db.session import build_engine, build_session_factory
from app.modules.training.models import LLMInvocation
from sqlalchemy import select


def require_success(response: httpx.Response, step: str) -> dict[str, object]:
    if response.status_code >= 400:
        raise RuntimeError(
            f"{step} failed with HTTP {response.status_code}: {response.text[:300]}"
        )
    payload = response.json()
    if not isinstance(payload, dict):
        raise TypeError(f"{step} returned a non-object response")
    return payload


def auth(client: httpx.Client, identifier: str, password: str) -> dict[str, str]:
    payload = require_success(
        client.post(
            "/api/v1/auth/login",
            json={"identifier": identifier, "password": password},
        ),
        f"login {identifier}",
    )
    token = payload.get("access_token")
    if not isinstance(token, str):
        raise TypeError("Login response did not contain an access token")
    return {"Authorization": f"Bearer {token}"}


def test_target(course_map: dict[str, object]) -> tuple[str, str | None]:
    chapters = course_map.get("chapters")
    if not isinstance(chapters, list):
        raise TypeError("Course map did not contain chapters")
    completed_unit_id: str | None = None
    for chapter in chapters:
        if not isinstance(chapter, dict) or not isinstance(chapter.get("units"), list):
            continue
        for unit in chapter["units"]:
            if not isinstance(unit, dict):
                continue
            unit_id = unit.get("id")
            active_id = unit.get("active_attempt_id")
            if unit.get("status") == "evaluation_failed" and isinstance(unit_id, str):
                return unit_id, str(active_id)
            if unit.get("status") == "available" and isinstance(unit_id, str):
                return unit_id, None
            # 冒烟测试必须可重复运行。已有完成记录时，新建同关 Attempt 仍能
            # 验证本次场景是否绑定当前知识图谱版本，不改变正式重练产品语义。
            if unit.get("status") == "completed" and isinstance(unit_id, str):
                completed_unit_id = completed_unit_id or unit_id
    if completed_unit_id is not None:
        return completed_unit_id, None
    raise RuntimeError("No available unit found for smoke test")


def stream_round(
    client: httpx.Client, headers: dict[str, str], attempt_id: str
) -> list[str]:
    events: list[str] = []
    with client.stream(
        "POST",
        f"/api/v1/attempts/{attempt_id}/messages/stream",
        headers=headers,
        json={
            "client_message_id": f"smoke-message-{uuid.uuid4()}",
            "content": (
                "Dear Mr. Lim, we are interested in your NT-IM250 series. "
                "Please send us your latest catalog, specifications, price list, "
                "minimum order quantity and standard delivery terms. Yours sincerely, Chen Yifan"
            ),
        },
    ) as response:
        if response.status_code >= 400:
            raise RuntimeError(f"stream failed with HTTP {response.status_code}")
        for line in response.iter_lines():
            if line.startswith("event:"):
                events.append(line.removeprefix("event:").strip())
    required = {
        "message.started",
        "message.delta",
        "message.completed",
        "round_evaluation.started",
        "round_evaluation.completed",
        "stream.closed",
    }
    missing = required - set(events)
    if missing:
        raise RuntimeError(
            f"Stream did not complete required events: {sorted(missing)}"
        )
    return events


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run a real three-Agent DeepSeek smoke test"
    )
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    settings = Settings()
    if settings.llm_provider != "deepseek" or settings.dev_seed_password is None:
        raise RuntimeError("Smoke test requires DeepSeek mode and DEV_SEED_PASSWORD")
    with httpx.Client(base_url=args.base_url, timeout=180, trust_env=False) as client:
        student_headers = auth(
            client, "student@example.test", settings.dev_seed_password
        )
        course_map = require_success(
            client.get("/api/v1/courses/current/map", headers=student_headers),
            "course map",
        )
        unit_id, failed_attempt_id = test_target(course_map)
        if failed_attempt_id:
            attempt_id = failed_attempt_id
            events: list[str] = []
            completed = require_success(
                client.post(
                    f"/api/v1/attempts/{attempt_id}/evaluation/retry",
                    headers=student_headers,
                ),
                "formal evaluation retry",
            )
        else:
            attempt = require_success(
                client.post(
                    "/api/v1/attempts",
                    headers=student_headers,
                    json={"unit_id": unit_id, "difficulty": "standard"},
                ),
                "scenario generation",
            )
            attempt_id = str(attempt["id"])
            events = stream_round(client, student_headers, attempt_id)
            completed = require_success(
                client.post(
                    f"/api/v1/attempts/{attempt_id}/submit",
                    headers={
                        **student_headers,
                        "Idempotency-Key": f"smoke-submit-{uuid.uuid4()}",
                    },
                ),
                "formal evaluation",
            )
        round_evaluations = completed.get("round_evaluations", [])
        if not isinstance(round_evaluations, list) or not round_evaluations:
            raise RuntimeError("Round evaluation was not persisted")
        checklist_results = round_evaluations[-1].get("checklist_results")
        if not isinstance(checklist_results, list) or not checklist_results:
            raise RuntimeError("Round evaluation did not return checklist assessments")
        teacher_headers = auth(
            client, "teacher@example.test", settings.dev_seed_password
        )
        classrooms = client.get(
            "/api/v1/teacher/classrooms", headers=teacher_headers
        ).json()
        if not isinstance(classrooms, list) or not classrooms:
            raise RuntimeError("Teacher has no classroom")
        overview = require_success(
            client.get(
                f"/api/v1/teacher/classrooms/{classrooms[0]['id']}/overview",
                headers=teacher_headers,
            ),
            "teacher overview",
        )
        replay = require_success(
            client.get(
                f"/api/v1/teacher/attempts/{attempt_id}", headers=teacher_headers
            ),
            "teacher replay",
        )
    factory = build_session_factory(build_engine(settings))
    with factory() as db:
        invocations = list(
            db.scalars(
                select(LLMInvocation)
                .where(LLMInvocation.attempt_id == uuid.UUID(attempt_id))
                .order_by(LLMInvocation.created_at)
            )
        )
    evidence = {
        "course_version": course_map.get("course_version"),
        "total_units": course_map.get("total_units"),
        "unit_id": unit_id,
        "attempt_id": attempt_id,
        "stream_event_types": sorted(set(events)),
        "attempt_status": completed.get("status"),
        "round_evaluation_count": len(round_evaluations),
        "round_checklist_count": len(checklist_results),
        "formal_score": (completed.get("evaluation") or {}).get("overall_score"),
        "invocations": [
            {
                "purpose": item.purpose,
                "provider": item.provider,
                "model": item.model_name,
                "status": item.status,
            }
            for item in invocations
        ],
        "teacher_completed_attempts": overview.get("completed_attempts"),
        "teacher_replay_status": (replay.get("attempt") or {}).get("status"),
    }
    print(json.dumps(evidence, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
