"""Persist scaffold use and deterministic graph learning evidence.

Revision ID: 20260721_0008
Revises: 20260720_0007
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260721_0008"
down_revision: str | None = "20260720_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "knowledge_scaffold_interactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("attempt_id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("graph_version", sa.String(80), nullable=False),
        sa.Column("scaffold_node_key", sa.String(180), nullable=False),
        sa.Column("phenomenon_node_key", sa.String(180)),
        sa.Column("event_type", sa.String(24), nullable=False),
        sa.Column("level", sa.String(40), nullable=False),
        sa.Column("client_event_id", sa.String(100), nullable=False),
        sa.Column("scaffold_snapshot", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "client_event_id"),
    )
    for column in ("attempt_id", "student_id", "graph_version", "scaffold_node_key", "event_type"):
        op.create_index(f"ix_kg_scaffold_{column}", "knowledge_scaffold_interactions", [column])

    op.create_table(
        "graph_learning_evidence",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("round_evaluation_id", sa.Uuid(), nullable=False),
        sa.Column("attempt_id", sa.Uuid(), nullable=False),
        sa.Column("student_message_id", sa.Uuid(), nullable=False),
        sa.Column("graph_version", sa.String(80), nullable=False),
        sa.Column("phenomenon_node_keys", sa.JSON(), nullable=False),
        sa.Column("strategy_node_keys", sa.JSON(), nullable=False),
        sa.Column("knowledge_resource_node_keys", sa.JSON(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("evidence_summary", sa.Text(), nullable=False),
        sa.Column("mapping_method", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["round_evaluation_id"], ["round_evaluations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_message_id"], ["messages.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("round_evaluation_id"),
    )
    for column in ("attempt_id", "student_message_id", "graph_version"):
        op.create_index(f"ix_graph_evidence_{column}", "graph_learning_evidence", [column])


def downgrade() -> None:
    op.drop_table("graph_learning_evidence")
    op.drop_table("knowledge_scaffold_interactions")
