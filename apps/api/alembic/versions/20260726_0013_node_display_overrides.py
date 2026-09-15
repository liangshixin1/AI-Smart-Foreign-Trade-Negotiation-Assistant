# [导读] 用途: 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。
# [导读] 本次变更: 增加节点显示名覆盖记录, 教师改短名时不污染专家原始事实。
# [导读] 为什么: models.py 改动不会自动更新旧数据库, 必须沿修订链升级才能匹配应用代码。
# [导读] 结构: revision 与 down_revision 标识顺序; upgrade 升级, downgrade 定义反向操作。
# [导读] 提醒: 迁移涉及真实数据库; 降级可能删除表或列, 不能当作无损撤销。
"""Add version-bound knowledge node display overrides.

Revision ID: 20260726_0013
Revises: 20260722_0012
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260726_0013"
down_revision: str | None = "20260722_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# [导读] 沿本修订执行表结构升级; 保留 revision 链使成员可从旧库顺序升级。
def upgrade() -> None:
    op.create_table(
        "knowledge_node_display_overrides",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("graph_version", sa.String(length=80), nullable=False),
        sa.Column("node_key", sa.String(length=180), nullable=False),
        sa.Column("short_name_zh", sa.String(length=32), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("updated_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("graph_version", "node_key"),
    )
    op.create_index(
        op.f("ix_knowledge_node_display_overrides_graph_version"),
        "knowledge_node_display_overrides",
        ["graph_version"],
        unique=False,
    )
    op.create_index(
        op.f("ix_knowledge_node_display_overrides_node_key"),
        "knowledge_node_display_overrides",
        ["node_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_knowledge_node_display_overrides_updated_by_user_id"),
        "knowledge_node_display_overrides",
        ["updated_by_user_id"],
        unique=False,
    )


# [导读] 按反向顺序撤销本修订结构; 涉及 drop 时会丢失相应数据, 不能当作无损撤销。
def downgrade() -> None:
    op.drop_index(
        op.f("ix_knowledge_node_display_overrides_updated_by_user_id"),
        table_name="knowledge_node_display_overrides",
    )
    op.drop_index(
        op.f("ix_knowledge_node_display_overrides_node_key"),
        table_name="knowledge_node_display_overrides",
    )
    op.drop_index(
        op.f("ix_knowledge_node_display_overrides_graph_version"),
        table_name="knowledge_node_display_overrides",
    )
    op.drop_table("knowledge_node_display_overrides")
