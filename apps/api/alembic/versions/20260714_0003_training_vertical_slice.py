"""Create the training, assessment, and progress vertical slice.

Revision ID: 20260714_0003
Revises: 20260714_0002
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260714_0003"
down_revision: str | None = "20260714_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "attempts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("unit_id", sa.Uuid(), nullable=False),
        sa.Column("course_version_id", sa.Uuid(), nullable=False),
        sa.Column("retry_of_attempt_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("difficulty", sa.String(32), nullable=False),
        sa.Column("content_bindings", sa.JSON(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["unit_id"], ["training_units.id"]),
        sa.ForeignKeyConstraint(["course_version_id"], ["course_versions.id"]),
        sa.ForeignKeyConstraint(["retry_of_attempt_id"], ["attempts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_attempts_student_id", "attempts", ["student_id"])
    op.create_index("ix_attempts_unit_id", "attempts", ["unit_id"])
    op.create_index("ix_attempts_status", "attempts", ["status"])
    op.create_table(
        "scenario_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("attempt_id", sa.Uuid(), nullable=False),
        sa.Column("public_payload", sa.JSON(), nullable=False),
        sa.Column("private_payload", sa.JSON(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("provider", sa.String(40), nullable=False),
        sa.Column("model_name", sa.String(120), nullable=False),
        sa.Column("prompt_template_id", sa.String(120), nullable=False),
        sa.Column("prompt_version", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("attempt_id"),
    )
    op.create_table(
        "messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("attempt_id", sa.Uuid(), nullable=False),
        sa.Column("sequence_no", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("client_message_id", sa.String(100), nullable=True),
        sa.Column("failure_code", sa.String(80), nullable=True),
        sa.Column("provider", sa.String(40), nullable=True),
        sa.Column("model_name", sa.String(120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("attempt_id", "sequence_no"),
        sa.UniqueConstraint("attempt_id", "client_message_id"),
    )
    op.create_index("ix_messages_attempt_id", "messages", ["attempt_id"])
    op.create_table(
        "submissions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("attempt_id", sa.Uuid(), nullable=False),
        sa.Column("idempotency_key", sa.String(120), nullable=False),
        sa.Column("conversation_hash", sa.String(64), nullable=False),
        sa.Column("frozen_payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("attempt_id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_submissions_attempt_id", "submissions", ["attempt_id"])
    op.create_table(
        "attempt_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("attempt_id", sa.Uuid(), nullable=False),
        sa.Column("from_status", sa.String(32), nullable=True),
        sa.Column("to_status", sa.String(32), nullable=False),
        sa.Column("reason", sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_attempt_events_attempt_id", "attempt_events", ["attempt_id"])
    op.create_table(
        "llm_invocations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("attempt_id", sa.Uuid(), nullable=False),
        sa.Column("purpose", sa.String(32), nullable=False),
        sa.Column("correlation_id", sa.String(100), nullable=False),
        sa.Column("provider", sa.String(40), nullable=False),
        sa.Column("model_name", sa.String(120), nullable=False),
        sa.Column("prompt_template_id", sa.String(120), nullable=False),
        sa.Column("prompt_version", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("usage", sa.JSON(), nullable=False),
        sa.Column("error_category", sa.String(80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("correlation_id"),
    )
    op.create_index("ix_llm_invocations_attempt_id", "llm_invocations", ["attempt_id"])
    op.create_table(
        "evaluations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("attempt_id", sa.Uuid(), nullable=False),
        sa.Column("submission_id", sa.Uuid(), nullable=False),
        sa.Column("run_no", sa.Integer(), nullable=False),
        sa.Column("evaluation_status", sa.String(24), nullable=False),
        sa.Column("overall_score", sa.Float(), nullable=False),
        sa.Column("level", sa.String(40), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("strengths", sa.JSON(), nullable=False),
        sa.Column("improvements", sa.JSON(), nullable=False),
        sa.Column("next_actions", sa.JSON(), nullable=False),
        sa.Column("knowledge_tags", sa.JSON(), nullable=False),
        sa.Column("provider", sa.String(40), nullable=False),
        sa.Column("model_name", sa.String(120), nullable=False),
        sa.Column("prompt_template_id", sa.String(120), nullable=False),
        sa.Column("prompt_version", sa.String(50), nullable=False),
        sa.Column("raw_output_reference", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempts.id"]),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("attempt_id", "run_no"),
    )
    op.create_index("ix_evaluations_attempt_id", "evaluations", ["attempt_id"])
    op.create_index("ix_evaluations_submission_id", "evaluations", ["submission_id"])
    op.create_table(
        "evaluation_dimensions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("evaluation_id", sa.Uuid(), nullable=False),
        sa.Column("dimension_key", sa.String(100), nullable=False),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["evaluation_id"], ["evaluations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("evaluation_id", "dimension_key"),
    )
    op.create_index(
        "ix_evaluation_dimensions_evaluation_id", "evaluation_dimensions", ["evaluation_id"]
    )
    op.create_table(
        "competency_evidence",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("dimension_id", sa.Uuid(), nullable=False),
        sa.Column("message_id", sa.Uuid(), nullable=False),
        sa.Column("quote", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["dimension_id"], ["evaluation_dimensions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["message_id"], ["messages.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_competency_evidence_dimension_id", "competency_evidence", ["dimension_id"])
    op.create_index("ix_competency_evidence_message_id", "competency_evidence", ["message_id"])
    op.create_table(
        "progress_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("course_version_id", sa.Uuid(), nullable=False),
        sa.Column("unit_id", sa.Uuid(), nullable=False),
        sa.Column("completed_attempt_id", sa.Uuid(), nullable=False),
        sa.Column("latest_score", sa.Float(), nullable=False),
        sa.Column("best_score", sa.Float(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["course_version_id"], ["course_versions.id"]),
        sa.ForeignKeyConstraint(["unit_id"], ["training_units.id"]),
        sa.ForeignKeyConstraint(["completed_attempt_id"], ["attempts.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "course_version_id", "unit_id"),
    )
    op.create_index("ix_progress_records_student_id", "progress_records", ["student_id"])
    op.create_index("ix_progress_records_unit_id", "progress_records", ["unit_id"])


def downgrade() -> None:
    op.drop_table("progress_records")
    op.drop_table("competency_evidence")
    op.drop_table("evaluation_dimensions")
    op.drop_table("evaluations")
    op.drop_table("llm_invocations")
    op.drop_table("attempt_events")
    op.drop_table("submissions")
    op.drop_table("messages")
    op.drop_table("scenario_snapshots")
    op.drop_table("attempts")
