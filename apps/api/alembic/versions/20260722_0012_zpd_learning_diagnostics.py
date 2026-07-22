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


def upgrade() -> None:
    with op.batch_alter_table("round_evaluations") as batch:
        batch.add_column(
            sa.Column("learning_diagnostic", sa.JSON(), nullable=False, server_default="{}")
        )
    with op.batch_alter_table("evaluations") as batch:
        batch.add_column(
            sa.Column("learning_diagnostic", sa.JSON(), nullable=False, server_default="{}")
        )


def downgrade() -> None:
    with op.batch_alter_table("evaluations") as batch:
        batch.drop_column("learning_diagnostic")
    with op.batch_alter_table("round_evaluations") as batch:
        batch.drop_column("learning_diagnostic")
