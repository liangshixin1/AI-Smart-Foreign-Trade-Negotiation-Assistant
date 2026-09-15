# [导读] 用途: 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。
# [导读] 本次变更: 增加节点学习正文和媒体附件存储, 让图谱节点对应可维护的学习资料。
# [导读] 为什么: models.py 改动不会自动更新旧数据库, 必须沿修订链升级才能匹配应用代码。
# [导读] 结构: revision 与 down_revision 标识顺序; upgrade 升级, downgrade 定义反向操作。
# [导读] 提醒: 迁移涉及真实数据库; 降级可能删除表或列, 不能当作无损撤销。
"""Add uploaded media assets for knowledge learning content.

Revision ID: 20260721_0010
Revises: 20260721_0009
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260721_0010"
down_revision: str | None = "20260721_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# [导读] 沿本修订执行表结构升级; 保留 revision 链使成员可从旧库顺序升级。
def upgrade() -> None:
    op.create_table(
        "knowledge_content_assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("graph_version", sa.String(80), nullable=False),
        sa.Column("node_key", sa.String(180), nullable=False),
        sa.Column("asset_kind", sa.String(20), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(160), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("uploaded_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("graph_version", "node_key", "asset_kind"),
    )
    for column in ("graph_version", "node_key", "asset_kind", "uploaded_by_user_id"):
        op.create_index(
            f"ix_knowledge_content_assets_{column}", "knowledge_content_assets", [column]
        )


# [导读] 按反向顺序撤销本修订结构; 涉及 drop 时会丢失相应数据, 不能当作无损撤销。
def downgrade() -> None:
    op.drop_table("knowledge_content_assets")
