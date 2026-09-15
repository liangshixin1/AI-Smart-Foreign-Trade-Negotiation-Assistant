# [导读] 所属业务: 教学知识图谱、学习内容与证据。
# [导读] 业务名词: 图谱用节点与关系表达阶段、商务现象、知识点和策略; Scaffold 是本次训练固定的学
# [导读] 习支持库。
# [导读] 用途与原因: 通过现有导入、评审和发布流程迁移 PI 十阶段分类; 只延续编辑内容与附件, 不挪
# [导读] 动历史学生证据。
# [导读] 结构: carry_pi_content、migrate_pi_stages。
# [导读] 提醒: graph_version 与 node_key 一起定位内容; 显示短名不等于稳定编号, 历史证据不能随当
# [导读] 前图谱重写。
"""Local PI rollout using the existing versioned import/review/publication workflow."""

from __future__ import annotations

import uuid
from copy import deepcopy
from typing import cast

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.knowledge_graph.base import GraphStore
from app.modules.knowledge_graph.import_service import KnowledgeImportService
from app.modules.knowledge_graph.models import (
    KnowledgeContentAsset,
    KnowledgeGraphPublication,
    KnowledgeLearningContent,
    KnowledgeNodeDisplayOverride,
    KnowledgeWorkbookAsset,
)
from app.modules.knowledge_graph.pi_stages import PI_COMPILER_VERSION
from app.modules.knowledge_graph.repository import KnowledgeGraphRepository


# [导读] 在发布的 SQL 事务中复制可延续的教师内容与附件; 学生学习事件和评价证据仍保留原版本。
def carry_pi_content(
    db: Session,
    previous: KnowledgeGraphPublication | None,
    publication: KnowledgeGraphPublication,
) -> dict[str, object]:
    """Copy editorial assets, never student evidence; called in the publication transaction."""
    if previous is None:
        return {"copied": {}, "skipped": []}
    nodes = publication.graph_payload.get("nodes", [])
    keys = (
        {str(n["stable_key"]) for n in nodes if isinstance(n, dict)}
        if isinstance(nodes, list)
        else set()
    )
    # S9 used to mean complaints AND claims. Its editorial material needs manual separation.
    previous_nodes = previous.graph_payload.get("nodes", [])
    previous_is_pi = isinstance(previous_nodes, list) and any(
        isinstance(node, dict) and node.get("stable_key") == "stage:S10" for node in previous_nodes
    )
    if not previous_is_pi:
        keys.discard("stage:S9")
    copied: dict[str, int] = {}
    skipped: list[dict[str, str]] = []
    for model in (KnowledgeLearningContent, KnowledgeContentAsset, KnowledgeNodeDisplayOverride):
        count = 0
        for raw_item in db.scalars(
            select(model).where(model.graph_version == previous.graph_version)
        ):
            item = cast(
                KnowledgeLearningContent | KnowledgeContentAsset | KnowledgeNodeDisplayOverride,
                raw_item,
            )
            # All stage display aliases may hide the newly requested canonical names.
            if item.node_key not in keys or (
                model is KnowledgeNodeDisplayOverride and item.node_key.startswith("stage:")
            ):
                skipped.append({"table": model.__tablename__, "node_key": item.node_key})
                continue
            values = {
                column.key: deepcopy(getattr(item, column.key))
                for column in model.__table__.columns
                if column.key not in {"id", "graph_version"}
            }
            db.add(model(**values, graph_version=publication.graph_version))
            count += 1
        copied[model.__tablename__] = count
    return {"source_graph_version": previous.graph_version, "copied": copied, "skipped": skipped}


# [导读] 沿正式导入、评审、发布入口创建新版本, 而不是直接修改当前图或归档源文件。
def migrate_pi_stages(
    db: Session,
    graph_store: GraphStore,
    actor_id: uuid.UUID,
) -> KnowledgeGraphPublication:
    # Import locally to avoid a review-service / migration helper cycle.
    from app.modules.knowledge_graph.review_service import KnowledgeReviewService

    repository = KnowledgeGraphRepository(db)
    active = repository.active_publication()
    if active is None:
        raise ValueError("No active publication; import the expert source using PI 3.1 first.")
    source_change = repository.get_change_set(active.change_set_id)
    if source_change is None:
        raise ValueError("Active publication has no source change set.")
    if source_change.compiler_version == PI_COMPILER_VERSION:
        return active
    source_job = repository.get_import(source_change.import_job_id)
    if source_job is None or source_job.template_version != "3.0":
        raise ValueError("Automatic PI migration requires an active expert 3.0 source.")
    asset = db.scalar(
        select(KnowledgeWorkbookAsset).where(KnowledgeWorkbookAsset.import_job_id == source_job.id)
    )
    if asset is None:
        raise ValueError("Original workbook asset is missing; migration stopped.")
    job, _ = KnowledgeImportService(repository).import_workbook(
        actor_id=actor_id,
        filename=source_job.source_filename,
        content=asset.content,
        template_version="3.1",
    )
    change = repository.change_set_for_import(job.id)
    if change is None or job.error_count:
        raise ValueError("Source validation failed; active graph has not changed.")
    review = KnowledgeReviewService(repository, graph_store)
    if change.status == "review_ready":
        review.submit_review(change, actor_id)
    if change.status == "in_review":
        review.decide(change, actor_id, "approve", None)
    return review.publish(change, actor_id)
