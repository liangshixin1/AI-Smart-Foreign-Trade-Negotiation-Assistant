"""Desktop isolation, persistence and real business API regression with synthetic data."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select

from app.desktop.runtime import BoundedProvider, DemoCredential
from app.desktop.server import DesktopSettings, desktop_app
from app.integrations.knowledge_graph.sqlite import SQLiteGraphStore
from app.integrations.llm.base import LLMProviderError
from app.modules.knowledge_graph.models import (
    KnowledgeGraphKnowledgePointSnapshot,
    KnowledgeGraphPhenomenonKnowledgeEdge,
    KnowledgeGraphPhenomenonSnapshot,
    KnowledgeGraphStageSnapshot,
)


def test_desktop_settings_ignore_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:///must-not-touch.db")
    monkeypatch.setenv("LLM_PROVIDER", "deepseek")
    settings = DesktopSettings(_env_file=None)
    assert settings.database_url == "sqlite:///./dev.db"
    assert settings.llm_provider == "mock"


def test_graph_versions_survive_restart_and_failed_publish(tmp_path):
    path = tmp_path / "graph.db"
    graph = SQLiteGraphStore(path)
    nodes = [{"id": "knowledge:K110", "label": "索赔"}]
    graph.publish("one", nodes, [])
    nodes[0]["label"] = "mutated"
    graph.publish("two", [{"id": "two"}], [])
    with pytest.raises(ValueError):
        graph.publish("bad", [{"number": float("nan")}], [])
    graph.deactivate("two")
    restarted = SQLiteGraphStore(path)
    assert restarted.read("one").nodes[0]["label"] == "索赔"
    assert restarted.read("two").nodes == [{"id": "two"}]
    assert restarted.read("missing").nodes == []
    assert restarted.health()


def test_keys_distinct_and_expiry_enforced():
    data = dict(
        expires_at=datetime.now(UTC) + timedelta(days=1),
        scenario="one",
        conversation="two",
        evaluation="three",
        model="test-model",
        budget_confirmed=True,
    )
    with pytest.raises(ValidationError):
        DemoCredential(**{**data, "conversation": "one"})
    credential = DemoCredential(**{**data, "expires_at": datetime.now(UTC) - timedelta(days=1)})
    provider = BoundedProvider(None, credential)
    with pytest.raises(LLMProviderError, match="到期"):
        provider._enter()


def test_desktop_initialization_permissions_and_restart(tmp_path: Path):
    token = "desktop-test-token-" * 3
    application = desktop_app(tmp_path, token, "http://testserver")
    with TestClient(application, headers={"X-Desktop-Token": token}) as client:
        assert client.get("/desktop/status", headers={"X-Desktop-Token": ""}).status_code == 403
        assert (
            client.get("/desktop/status", headers={"Origin": "https://evil.test"}).status_code
            == 403
        )
        assert client.get("/desktop/status", headers={"Host": "evil.test"}).status_code == 403
        assert client.get("/api/v1/technician/llm-config").status_code == 403
        state = client.get("/desktop/status").json()
        assert state["mode"] == "mock"
        student = client.post("/desktop/login/student").json()
        assert student["user"]["roles"] == ["student"]
        teacher = client.post("/desktop/login/teacher").json()
        assert teacher["user"]["roles"] == ["teacher"]
        assert client.post("/desktop/login/technician").status_code == 422
        assert (
            client.get(
                "/api/v1/me", headers={"Authorization": "Bearer " + student["access_token"]}
            ).status_code
            == 200
        )
        assert client.get("/api/v1/me").status_code == 401
        headers = {"Authorization": "Bearer " + student["access_token"]}
        course = client.get("/api/v1/courses/current/map", headers=headers)
        assert course.status_code == 200
        for unit in ("chapter-3-section-1", "chapter-8-section-1"):
            created = client.post(
                "/api/v1/attempts",
                headers=headers,
                json={"unit_id": unit, "difficulty": "standard"},
            )
            assert created.status_code == 201, created.text
            attempt_id = created.json()["id"]
            reply = client.post(
                f"/api/v1/attempts/{attempt_id}/messages",
                headers=headers,
                json={
                    "content": "If you accept our evidence, we can discuss a fair settlement.",
                    "client_message_id": "desktop-message-0001",
                },
            )
            assert reply.status_code == 200, reply.text
            completed = client.post(
                f"/api/v1/attempts/{attempt_id}/submit",
                headers={**headers, "Idempotency-Key": "desktop-submit-" + unit},
            )
            assert completed.status_code == 200, completed.text
            assert completed.json()["status"] == "completed"
            teacher_view = client.get(
                f"/api/v1/teacher/attempts/{attempt_id}",
                headers={"Authorization": "Bearer " + teacher["access_token"]},
            )
            assert teacher_view.status_code == 200
        with application.state.session_factory() as db:
            for model, count in (
                (KnowledgeGraphStageSnapshot, 10),
                (KnowledgeGraphPhenomenonSnapshot, 66),
                (KnowledgeGraphKnowledgePointSnapshot, 118),
                (KnowledgeGraphPhenomenonKnowledgeEdge, 298),
            ):
                assert db.scalar(select(func.count()).select_from(model)) == count
    restarted = desktop_app(tmp_path, "new-" + token, "http://testserver")
    with TestClient(restarted, headers={"X-Desktop-Token": "new-" + token}) as client:
        assert client.get("/desktop/status").json()["graph_version"] == state["graph_version"]
        assert (
            client.get(
                "/api/v1/me", headers={"Authorization": "Bearer " + student["access_token"]}
            ).status_code
            == 200
        )
        assert client.post("/desktop/login/student").json()["user"]["id"] == student["user"]["id"]
    assert list((tmp_path / "backups").glob("*.db"))


def test_existing_formal_course_is_rebound_without_faking_completions(tmp_path):
    from app.core.resources import content_root
    from app.db.session import build_engine, build_session_factory
    from app.desktop.bootstrap import identity, migrate, seed
    from app.modules.classrooms.models import Classroom
    from app.modules.curriculum.import_service import CurriculumImporter
    from app.modules.curriculum.models import CourseVersion
    from app.modules.training.models import Attempt

    settings = DesktopSettings(database_url="sqlite:///" + str(tmp_path / "expert.db"))
    migrate(settings, tmp_path)
    factory = build_session_factory(build_engine(settings))
    graph = SQLiteGraphStore(tmp_path / "graph.sqlite3")
    with factory() as db:
        formal = CurriculumImporter(db, content_root()).import_slice()
        formal_id = formal.id
    password = identity(tmp_path)["password"]
    seed(factory, graph, password)
    # Simulate a data directory from the first desktop prototype.
    with factory() as db:
        room = db.scalar(select(Classroom))
        room.course_version_id = formal_id
        db.commit()
    seed(factory, graph, password)
    seed(factory, graph, password)
    with factory() as db:
        room = db.scalar(select(Classroom))
        expert = db.get(CourseVersion, room.course_version_id)
        assert expert.id != formal_id
        assert expert.version.endswith("-expert-open-1")
        assert all(
            not unit.prerequisite_unit_ids for chapter in expert.chapters for unit in chapter.units
        )
        formal = db.get(CourseVersion, formal_id)
        assert any(
            unit.prerequisite_unit_ids for chapter in formal.chapters for unit in chapter.units
        )
        assert db.scalar(select(func.count()).select_from(CourseVersion)) == 2
        assert db.scalar(select(func.count()).select_from(Attempt)) == 0


def test_migration_failure_restores_existing_database(tmp_path, monkeypatch):
    import sqlite3

    from app.desktop import bootstrap

    database = tmp_path / "expert.db"
    with sqlite3.connect(database) as db:
        db.execute("CREATE TABLE sentinel (value TEXT)")
        db.execute("INSERT INTO sentinel VALUES ('before')")

    def broken_upgrade(config, target):
        with sqlite3.connect(database) as db:
            db.execute("UPDATE sentinel SET value='partially migrated'")
        raise RuntimeError("Synthetic migration failure")

    monkeypatch.setattr(bootstrap.command, "upgrade", broken_upgrade)
    with pytest.raises(RuntimeError, match="Synthetic"):
        bootstrap.migrate(DesktopSettings(database_url="sqlite:///" + str(database)), tmp_path)
    with sqlite3.connect(database) as db:
        assert db.execute("SELECT value FROM sentinel").fetchone()[0] == "before"


def test_public_single_key_does_not_inherit_demo_expiry(tmp_path, monkeypatch):
    from app.desktop import server
    from app.desktop.runtime import PublicCredential
    from app.integrations.llm.mock import MockLLMProvider

    seen = {}

    def provider(settings):
        seen["model"] = settings.deepseek_scenario_model
        seen["keys"] = [
            getattr(settings, f"deepseek_{r}_api_key").get_secret_value()
            for r in ("scenario", "conversation", "evaluation")
        ]
        return MockLLMProvider()

    monkeypatch.setattr(server, "build_llm_provider", provider)
    credential = PublicCredential(key="synthetic-public-key", model="test-model")
    token = "public-synthetic-token-" * 3
    application = desktop_app(tmp_path, token, "http://testserver", credential, public_edition=True)
    with TestClient(application, headers={"X-Desktop-Token": token}) as client:
        state = client.get("/desktop/status").json()
        assert state["edition"] == "public"
        assert state["mode"] == "deepseek"
        assert state["expires_at"] is None
        assert "synthetic-public-key" not in str(state)
        assert client.post("/desktop/login/student").status_code == 200
    assert seen["keys"] == ["synthetic-public-key"] * 3
    assert seen["model"] == "test-model"
    with pytest.raises(ValidationError):
        PublicCredential(key="bad key", model="test-model")
