# [导读] 用途: 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。
# [导读] 本次变更: 增加仿真会话、演出、生成请求和态势记录, 支持角色演出及历史回放。
# [导读] 为什么: models.py 改动不会自动更新旧数据库, 必须沿修订链升级才能匹配应用代码。
# [导读] 结构: revision 与 down_revision 标识顺序; upgrade 升级, downgrade 定义反向操作。
# [导读] 提醒: 迁移涉及真实数据库; 降级可能删除表或列, 不能当作无损撤销。
"""Add AVG simulation sessions, presentations, state, and creation idempotency.

Revision ID: 20260907_0017
Revises: 20260904_0016
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260907_0017"
down_revision: str | None = "20260904_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# [导读] 沿本修订执行表结构升级; 保留 revision 链使成员可从旧库顺序升级。
def upgrade() -> None:
    with op.batch_alter_table("attempts") as batch:
        batch.add_column(
            sa.Column("experience_mode", sa.String(20), nullable=False, server_default="chat")
        )
        batch.add_column(
            sa.Column("conversation_revision", sa.Integer(), nullable=False, server_default="0")
        )
        batch.create_check_constraint(
            "ck_attempt_mode", "experience_mode IN ('chat', 'simulation')"
        )
    with op.batch_alter_table("round_evaluations") as batch:
        batch.add_column(sa.Column("simulation_observation", sa.JSON(), nullable=True))
    op.execute(
        "UPDATE round_evaluations SET simulation_observation = '{}' "
        "WHERE simulation_observation IS NULL"
    )
    with op.batch_alter_table("round_evaluations") as batch:
        batch.alter_column("simulation_observation", nullable=False)

    op.create_table(
        "attempt_creation_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("student_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("operation", sa.String(40), nullable=False),
        sa.Column("idempotency_key", sa.String(120), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column(
            "attempt_id", sa.Uuid(), sa.ForeignKey("attempts.id"), nullable=False, unique=True
        ),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("student_id", "operation", "idempotency_key"),
    )
    op.create_index(
        "ix_attempt_creation_requests_student_id", "attempt_creation_requests", ["student_id"]
    )
    op.create_table(
        "simulation_sessions",
        sa.Column(
            "attempt_id",
            sa.Uuid(),
            sa.ForeignKey("attempts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("profile_id", sa.String(120), nullable=False),
        sa.Column("profile_version", sa.String(50), nullable=False),
        sa.Column("schema_version", sa.String(50), nullable=False),
        sa.Column("briefing_payload", sa.JSON(), nullable=False),
        sa.Column("briefing_hash", sa.String(64), nullable=False),
        sa.Column("briefing_status", sa.String(24), nullable=False),
        sa.Column("character_id", sa.String(80), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("scene_id", sa.String(80), nullable=False),
        sa.Column("asset_pack", sa.String(120), nullable=False),
        sa.Column("asset_pack_version", sa.String(50), nullable=False),
        sa.Column("latest_state_revision", sa.Integer(), nullable=False),
        sa.Column("latest_state_payload", sa.JSON(), nullable=False),
        sa.Column("analysis_status", sa.String(24), nullable=False),
        sa.Column("generation_owner", sa.String(100), nullable=True),
        sa.Column("generation_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("generation_revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "simulation_turn_presentations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "attempt_id",
            sa.Uuid(),
            sa.ForeignKey("attempts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "assistant_message_id",
            sa.Uuid(),
            sa.ForeignKey("messages.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("student_message_id", sa.Uuid(), sa.ForeignKey("messages.id"), nullable=True),
        sa.Column("schema_version", sa.String(50), nullable=False),
        sa.Column("beats", sa.JSON(), nullable=False),
        sa.Column("canonical_text_hash", sa.String(64), nullable=False),
        sa.Column("source", sa.String(40), nullable=False),
        sa.Column("input_state_revision", sa.Integer(), nullable=False),
        sa.Column("conversation_revision", sa.Integer(), nullable=False),
        sa.Column("prompt_binding", sa.JSON(), nullable=False),
        sa.Column("asset_pack_version", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_simulation_turn_presentations_attempt_id",
        "simulation_turn_presentations",
        ["attempt_id"],
    )
    op.create_table(
        "simulation_state_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "attempt_id",
            sa.Uuid(),
            sa.ForeignKey("attempts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "round_evaluation_id",
            sa.Uuid(),
            sa.ForeignKey("round_evaluations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("student_message_id", sa.Uuid(), sa.ForeignKey("messages.id"), nullable=False),
        sa.Column("assistant_message_id", sa.Uuid(), sa.ForeignKey("messages.id"), nullable=False),
        sa.Column("event_kind", sa.String(80), nullable=False),
        sa.Column("target_key", sa.String(80), nullable=False),
        sa.Column("term_version", sa.Integer(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("dedupe_key", sa.String(64), nullable=False),
        sa.Column("decision", sa.String(24), nullable=False),
        sa.Column("validation_reason", sa.Text(), nullable=False),
        sa.Column("rules_version", sa.String(50), nullable=False),
        sa.Column("source_conversation_revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("attempt_id", "dedupe_key"),
    )
    op.create_index(
        "ix_simulation_state_events_attempt_id", "simulation_state_events", ["attempt_id"]
    )
    op.create_index(
        "ix_simulation_state_events_round_evaluation_id",
        "simulation_state_events",
        ["round_evaluation_id"],
    )
    op.create_table(
        "simulation_state_snapshots",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "attempt_id",
            sa.Uuid(),
            sa.ForeignKey("attempts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("state_revision", sa.Integer(), nullable=False),
        sa.Column(
            "source_round_id", sa.Uuid(), sa.ForeignKey("round_evaluations.id"), nullable=True
        ),
        sa.Column("parent_revision", sa.Integer(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("applied_event_ids", sa.JSON(), nullable=False),
        sa.Column("rules_version", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("attempt_id", "state_revision"),
    )
    op.create_index(
        "ix_simulation_state_snapshots_attempt_id", "simulation_state_snapshots", ["attempt_id"]
    )


# [导读] 按反向顺序撤销本修订结构; 涉及 drop 时会丢失相应数据, 不能当作无损撤销。
def downgrade() -> None:
    op.drop_table("simulation_state_snapshots")
    op.drop_table("simulation_state_events")
    op.drop_table("simulation_turn_presentations")
    op.drop_table("simulation_sessions")
    op.drop_table("attempt_creation_requests")
    with op.batch_alter_table("round_evaluations") as batch:
        batch.drop_column("simulation_observation")
    with op.batch_alter_table("attempts") as batch:
        batch.drop_constraint("ck_attempt_mode", type_="check")
        batch.drop_column("conversation_revision")
        batch.drop_column("experience_mode")
