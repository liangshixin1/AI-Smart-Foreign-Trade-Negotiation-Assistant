# [导读] 用途: 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。
# [导读] 本次变更: 建立教师图谱导入、变更集、评审及发布记录, 保存教学内容进入系统的证据链。
# [导读] 为什么: models.py 改动不会自动更新旧数据库, 必须沿修订链升级才能匹配应用代码。
# [导读] 结构: revision 与 down_revision 标识顺序; upgrade 升级, downgrade 定义反向操作。
# [导读] 提醒: 迁移涉及真实数据库; 降级可能删除表或列, 不能当作无损撤销。
"""Add teacher DSL import, review and demo graph publication tables.

Revision ID: 20260720_0007
Revises: 20260716_0006
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260720_0007"
down_revision: str | None = "20260716_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# [导读] 沿本修订执行表结构升级; 保留 revision 链使成员可从旧库顺序升级。
def upgrade() -> None:
    op.create_table(
        "knowledge_import_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("template_version", sa.String(30), nullable=False),
        sa.Column("source_filename", sa.String(255), nullable=False),
        sa.Column("source_hash", sa.String(64), nullable=False),
        sa.Column("source_size", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("error_count", sa.Integer(), nullable=False),
        sa.Column("warning_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_kg_import_hash", "knowledge_import_jobs", ["source_hash"])
    op.create_index("ix_kg_import_owner", "knowledge_import_jobs", ["uploaded_by_user_id"])
    op.create_index("ix_kg_import_status", "knowledge_import_jobs", ["status"])
    op.create_table(
        "knowledge_workbook_assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("import_job_id", sa.Uuid(), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("content_type", sa.String(120), nullable=False),
        sa.ForeignKeyConstraint(
            ["import_job_id"], ["knowledge_import_jobs.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("import_job_id"),
    )
    op.create_table(
        "knowledge_validation_issues",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("import_job_id", sa.Uuid(), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("code", sa.String(80), nullable=False),
        sa.Column("sheet_name", sa.String(80), nullable=False),
        sa.Column("row_number", sa.Integer()),
        sa.Column("column_name", sa.String(120)),
        sa.Column("message", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["import_job_id"], ["knowledge_import_jobs.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_kg_issue_job", "knowledge_validation_issues", ["import_job_id"])
    op.create_index("ix_kg_issue_severity", "knowledge_validation_issues", ["severity"])
    op.create_table(
        "knowledge_graph_change_sets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("import_job_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("compiler_version", sa.String(80), nullable=False),
        sa.Column("teaching_preview", sa.JSON(), nullable=False),
        sa.Column("nodes", sa.JSON(), nullable=False),
        sa.Column("relationships", sa.JSON(), nullable=False),
        sa.Column("summary", sa.JSON(), nullable=False),
        sa.Column("reviewed_by_user_id", sa.Uuid()),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("rejection_reason", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["import_job_id"], ["knowledge_import_jobs.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["reviewed_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("import_job_id"),
    )
    op.create_index("ix_kg_change_status", "knowledge_graph_change_sets", ["status"])
    op.create_table(
        "knowledge_graph_publications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("change_set_id", sa.Uuid(), nullable=False),
        sa.Column("graph_version", sa.String(80), nullable=False),
        sa.Column("environment", sa.String(30), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("storage_backend", sa.String(50), nullable=False),
        sa.Column("graph_payload", sa.JSON(), nullable=False),
        sa.Column("published_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("rolled_back_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(["change_set_id"], ["knowledge_graph_change_sets.id"]),
        sa.ForeignKeyConstraint(["published_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("change_set_id"),
        sa.UniqueConstraint("graph_version"),
    )
    op.create_index("ix_kg_publication_active", "knowledge_graph_publications", ["is_active"])
    op.create_index(
        "ix_kg_publication_environment", "knowledge_graph_publications", ["environment"]
    )
    op.create_index("ix_kg_publication_status", "knowledge_graph_publications", ["status"])
    op.create_table(
        "knowledge_graph_audit_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("target_type", sa.String(50), nullable=False),
        sa.Column("target_id", sa.String(80), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_kg_audit_action", "knowledge_graph_audit_events", ["action"])
    op.create_index("ix_kg_audit_actor", "knowledge_graph_audit_events", ["actor_user_id"])


# [导读] 按反向顺序撤销本修订结构; 涉及 drop 时会丢失相应数据, 不能当作无损撤销。
def downgrade() -> None:
    op.drop_table("knowledge_graph_audit_events")
    op.drop_table("knowledge_graph_publications")
    op.drop_table("knowledge_graph_change_sets")
    op.drop_table("knowledge_validation_issues")
    op.drop_table("knowledge_workbook_assets")
    op.drop_table("knowledge_import_jobs")
