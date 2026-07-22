"""Remove legacy public URL fields from learning content.

Revision ID: 20260721_0011
Revises: 20260721_0010
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260721_0011"
down_revision: str | None = "20260721_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("knowledge_learning_contents") as batch:
        batch.drop_column("video_url")
        batch.drop_column("ppt_url")


def downgrade() -> None:
    with op.batch_alter_table("knowledge_learning_contents") as batch:
        batch.add_column(sa.Column("video_url", sa.String(1000)))
        batch.add_column(sa.Column("ppt_url", sa.String(1000)))
