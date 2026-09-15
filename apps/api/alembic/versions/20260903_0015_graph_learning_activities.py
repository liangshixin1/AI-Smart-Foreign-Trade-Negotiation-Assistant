# [导读] 用途: 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。
# [导读] 本次变更: 增加节点浏览与学习完成事件, 将学习活动同正式课程通关分开。
# [导读] 为什么: models.py 改动不会自动更新旧数据库, 必须沿修订链升级才能匹配应用代码。
# [导读] 结构: revision 与 down_revision 标识顺序; upgrade 升级, downgrade 定义反向操作。
# [导读] 提醒: 迁移涉及真实数据库; 降级可能删除表或列, 不能当作无损撤销。
"""Add auditable graph learning activities.

Revision ID: 20260903_0015
Revises: 20260901_0014
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260903_0015"
down_revision: str | None = "20260901_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# [导读] 沿本修订执行表结构升级; 保留 revision 链使成员可从旧库顺序升级。
def upgrade() -> None:
    op.create_table(
        "knowledge_learning_activities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("graph_version", sa.String(length=80), nullable=False),
        sa.Column("node_key", sa.String(length=180), nullable=False),
        sa.Column("node_type", sa.String(length=50), nullable=False),
        sa.Column("event_type", sa.String(length=24), nullable=False),
        sa.Column("source", sa.String(length=24), nullable=False),
        sa.Column("attempt_id", sa.Uuid(), nullable=True),
        sa.Column("client_event_id", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "client_event_id"),
    )
    for column in (
        "student_id",
        "graph_version",
        "node_key",
        "node_type",
        "event_type",
        "source",
        "attempt_id",
    ):
        op.create_index(
            op.f(f"ix_knowledge_learning_activities_{column}"),
            "knowledge_learning_activities",
            [column],
        )


# [导读] 按反向顺序撤销本修订结构; 涉及 drop 时会丢失相应数据, 不能当作无损撤销。
def downgrade() -> None:
    op.drop_table("knowledge_learning_activities")
