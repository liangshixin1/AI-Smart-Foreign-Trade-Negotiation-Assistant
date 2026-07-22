"""Add streaming round feedback persistence.

Revision ID: 20260714_0004
Revises: 20260714_0003
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260714_0004"
down_revision: str | None = "20260714_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("training_units") as batch_op:
        batch_op.add_column(sa.Column("round_evaluation_prompt_id", sa.Uuid(), nullable=True))
        batch_op.create_foreign_key(
            "fk_training_units_round_evaluation_prompt",
            "prompt_templates",
            ["round_evaluation_prompt_id"],
            ["id"],
        )
    op.create_table(
        "round_evaluations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("attempt_id", sa.Uuid(), nullable=False),
        sa.Column("student_message_id", sa.Uuid(), nullable=False),
        sa.Column("assistant_message_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("pros", sa.String(length=240), nullable=False),
        sa.Column("cons", sa.String(length=240), nullable=False),
        sa.Column("detailed_evaluation", sa.Text(), nullable=False),
        sa.Column("next_step_suggestion", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("model_name", sa.String(length=120), nullable=False),
        sa.Column("prompt_template_id", sa.String(length=120), nullable=False),
        sa.Column("prompt_version", sa.String(length=50), nullable=False),
        sa.Column("raw_output_reference", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempts.id"]),
        sa.ForeignKeyConstraint(["student_message_id"], ["messages.id"]),
        sa.ForeignKeyConstraint(["assistant_message_id"], ["messages.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assistant_message_id"),
    )
    op.create_index("ix_round_evaluations_attempt_id", "round_evaluations", ["attempt_id"])
    op.create_index(
        "ix_round_evaluations_student_message_id",
        "round_evaluations",
        ["student_message_id"],
    )
    op.create_index(
        "ix_round_evaluations_assistant_message_id",
        "round_evaluations",
        ["assistant_message_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("round_evaluations")
    with op.batch_alter_table("training_units") as batch_op:
        batch_op.drop_constraint("fk_training_units_round_evaluation_prompt", type_="foreignkey")
        batch_op.drop_column("round_evaluation_prompt_id")
