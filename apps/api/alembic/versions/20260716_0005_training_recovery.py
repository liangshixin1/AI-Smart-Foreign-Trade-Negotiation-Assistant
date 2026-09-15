# [导读] 用途: 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。
# [导读] 本次变更: 增加草稿和重练关联等恢复数据, 断开页面后仍能继续训练或回看旧记录。
# [导读] 为什么: models.py 改动不会自动更新旧数据库, 必须沿修订链升级才能匹配应用代码。
# [导读] 结构: revision 与 down_revision 标识顺序; upgrade 升级, downgrade 定义反向操作。
# [导读] 提醒: 迁移涉及真实数据库; 降级可能删除表或列, 不能当作无损撤销。
"""Add attempt drafts and idempotent retry records.

Revision ID: 20260716_0005
Revises: 20260714_0004
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260716_0005"
down_revision: str | None = "20260714_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# [导读] 沿本修订执行表结构升级; 保留 revision 链使成员可从旧库顺序升级。
def upgrade() -> None:
    op.create_table(
        "attempt_drafts",
        sa.Column("attempt_id", sa.Uuid(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("attempt_id"),
    )
    op.create_table(
        "attempt_retries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("source_attempt_id", sa.Uuid(), nullable=False),
        sa.Column("created_attempt_id", sa.Uuid(), nullable=False),
        sa.Column("idempotency_key", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_attempt_id"], ["attempts.id"]),
        sa.ForeignKeyConstraint(["source_attempt_id"], ["attempts.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("created_attempt_id"),
        sa.UniqueConstraint("student_id", "idempotency_key"),
    )
    op.create_index("ix_attempt_retries_student_id", "attempt_retries", ["student_id"])
    op.create_index(
        "ix_attempt_retries_source_attempt_id", "attempt_retries", ["source_attempt_id"]
    )


# [导读] 按反向顺序撤销本修订结构; 涉及 drop 时会丢失相应数据, 不能当作无损撤销。
def downgrade() -> None:
    op.drop_table("attempt_retries")
    op.drop_table("attempt_drafts")
