from __future__ import annotations

import argparse
import json
import re
import statistics
import time
import uuid
from pathlib import Path

import httpx
from app.core.config import Settings
from app.db.session import build_engine, build_session_factory
from app.modules.training.models import LLMInvocation
from sqlalchemy import select

STUDENT_TURNS = [
    "Comparable market offers are near USD 278. We can discuss a larger order for a justified price adjustment.",
    "If you offer USD 283 per unit, we can confirm 1,200 units this week.",
    "The higher volume reduces your selling cost per unit. Can you confirm USD 283 for 1,200 units?",
    "We can use an irrevocable L/C at sight if the unit price is USD 283.",
    "Please clarify whether your USD 283 offer depends on both 1,200 units and the L/C term.",
    "We accept the 1,200-unit quantity as our reciprocal condition, while keeping the price discussion at USD 283.",
    "Our proposal remains USD 283 for 1,200 units with an irrevocable L/C at sight.",
    "Please confirm which one remaining term prevents a provisional agreement.",
    "We can finalize the written order tomorrow after both sides confirm the linked price, quantity, and payment term.",
    "To summarize, we propose USD 283, 1,200 units, L/C at sight, and written confirmation tomorrow.",
]


def require_object(response: httpx.Response, step: str) -> dict[str, object]:
    if response.status_code >= 400:
        raise RuntimeError(
            f"{step} failed: HTTP {response.status_code} {response.text[:500]}"
        )
    payload = response.json()
    if not isinstance(payload, dict):
        raise TypeError(f"{step} did not return an object")
    return payload


def login(client: httpx.Client, identifier: str, password: str) -> dict[str, str]:
    payload = require_object(
        client.post(
            "/api/v1/auth/login",
            json={"identifier": identifier, "password": password},
        ),
        f"login {identifier}",
    )
    return {"Authorization": f"Bearer {payload['access_token']}"}


def stream_turn(
    client: httpx.Client,
    headers: dict[str, str],
    attempt_id: str,
    index: int,
    content: str,
) -> dict[str, object]:
    started = time.perf_counter()
    seen: dict[str, float] = {}
    client_message_id = f"avg-real-{index:02d}-{uuid.uuid4()}"
    with client.stream(
        "POST",
        f"/api/v1/attempts/{attempt_id}/messages/stream",
        headers=headers,
        json={"client_message_id": client_message_id, "content": content},
    ) as response:
        if response.status_code >= 400:
            body = response.read().decode(errors="replace")
            raise RuntimeError(
                f"round {index} failed: HTTP {response.status_code} {body[:500]}"
            )
        for line in response.iter_lines():
            if line.startswith("event:"):
                event_name = line.removeprefix("event:").strip()
                seen.setdefault(event_name, (time.perf_counter() - started) * 1000)
    required = {"simulation.turn.ready", "stream.closed"}
    if missing := required - seen.keys():
        raise RuntimeError(f"round {index} missing events: {sorted(missing)}")
    analysis_event = (
        "simulation.state.updated"
        if "simulation.state.updated" in seen
        else "round_evaluation.failed"
    )
    return {
        "index": index,
        "client_message_id": client_message_id,
        "first_event_ms": round(min(seen.values()), 1),
        "turn_ready_ms": round(seen["simulation.turn.ready"], 1),
        "analysis_ready_ms": round(seen.get(analysis_event, seen["stream.closed"]), 1),
        "analysis_event": analysis_event,
        "events": list(seen),
    }


def percentile_summary(values: list[float]) -> dict[str, float]:
    return {
        "median_ms": round(statistics.median(values), 1),
        "max_ms": round(max(values), 1),
    }


