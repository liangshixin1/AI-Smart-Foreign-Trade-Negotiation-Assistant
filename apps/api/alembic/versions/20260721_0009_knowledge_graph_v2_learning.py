"""Add knowledge graph 2.0 learning content and round recommendations.

Revision ID: 20260721_0009
Revises: 20260721_0008
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260721_0009"
down_revision: str | None = "20260721_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("round_evaluations") as batch:
        batch.add_column(sa.Column("recommendations", sa.JSON(), nullable=True))
    op.execute("UPDATE round_evaluations SET recommendations = '[]' WHERE recommendations IS NULL")
    with op.batch_alter_table("round_evaluations") as batch:
        batch.alter_column("recommendations", nullable=False)

    op.create_table(
        "knowledge_learning_contents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("graph_version", sa.String(80), nullable=False),
        sa.Column("node_key", sa.String(180), nullable=False),
        sa.Column("node_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("markdown_body", sa.Text(), nullable=False),
        sa.Column("video_url", sa.String(1000)),
        sa.Column("ppt_url", sa.String(1000)),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("updated_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("graph_version", "node_key"),
    )
    for column in ("graph_version", "node_key", "node_type", "status", "updated_by_user_id"):
        op.create_index(
            f"ix_knowledge_learning_contents_{column}", "knowledge_learning_contents", [column]
        )


def downgrade() -> None:
    op.drop_table("knowledge_learning_contents")
    with op.batch_alter_table("round_evaluations") as batch:
        batch.drop_column("recommendations")
