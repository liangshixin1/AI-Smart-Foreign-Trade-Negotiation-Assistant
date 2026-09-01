"""Add normalized expert knowledge graph v3 snapshots.

Revision ID: 20260901_0014
Revises: 20260726_0013
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260901_0014"
down_revision: str | None = "20260726_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _versioned_table(
    name: str,
    columns: list[sa.Column[object]],
    constraints: list[object],
) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("change_set_id", sa.Uuid(), nullable=False),
        *columns,
        sa.ForeignKeyConstraint(
            ["change_set_id"], ["knowledge_graph_change_sets.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        *constraints,
    )
    op.create_index(op.f(f"ix_{name}_change_set_id"), name, ["change_set_id"])


def upgrade() -> None:
    op.create_table(
        "knowledge_graph_knowledge_types",
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("name_zh", sa.String(length=40), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("code"),
    )
    types = sa.table(
        "knowledge_graph_knowledge_types",
        sa.column("code", sa.String()),
        sa.column("name_zh", sa.String()),
        sa.column("sort_order", sa.Integer()),
    )
    op.bulk_insert(
        types,
        [
            {"code": "Concept", "name_zh": "概念", "sort_order": 1},
            {"code": "Correspondence", "name_zh": "函电", "sort_order": 2},
            {"code": "Cross-cultural", "name_zh": "跨文化", "sort_order": 3},
            {"code": "Legal", "name_zh": "法律规则", "sort_order": 4},
            {"code": "Procedure", "name_zh": "业务流程", "sort_order": 5},
            {"code": "Risk", "name_zh": "风险管理", "sort_order": 6},
            {"code": "Strategy", "name_zh": "策略战术", "sort_order": 7},
        ],
    )
    _versioned_table(
        "knowledge_graph_stage_snapshots",
        [
            sa.Column("stage_id", sa.String(length=20), nullable=False),
            sa.Column("sequence", sa.Integer(), nullable=False),
            sa.Column("name_en", sa.String(length=255), nullable=False),
            sa.Column("short_en", sa.String(length=120), nullable=False),
            sa.Column("description_en", sa.Text(), nullable=False),
            sa.Column("obe_outcome_en", sa.Text(), nullable=False),
            sa.Column("source_row_number", sa.Integer(), nullable=False),
            sa.Column("source_row_hash", sa.String(length=64), nullable=False),
        ],
        [sa.UniqueConstraint("change_set_id", "stage_id")],
    )
    _versioned_table(
        "knowledge_graph_phenomenon_snapshots",
        [
            sa.Column("phenomenon_id", sa.String(length=20), nullable=False),
            sa.Column("stage_id", sa.String(length=20), nullable=False),
            sa.Column("name_en", sa.String(length=255), nullable=False),
            sa.Column("description_en", sa.Text(), nullable=False),
            sa.Column("risk", sa.String(length=20), nullable=False),
            sa.Column("frequency", sa.String(length=20), nullable=False),
            sa.Column("linked_knowledge_count", sa.Integer(), nullable=False),
            sa.Column("source_row_number", sa.Integer(), nullable=False),
            sa.Column("source_row_hash", sa.String(length=64), nullable=False),
        ],
        [sa.UniqueConstraint("change_set_id", "phenomenon_id")],
    )
    _versioned_table(
        "knowledge_graph_knowledge_point_snapshots",
        [
            sa.Column("knowledge_id", sa.String(length=20), nullable=False),
            sa.Column("knowledge_type_code", sa.String(length=40), nullable=False),
            sa.Column("home_stage_id", sa.String(length=20), nullable=False),
            sa.Column("name_en", sa.String(length=255), nullable=False),
            sa.Column("definition_en", sa.Text(), nullable=False),
            sa.Column("phenomena_served", sa.Integer(), nullable=False),
            sa.Column("stages_served", sa.Integer(), nullable=False),
            sa.Column("source_row_number", sa.Integer(), nullable=False),
            sa.Column("source_row_hash", sa.String(length=64), nullable=False),
        ],
        [
            sa.ForeignKeyConstraint(
                ["knowledge_type_code"], ["knowledge_graph_knowledge_types.code"]
            ),
            sa.UniqueConstraint("change_set_id", "knowledge_id"),
        ],
    )
    _versioned_table(
        "knowledge_graph_phenomenon_knowledge_edges",
        [
            sa.Column("stage_id", sa.String(length=20), nullable=False),
            sa.Column("phenomenon_id", sa.String(length=20), nullable=False),
            sa.Column("knowledge_id", sa.String(length=20), nullable=False),
            sa.Column("addressing_note_en", sa.Text(), nullable=False),
            sa.Column("source_row_number", sa.Integer(), nullable=False),
            sa.Column("source_row_hash", sa.String(length=64), nullable=False),
        ],
        [sa.UniqueConstraint("change_set_id", "phenomenon_id", "knowledge_id")],
    )
    _versioned_table(
        "knowledge_graph_translation_overlays",
        [
            sa.Column("entity_type", sa.String(length=40), nullable=False),
            sa.Column("entity_id", sa.String(length=30), nullable=False),
            sa.Column("field_name", sa.String(length=50), nullable=False),
            sa.Column("locale", sa.String(length=12), nullable=False),
            sa.Column("translated_text", sa.Text(), nullable=False),
            sa.Column("translation_status", sa.String(length=30), nullable=False),
        ],
        [sa.UniqueConstraint("change_set_id", "entity_type", "entity_id", "field_name", "locale")],
    )
    _versioned_table(
        "knowledge_graph_scenario_stage_bindings",
        [
            sa.Column("scenario_id", sa.String(length=30), nullable=False),
            sa.Column("stage_id", sa.String(length=20), nullable=False),
            sa.Column("course_unit_id", sa.String(length=120), nullable=False),
        ],
        [sa.UniqueConstraint("change_set_id", "scenario_id")],
    )
    _versioned_table(
        "knowledge_graph_scenario_phenomenon_bindings",
        [
            sa.Column("scenario_id", sa.String(length=30), nullable=False),
            sa.Column("phenomenon_id", sa.String(length=20), nullable=False),
            sa.Column("mapping_method", sa.String(length=30), nullable=False),
        ],
        [sa.UniqueConstraint("change_set_id", "scenario_id", "phenomenon_id")],
    )
    op.add_column(
        "graph_learning_evidence",
        sa.Column("knowledge_point_node_keys", sa.JSON(), nullable=False, server_default="[]"),
    )
    op.add_column(
        "graph_learning_evidence",
        sa.Column("knowledge_type_breakdown", sa.JSON(), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("graph_learning_evidence", "knowledge_type_breakdown")
    op.drop_column("graph_learning_evidence", "knowledge_point_node_keys")
    for name in (
        "knowledge_graph_scenario_phenomenon_bindings",
        "knowledge_graph_scenario_stage_bindings",
        "knowledge_graph_translation_overlays",
        "knowledge_graph_phenomenon_knowledge_edges",
        "knowledge_graph_knowledge_point_snapshots",
        "knowledge_graph_phenomenon_snapshots",
        "knowledge_graph_stage_snapshots",
    ):
        op.drop_table(name)
    op.drop_table("knowledge_graph_knowledge_types")
