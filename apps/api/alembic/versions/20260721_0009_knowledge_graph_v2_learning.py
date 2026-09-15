# [导读] 用途: 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。
# [导读] 本次变更: 扩展第二版图谱学习数据结构, 支持该版本的内容及教学关系。
# [导读] 为什么: models.py 改动不会自动更新旧数据库, 必须沿修订链升级才能匹配应用代码。
# [导读] 结构: revision 与 down_revision 标识顺序; upgrade 升级, downgrade 定义反向操作。
# [导读] 提醒: 迁移涉及真实数据库; 降级可能删除表或列, 不能当作无损撤销。
"""Add knowledge graph 2.0 learning content and round recommendations.

Revision ID: 20260721_0009
Revises: 20260721_0008
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260721_0009"
down_revision: str | None = "20260721_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# [导读] 沿本修订执行表结构升级; 保留 revision 链使成员可从旧库顺序升级。
def upgrade() -> None:
    with op.batch_alter_table("round_evaluations") as batch:
        batch.add_column(sa.Column("recommendations", sa.JSON(), nullable=True))
    op.execute("UPDATE round_evaluations SET recommendations = '[]' WHERE recommendations IS NULL")
    with op.batch_alter_table("round_evaluations") as batch:
        batch.alter_column("recommendations", nullable=False)

    op.create_table(
        "knowledge_learning_contents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("graph_version", sa.String(80), nullable=False),
        sa.Column("node_key", sa.String(180), nullable=False),
        sa.Column("node_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("markdown_body", sa.Text(), nullable=False),
        sa.Column("video_url", sa.String(1000)),
        sa.Column("ppt_url", sa.String(1000)),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("updated_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("graph_version", "node_key"),
    )
    for column in ("graph_version", "node_key", "node_type", "status", "updated_by_user_id"):
        op.create_index(
            f"ix_knowledge_learning_contents_{column}", "knowledge_learning_contents", [column]
        )


# [导读] 按反向顺序撤销本修订结构; 涉及 drop 时会丢失相应数据, 不能当作无损撤销。
def downgrade() -> None:
    op.drop_table("knowledge_learning_contents")
    with op.batch_alter_table("round_evaluations") as batch:
        batch.drop_column("recommendations")
