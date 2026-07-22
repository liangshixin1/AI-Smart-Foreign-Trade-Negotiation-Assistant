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


def downgrade() -> None:
    op.drop_table("attempt_retries")
    op.drop_table("attempt_drafts")
