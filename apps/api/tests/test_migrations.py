from __future__ import annotations

from pathlib import Path

from alembic.config import Config
from sqlalchemy import create_engine, inspect

from alembic import command
from app.core.config import get_settings


def test_alembic_upgrades_empty_database(monkeypatch, tmp_path: Path) -> None:  # type: ignore[no-untyped-def]
    database_path = tmp_path / "migration-test.db"
    database_url = f"sqlite:///{database_path}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("AUTH_TOKEN_PEPPER", "migration-test-pepper-with-thirty-two-characters")
    get_settings.cache_clear()
    api_root = Path(__file__).resolve().parents[1]
    config = Config(str(api_root / "alembic.ini"))
    command.upgrade(config, "head")

    inspector = inspect(create_engine(database_url))
    tables = set(inspector.get_table_names())
    assert {
        "users",
        "roles",
        "user_roles",
        "auth_sessions",
        "courses",
        "course_versions",
        "chapters",
        "training_units",
        "classrooms",
        "enrollments",
        "round_evaluations",
        "knowledge_import_jobs",
        "knowledge_graph_change_sets",
        "knowledge_graph_publications",
        "knowledge_graph_audit_events",
        "alembic_version",
    } <= tables
    columns = {column["name"] for column in inspector.get_columns("round_evaluations")}
    assert "checklist_results" in columns
    assert "learning_diagnostic" in columns
    evaluation_columns = {column["name"] for column in inspector.get_columns("evaluations")}
    assert "learning_diagnostic" in evaluation_columns
    get_settings.cache_clear()
