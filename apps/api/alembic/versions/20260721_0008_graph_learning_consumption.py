# [导读] 用途: 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。
# [导读] 本次变更: 记录图谱学习支持与交互, 使学生使用提示的行为能够被教师回放。
# [导读] 为什么: models.py 改动不会自动更新旧数据库, 必须沿修订链升级才能匹配应用代码。
# [导读] 结构: revision 与 down_revision 标识顺序; upgrade 升级, downgrade 定义反向操作。
# [导读] 提醒: 迁移涉及真实数据库; 降级可能删除表或列, 不能当作无损撤销。
"""Persist scaffold use and deterministic graph learning evidence.

Revision ID: 20260721_0008
Revises: 20260720_0007
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260721_0008"
down_revision: str | None = "20260720_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# [导读] 沿本修订执行表结构升级; 保留 revision 链使成员可从旧库顺序升级。
def upgrade() -> None:
    op.create_table(
        "knowledge_scaffold_interactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("attempt_id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("graph_version", sa.String(80), nullable=False),
        sa.Column("scaffold_node_key", sa.String(180), nullable=False),
        sa.Column("phenomenon_node_key", sa.String(180)),
        sa.Column("event_type", sa.String(24), nullable=False),
        sa.Column("level", sa.String(40), nullable=False),
        sa.Column("client_event_id", sa.String(100), nullable=False),
        sa.Column("scaffold_snapshot", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "client_event_id"),
    )
    for column in ("attempt_id", "student_id", "graph_version", "scaffold_node_key", "event_type"):
        op.create_index(f"ix_kg_scaffold_{column}", "knowledge_scaffold_interactions", [column])

    op.create_table(
        "graph_learning_evidence",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("round_evaluation_id", sa.Uuid(), nullable=False),
        sa.Column("attempt_id", sa.Uuid(), nullable=False),
        sa.Column("student_message_id", sa.Uuid(), nullable=False),
        sa.Column("graph_version", sa.String(80), nullable=False),
        sa.Column("phenomenon_node_keys", sa.JSON(), nullable=False),
        sa.Column("strategy_node_keys", sa.JSON(), nullable=False),
        sa.Column("knowledge_resource_node_keys", sa.JSON(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("evidence_summary", sa.Text(), nullable=False),
        sa.Column("mapping_method", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["round_evaluation_id"], ["round_evaluations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_message_id"], ["messages.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("round_evaluation_id"),
    )
    for column in ("attempt_id", "student_message_id", "graph_version"):
        op.create_index(f"ix_graph_evidence_{column}", "graph_learning_evidence", [column])


# [导读] 按反向顺序撤销本修订结构; 涉及 drop 时会丢失相应数据, 不能当作无损撤销。
def downgrade() -> None:
    op.drop_table("graph_learning_evidence")
    op.drop_table("knowledge_scaffold_interactions")
