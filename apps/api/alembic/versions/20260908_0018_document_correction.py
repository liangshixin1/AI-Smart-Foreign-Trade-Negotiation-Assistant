"""Versioned LC review sessions and immutable operation/result evidence."""

import sqlalchemy as sa

from alembic import op

revision = "20260908_0018"
down_revision = "20260907_0017"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("competency_evidence") as batch:
        batch.alter_column("message_id", existing_type=sa.Uuid(), nullable=True)
        batch.add_column(
            sa.Column("source_type", sa.String(40), nullable=False, server_default="message")
        )
        batch.add_column(sa.Column("source_id", sa.String(120)))
    op.create_table(
        "document_correction_sessions",
        sa.Column("attempt_id", sa.Uuid(), sa.ForeignKey("attempts.id"), primary_key=True),
        *[
            sa.Column(n, sa.JSON(), nullable=False)
            for n in (
                "bindings",
                "case_snapshot",
                "document_snapshot",
                "answer_snapshot",
                "feedback",
            )
        ],
        *[
            sa.Column(n, sa.String(64), nullable=False)
            for n in ("case_hash", "document_hash", "answer_hash")
        ],
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("submitted_revision", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "document_annotations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "attempt_id", sa.Uuid(), sa.ForeignKey("attempts.id"), nullable=False, index=True
        ),
        sa.Column("target_ref", sa.String(120), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("attempt_id", "target_ref"),
    )
    op.create_table(
        "document_operations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "attempt_id", sa.Uuid(), sa.ForeignKey("attempts.id"), nullable=False, index=True
        ),
        sa.Column("client_operation_id", sa.String(120), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("response", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("attempt_id", "client_operation_id"),
    )
    op.create_table(
        "document_correction_results",
        sa.Column("attempt_id", sa.Uuid(), sa.ForeignKey("attempts.id"), primary_key=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("annotation_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    count = (
        op.get_bind()
        .execute(sa.text("SELECT COUNT(*) FROM competency_evidence WHERE message_id IS NULL"))
        .scalar()
    )
    if count:
        raise RuntimeError("存在字段评价证据，请恢复升级前备份；禁止降级丢失证据")
    with op.batch_alter_table("competency_evidence") as batch:
        batch.drop_column("source_id")
        batch.drop_column("source_type")
        batch.alter_column("message_id", existing_type=sa.Uuid(), nullable=False)
    for name in (
        "document_correction_results",
        "document_operations",
        "document_annotations",
        "document_correction_sessions",
    ):
        op.drop_table(name)
