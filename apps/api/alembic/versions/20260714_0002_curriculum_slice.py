"""Create curriculum slice and teaching organization.

Revision ID: 20260714_0002
Revises: 20260714_0001
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260714_0002"
down_revision: str | None = "20260714_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "courses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_table(
        "training_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("template_key", sa.String(length=100), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("training_mode", sa.String(length=32), nullable=False),
        sa.Column("input_variables", sa.JSON(), nullable=False),
        sa.Column("workspace_contract", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("template_key", "version"),
    )
    op.create_table(
        "prompt_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("prompt_key", sa.String(length=120), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("training_modes", sa.JSON(), nullable=False),
        sa.Column("input_variables", sa.JSON(), nullable=False),
        sa.Column("output_schema", sa.String(length=120), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("change_log", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("prompt_key", "version"),
    )
    op.create_table(
        "rubrics",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("rubric_key", sa.String(length=100), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("pass_score", sa.Float(), nullable=False),
        sa.Column("dimensions", sa.JSON(), nullable=False),
        sa.Column("hard_fail_rules", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("rubric_key", "version"),
    )
    op.create_table(
        "course_versions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("course_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("source_hash", sa.String(length=64), nullable=False),
        sa.Column("manifest_hash", sa.String(length=64), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("course_id", "version"),
    )
    op.create_table(
        "chapters",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("course_version_id", sa.Uuid(), nullable=False),
        sa.Column("chapter_key", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["course_version_id"], ["course_versions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("course_version_id", "chapter_key"),
    )
    op.create_table(
        "training_units",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("chapter_id", sa.Uuid(), nullable=False),
        sa.Column("unit_key", sa.String(length=120), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("learning_objectives", sa.JSON(), nullable=False),
        sa.Column("training_mode", sa.String(length=32), nullable=False),
        sa.Column("prerequisite_unit_ids", sa.JSON(), nullable=False),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False),
        sa.Column("difficulty_options", sa.JSON(), nullable=False),
        sa.Column("knowledge_tags", sa.JSON(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("template_id", sa.Uuid(), nullable=False),
        sa.Column("rubric_id", sa.Uuid(), nullable=False),
        sa.Column("scenario_prompt_id", sa.Uuid(), nullable=False),
        sa.Column("conversation_prompt_id", sa.Uuid(), nullable=False),
        sa.Column("evaluation_prompt_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["chapter_id"], ["chapters.id"]),
        sa.ForeignKeyConstraint(["template_id"], ["training_templates.id"]),
        sa.ForeignKeyConstraint(["rubric_id"], ["rubrics.id"]),
        sa.ForeignKeyConstraint(["scenario_prompt_id"], ["prompt_templates.id"]),
        sa.ForeignKeyConstraint(["conversation_prompt_id"], ["prompt_templates.id"]),
        sa.ForeignKeyConstraint(["evaluation_prompt_id"], ["prompt_templates.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("chapter_id", "unit_key"),
    )
    op.create_table(
        "classrooms",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("course_version_id", sa.Uuid(), nullable=False),
        sa.Column("owner_teacher_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["course_version_id"], ["course_versions.id"]),
        sa.ForeignKeyConstraint(["owner_teacher_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "enrollments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("classroom_id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["classroom_id"], ["classrooms.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("classroom_id", "student_id"),
    )


def downgrade() -> None:
    op.drop_table("enrollments")
    op.drop_table("classrooms")
    op.drop_table("training_units")
    op.drop_table("chapters")
    op.drop_table("course_versions")
    op.drop_table("rubrics")
    op.drop_table("prompt_templates")
    op.drop_table("training_templates")
    op.drop_table("courses")
