# [导读] 用途: 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。
# [导读] 本次变更: 扩展流式消息与逐轮评价记录, 将单轮反馈和正式总评区分保存。
# [导读] 为什么: models.py 改动不会自动更新旧数据库, 必须沿修订链升级才能匹配应用代码。
# [导读] 结构: revision 与 down_revision 标识顺序; upgrade 升级, downgrade 定义反向操作。
# [导读] 提醒: 迁移涉及真实数据库; 降级可能删除表或列, 不能当作无损撤销。
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


# [导读] 沿本修订执行表结构升级; 保留 revision 链使成员可从旧库顺序升级。
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


# [导读] 按反向顺序撤销本修订结构; 涉及 drop 时会丢失相应数据, 不能当作无损撤销。
def downgrade() -> None:
    op.drop_table("round_evaluations")
    with op.batch_alter_table("training_units") as batch_op:
        batch_op.drop_constraint("fk_training_units_round_evaluation_prompt", type_="foreignkey")
        batch_op.drop_column("round_evaluation_prompt_id")
