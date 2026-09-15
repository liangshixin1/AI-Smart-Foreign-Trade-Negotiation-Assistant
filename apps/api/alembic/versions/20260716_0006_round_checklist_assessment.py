# [导读] 用途: 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。
# [导读] 本次变更: 为逐轮评价补充目标清单检查结果, 让每项任务要求都有结构化反馈。
# [导读] 为什么: models.py 改动不会自动更新旧数据库, 必须沿修订链升级才能匹配应用代码。
# [导读] 结构: revision 与 down_revision 标识顺序; upgrade 升级, downgrade 定义反向操作。
# [导读] 提醒: 迁移涉及真实数据库; 降级可能删除表或列, 不能当作无损撤销。
"""Persist checklist assessments produced with each round evaluation.

Revision ID: 20260716_0006
Revises: 20260716_0005
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260716_0006"
down_revision: str | None = "20260716_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# [导读] 沿本修订执行表结构升级; 保留 revision 链使成员可从旧库顺序升级。
def upgrade() -> None:
    # 空数组让旧评价记录在升级后仍能被新版响应模型安全读取。
    with op.batch_alter_table("round_evaluations") as batch_op:
        batch_op.add_column(
            sa.Column(
                "checklist_results",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'[]'"),
            )
        )


# [导读] 按反向顺序撤销本修订结构; 涉及 drop 时会丢失相应数据, 不能当作无损撤销。
def downgrade() -> None:
    with op.batch_alter_table("round_evaluations") as batch_op:
        batch_op.drop_column("checklist_results")
