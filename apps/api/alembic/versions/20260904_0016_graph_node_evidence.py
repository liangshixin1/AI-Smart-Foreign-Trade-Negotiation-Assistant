"""Add per-node semantic evidence to graph learning rounds.

Revision ID: 20260904_0016
Revises: 20260903_0015
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260904_0016"
down_revision: str | None = "20260903_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("graph_learning_evidence") as batch:
        batch.add_column(sa.Column("node_evidence", sa.JSON(), nullable=True))
    op.execute(
        "UPDATE graph_learning_evidence SET node_evidence = '[]' WHERE node_evidence IS NULL"
    )
    with op.batch_alter_table("graph_learning_evidence") as batch:
        batch.alter_column("node_evidence", nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("graph_learning_evidence") as batch:
        batch.drop_column("node_evidence")