def validate_latest_turn(
    session: dict[str, object], expected_count: int
) -> dict[str, object]:
    turns = session.get("turns")
    if not isinstance(turns, list) or len(turns) != expected_count:
        raise RuntimeError(
            f"expected {expected_count} presentations, got {len(turns or [])}"
        )
    latest = turns[-1]
    if not isinstance(latest, dict) or not isinstance(latest.get("beats"), list):
        raise TypeError("latest presentation is invalid")
    beats = latest["beats"]
    if not 1 <= len(beats) <= 3:
        raise RuntimeError("real response violated the 1-3 beat limit")
    texts = [str(item.get("text", "")) for item in beats if isinstance(item, dict)]
    word_counts = [
        len(re.findall(r"[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*", text)) for text in texts
    ]
    if any(count > 24 for count in word_counts) or sum(word_counts) > 60:
        raise RuntimeError("real response violated the word budget")
    joined = " ".join(texts)
    forbidden = re.compile(
        r"manufacturing cost|bottom line|floor price|\bBATNA\b", re.I
    )
    if forbidden.search(joined):
        raise RuntimeError("real response exposed a private commercial fact")
    return {"beats": len(beats), "words": sum(word_counts), "text": joined}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run a controlled 10-round real AVG smoke test"
    )
    parser.add_argument("--base-url", default="http://127.0.0.1:8012")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    settings = Settings()
    if settings.llm_provider != "deepseek" or settings.dev_seed_password is None:
        raise RuntimeError(
            "Real AVG smoke requires DeepSeek mode and DEV_SEED_PASSWORD"
        )

    with httpx.Client(base_url=args.base_url, timeout=240, trust_env=False) as client:
        student_headers = login(
            client, "student@example.test", settings.dev_seed_password
        )
        create_started = time.perf_counter()
        attempt = require_object(
            client.post(
                "/api/v1/attempts",
                headers={
                    **student_headers,
                    "Idempotency-Key": f"avg-real-create-{uuid.uuid4()}",
                },
                json={
                    "unit_id": "chapter-3-section-1",
                    "difficulty": "standard",
                    "experience_mode": "simulation",
                },
            ),
            "real scenario and briefing",
        )
        create_ms = round((time.perf_counter() - create_started) * 1000, 1)
        attempt_id = str(attempt["id"])
        timings: list[dict[str, object]] = []
        samples: list[dict[str, object]] = []
        for index, content in enumerate(STUDENT_TURNS, start=1):
            timing = stream_turn(client, student_headers, attempt_id, index, content)
            session = require_object(
                client.get(
                    f"/api/v1/attempts/{attempt_id}/simulation", headers=student_headers
                ),
                f"recover round {index}",
            )
            sample = validate_latest_turn(session, index + 1)
            timings.append(timing)
            samples.append({"index": index, **sample})
            print(
                json.dumps(
                    {
                        "round": index,
                        "turn_ready_ms": timing["turn_ready_ms"],
                        "analysis_ready_ms": timing["analysis_ready_ms"],
                        "words": sample["words"],
                    },
                    ensure_ascii=False,
                ),
                flush=True,
            )
        submit_started = time.perf_counter()
        completed = require_object(
            client.post(
                f"/api/v1/attempts/{attempt_id}/submit",
                headers={
                    **student_headers,
                    "Idempotency-Key": f"avg-real-submit-{uuid.uuid4()}",
                },
            ),
            "real final evaluation",
        )
        submit_ms = round((time.perf_counter() - submit_started) * 1000, 1)
        teacher_headers = login(
            client, "teacher@example.test", settings.dev_seed_password
        )
        replay = require_object(
            client.get(
                f"/api/v1/teacher/attempts/{attempt_id}", headers=teacher_headers
            ),
            "real teacher replay",
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
    result = {
        "provider": "deepseek",
        "attempt_id": attempt_id,
        "rounds": len(timings),
        "scenario_and_briefing_ms": create_ms,
        "first_event": percentile_summary(
            [float(item["first_event_ms"]) for item in timings]
        ),
        "turn_ready": percentile_summary(
            [float(item["turn_ready_ms"]) for item in timings]
        ),
        "analysis_ready": percentile_summary(
            [float(item["analysis_ready_ms"]) for item in timings]
        ),
        "final_evaluation_ms": submit_ms,
        "analysis_failures": sum(
            item["analysis_event"] != "simulation.state.updated" for item in timings
        ),
        "samples": samples,
        "timings": timings,
        "final_status": completed.get("status"),
        "final_score": (completed.get("evaluation") or {}).get("overall_score")
        if isinstance(completed.get("evaluation"), dict)
        else None,
        "teacher_mode": (replay.get("attempt") or {}).get("experience_mode")
        if isinstance(replay.get("attempt"), dict)
        else None,
        "teacher_state_versions": len(
            (replay.get("simulation") or {}).get("state_history", [])
        )
        if isinstance(replay.get("simulation"), dict)
        else 0,
        "invocations": [
            {
                "purpose": item.purpose,
                "provider": item.provider,
                "model": item.model_name,
                "status": item.status,
                "usage": item.usage,
            }
            for item in invocations
        ],
    }
    rendered = f"{json.dumps(result, ensure_ascii=False, indent=2)}\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
