# [导读] 用途: 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。
# [导读] 本次变更: 增加学习发展诊断相关数据, 保留各维度的支持需求与依据。
# [导读] 为什么: models.py 改动不会自动更新旧数据库, 必须沿修订链升级才能匹配应用代码。
# [导读] 结构: revision 与 down_revision 标识顺序; upgrade 升级, downgrade 定义反向操作。
# [导读] 提醒: 迁移涉及真实数据库; 降级可能删除表或列, 不能当作无损撤销。
"""Add teacher-only ZPD learning diagnostics.

Revision ID: 20260722_0012
Revises: 20260721_0011
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260722_0012"
down_revision: str | None = "20260721_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# [导读] 沿本修订执行表结构升级; 保留 revision 链使成员可从旧库顺序升级。
def upgrade() -> None:
    with op.batch_alter_table("round_evaluations") as batch:
        batch.add_column(
            sa.Column("learning_diagnostic", sa.JSON(), nullable=False, server_default="{}")
        )
    with op.batch_alter_table("evaluations") as batch:
        batch.add_column(
            sa.Column("learning_diagnostic", sa.JSON(), nullable=False, server_default="{}")
        )


# [导读] 按反向顺序撤销本修订结构; 涉及 drop 时会丢失相应数据, 不能当作无损撤销。
def downgrade() -> None:
    with op.batch_alter_table("evaluations") as batch:
        batch.drop_column("learning_diagnostic")
    with op.batch_alter_table("round_evaluations") as batch:
        batch.drop_column("learning_diagnostic")
