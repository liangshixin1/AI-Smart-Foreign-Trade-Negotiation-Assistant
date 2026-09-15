# [导读] 业务名词: Attempt 是一次训练记录; 场景是本次任务与约束; 正式提交会冻结内容以便评价和回
# [导读] 放。
# [导读] 用途: 回归验证数据库迁移链及新旧表结构兼容。
# [导读] 为什么: 用可重复输入固定业务边界, 既检查成功结果, 也防止重试、权限或无效输入破坏已有行
# [导读] 为。
# [导读] 结构: 本文件有 2 个测试函数; 按各用例的准备、操作、断言顺序阅读, 公共夹具见
# [导读] tests/conftest.py。
# [导读] 提醒: 测试中的用户、令牌、案例和模型输出是测试数据; 通过这些用例不等于已验证真实外部模
# [导读] 型或线上环境。
from __future__ import annotations

from pathlib import Path

from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from alembic import command
from app.core.config import get_settings


def test_alembic_upgrades_empty_database(monkeypatch, tmp_path: Path) -> None:  # type: ignore[no-untyped-def]
    database_path = tmp_path / "migration-test.db"
    database_url = f"sqlite:///{database_path}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("AUTH_TOKEN_PEPPER", "migration-test-pepper-with-thirty-two-characters")
    get_settings.cache_clear()


def test_upgrade_from_0016_preserves_legacy_attempt_as_chat(
    monkeypatch,
    tmp_path: Path,  # type: ignore[no-untyped-def]
) -> None:
    database_path = tmp_path / "legacy-migration-test.db"
    database_url = f"sqlite:///{database_path}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("AUTH_TOKEN_PEPPER", "migration-test-pepper-with-thirty-two-characters")
    get_settings.cache_clear()
    api_root = Path(__file__).resolve().parents[1]
    config = Config(str(api_root / "alembic.ini"))
    command.upgrade(config, "20260904_0016")

    legacy_attempt_id = "12345678123456781234567812345678"
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO attempts "
                "(id, student_id, unit_id, course_version_id, retry_of_attempt_id, "
                "status, difficulty, content_bindings, submitted_at, completed_at, "
                "created_at, updated_at) "
                "VALUES (:id, :student, :unit, :course, NULL, 'in_progress', 'standard', "
                "'{}', NULL, NULL, :created, :created)"
            ),
            {
                "id": legacy_attempt_id,
                "student": "11111111111111111111111111111111",
                "unit": "22222222222222222222222222222222",
                "course": "33333333333333333333333333333333",
                "created": "2026-09-01 09:00:00",
            },
        )

    command.upgrade(config, "head")
    with engine.connect() as connection:
        row = connection.execute(
            text("SELECT experience_mode, conversation_revision FROM attempts WHERE id = :id"),
            {"id": legacy_attempt_id},
        ).one()
    assert row.experience_mode == "chat"
    assert row.conversation_revision == 0
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
        "knowledge_node_display_overrides",
        "knowledge_graph_stage_snapshots",
        "knowledge_graph_phenomenon_snapshots",
        "knowledge_graph_knowledge_point_snapshots",
        "knowledge_graph_phenomenon_knowledge_edges",
        "knowledge_graph_translation_overlays",
        "knowledge_graph_scenario_stage_bindings",
        "knowledge_graph_scenario_phenomenon_bindings",
        "knowledge_learning_activities",
        "attempt_creation_requests",
        "simulation_sessions",
        "simulation_turn_presentations",
        "simulation_state_events",
        "simulation_state_snapshots",
        "alembic_version",
    } <= tables
    columns = {column["name"] for column in inspector.get_columns("round_evaluations")}
    assert "checklist_results" in columns
    assert "learning_diagnostic" in columns
    assert "simulation_observation" in columns
    attempt_columns = {column["name"] for column in inspector.get_columns("attempts")}
    assert {"experience_mode", "conversation_revision"} <= attempt_columns
    evaluation_columns = {column["name"] for column in inspector.get_columns("evaluations")}
    assert "learning_diagnostic" in evaluation_columns
    evidence_columns = {
        column["name"] for column in inspector.get_columns("graph_learning_evidence")
    }
    assert {
        "knowledge_point_node_keys",
        "knowledge_type_breakdown",
        "node_evidence",
    } <= evidence_columns
    get_settings.cache_clear()
