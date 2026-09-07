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


def downgrade() -> None:
    op.drop_table("knowledge_learning_activities")
