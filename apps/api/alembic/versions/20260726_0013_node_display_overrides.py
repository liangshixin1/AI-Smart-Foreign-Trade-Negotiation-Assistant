"""Add version-bound knowledge node display overrides.

Revision ID: 20260726_0013
Revises: 20260722_0012
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260726_0013"
down_revision: str | None = "20260722_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "knowledge_node_display_overrides",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("graph_version", sa.String(length=80), nullable=False),
        sa.Column("node_key", sa.String(length=180), nullable=False),
        sa.Column("short_name_zh", sa.String(length=32), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("updated_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("graph_version", "node_key"),
    )
    op.create_index(
        op.f("ix_knowledge_node_display_overrides_graph_version"),
        "knowledge_node_display_overrides",
        ["graph_version"],
        unique=False,
    )
    op.create_index(
        op.f("ix_knowledge_node_display_overrides_node_key"),
        "knowledge_node_display_overrides",
        ["node_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_knowledge_node_display_overrides_updated_by_user_id"),
        "knowledge_node_display_overrides",
        ["updated_by_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_knowledge_node_display_overrides_updated_by_user_id"),
        table_name="knowledge_node_display_overrides",
    )
    op.drop_index(
        op.f("ix_knowledge_node_display_overrides_node_key"),
        table_name="knowledge_node_display_overrides",
    )
    op.drop_index(
        op.f("ix_knowledge_node_display_overrides_graph_version"),
        table_name="knowledge_node_display_overrides",
    )
    op.drop_table("knowledge_node_display_overrides")
