"""Add uploaded media assets for knowledge learning content.

Revision ID: 20260721_0010
Revises: 20260721_0009
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260721_0010"
down_revision: str | None = "20260721_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "knowledge_content_assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("graph_version", sa.String(80), nullable=False),
        sa.Column("node_key", sa.String(180), nullable=False),
        sa.Column("asset_kind", sa.String(20), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(160), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("uploaded_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("graph_version", "node_key", "asset_kind"),
    )
    for column in ("graph_version", "node_key", "asset_kind", "uploaded_by_user_id"):
        op.create_index(
            f"ix_knowledge_content_assets_{column}", "knowledge_content_assets", [column]
        )


def downgrade() -> None:
    op.drop_table("knowledge_content_assets")
