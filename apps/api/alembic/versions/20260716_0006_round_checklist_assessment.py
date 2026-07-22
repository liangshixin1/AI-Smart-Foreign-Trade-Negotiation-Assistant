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


def downgrade() -> None:
    with op.batch_alter_table("round_evaluations") as batch_op:
        batch_op.drop_column("checklist_results")
