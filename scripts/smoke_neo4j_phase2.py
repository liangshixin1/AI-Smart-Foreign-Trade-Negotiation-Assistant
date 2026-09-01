from __future__ import annotations

from pathlib import Path

from app.core.config import get_settings
from app.main import app
from fastapi.testclient import TestClient
from httpx import Response

WORKBOOK = (
    Path(__file__).resolve().parents[1]
    / "content"
    / "knowledge-graph"
    / "templates"
    / "expert-knowledge-graph-v3.xlsx"
)


def _require_ok(response: Response, step: str) -> dict[str, object]:
    if response.status_code >= 400:
        raise RuntimeError(
            f"{step} failed ({response.status_code}): {response.text[:500]}"
        )
    payload = response.json()
    if not isinstance(payload, dict):
        raise TypeError(f"{step} returned an unexpected payload.")
    return payload


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    payload = _require_ok(
        client.post(
            "/api/v1/auth/login",
            json={"identifier": email, "password": password},
        ),
        f"login {email}",
    )
    token = payload.get("access_token")
    if not isinstance(token, str):
        raise TypeError("Login response did not include an access token.")
    return {"Authorization": f"Bearer {token}"}


def run() -> None:
    settings = get_settings()
    if settings.app_env == "production":
        raise RuntimeError("The development smoke test is disabled in production.")
    if settings.knowledge_graph_provider != "neo4j":
        raise RuntimeError(
            "Set KNOWLEDGE_GRAPH_PROVIDER=neo4j before running the smoke test."
        )
    if not settings.dev_seed_password:
        raise RuntimeError(
            "Set DEV_SEED_PASSWORD and seed the development users first."
        )

    with TestClient(app) as client:
        teacher = _login(client, "teacher@example.test", settings.dev_seed_password)
        technician = _login(
            client, "technician@example.test", settings.dev_seed_password
        )
        imported = _require_ok(
            client.post(
                "/api/v1/knowledge-graph/imports",
                headers={
                    **teacher,
                    "Content-Type": (
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    ),
                    "X-File-Name": WORKBOOK.name,
                    "X-Template-Version": "3.0",
                },
                content=WORKBOOK.read_bytes(),
            ),
            "import full workbook",
        )
        change_set = _require_ok(
            client.get(
                f"/api/v1/knowledge-graph/imports/{imported['id']}/change-set",
                headers=teacher,
            ),
            "load change set",
        )
        status = str(change_set["status"])
        if status == "review_ready":
            change_set = _require_ok(
                client.post(
                    f"/api/v1/knowledge-graph/change-sets/{change_set['id']}/submit-review",
                    headers=teacher,
                ),
                "submit review",
            )
            status = str(change_set["status"])
        if status == "in_review":
            change_set = _require_ok(
                client.post(
                    f"/api/v1/knowledge-graph/change-sets/{change_set['id']}/decision",
                    headers=technician,
                    json={"decision": "approve"},
                ),
                "approve change set",
            )
            status = str(change_set["status"])
        if status in {"approved", "publication_failed"}:
            publication = _require_ok(
                client.post(
                    f"/api/v1/knowledge-graph/change-sets/{change_set['id']}/publish",
                    headers=technician,
                ),
                "publish to Neo4j",
            )
        elif status == "published":
            publication = _require_ok(
                client.get(
                    "/api/v1/knowledge-graph/publications/active", headers=technician
                ),
                "load active publication",
            )
        else:
            raise RuntimeError(
                f"Change set cannot be published from status {status!r}."
            )

        graph = _require_ok(
            client.get("/api/v1/knowledge-graph/teacher/graph", headers=teacher),
            "read teacher graph",
        )
        node_count = int(graph["node_count"])
        edge_count = int(graph["edge_count"])
        # 教师图投影一级主题、训练场景、现象、知识资源和策略战术。
        if node_count != 213 or edge_count != 384:
            raise RuntimeError(
                "Neo4j graph is unexpectedly small after the full-course import."
            )
        print(
            "Neo4j expert knowledge graph 3.0 smoke passed:",
            f"version={publication['graph_version']}",
            f"teacher_nodes={node_count}",
            f"teacher_edges={edge_count}",
        )


if __name__ == "__main__":
    run()
