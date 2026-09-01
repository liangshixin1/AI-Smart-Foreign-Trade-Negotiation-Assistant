from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Never

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore
from app.modules.knowledge_graph.consumption_service import (
    LABEL_FIELDS,
    SHORT_LABEL_FIELDS,
    TEACHER_VISIBLE_NODE_TYPES,
)
from app.modules.knowledge_graph.models import KnowledgeNodeDisplayOverride
from app.modules.knowledge_graph.repository import KnowledgeGraphRepository
from app.modules.knowledge_graph.schemas import (
    NodeDisplayMutationResponse,
    NodeDisplayRestoreRequest,
    NodeDisplayUpdateRequest,
)


@dataclass(frozen=True)
class DisplayNode:
    graph_version: str
    node_key: str
    base_short_label: str


class KnowledgeNodeDisplayService:
    """维护图谱展示覆盖层; 原始图谱与 Agent 提示上下文保持不可变."""

    def __init__(self, db: Session, graph_store: GraphStore) -> None:
        self.db = db
        self.graph_store = graph_store
        self.repository = KnowledgeGraphRepository(db)

    def update(
        self,
        node_key: str,
        payload: NodeDisplayUpdateRequest,
        actor_id: uuid.UUID,
    ) -> NodeDisplayMutationResponse:
        node = self._active_node(payload.graph_version, node_key)
        override = self.repository.display_override(payload.graph_version, node_key)
        current_revision = override.revision if override else 0
        if payload.expected_revision != current_revision:
            self._raise_conflict()
        if override and override.short_name_zh == payload.short_name_zh:
            return self._response(node, override)
        if override is None and payload.short_name_zh == node.base_short_label:
            return self._response(node, None)

        previous_label = override.short_name_zh if override else node.base_short_label
        if override is None:
            override = self.repository.add_display_override(
                graph_version=payload.graph_version,
                node_key=node_key,
                short_name_zh=payload.short_name_zh,
                actor_id=actor_id,
            )
        else:
            override.short_name_zh = payload.short_name_zh
            override.updated_by_user_id = actor_id
        self.repository.audit(
            actor_id,
            "graph.node_display_updated",
            "knowledge_node",
            node_key,
            {
                "graph_version": payload.graph_version,
                "field": "ShortNameZH",
                "previous_value": previous_label,
                "new_value": payload.short_name_zh,
                "previous_revision": current_revision,
            },
        )
        self._commit_or_conflict()
        self.repository.refresh(override)
        return self._response(node, override)

    def restore(
        self,
        node_key: str,
        payload: NodeDisplayRestoreRequest,
        actor_id: uuid.UUID,
    ) -> NodeDisplayMutationResponse:
        node = self._active_node(payload.graph_version, node_key)
        override = self.repository.display_override(payload.graph_version, node_key)
        if override is None or override.revision != payload.expected_revision:
            self._raise_conflict()
        previous_value = override.short_name_zh
        previous_revision = override.revision
        self.db.delete(override)
        self.repository.audit(
            actor_id,
            "graph.node_display_restored",
            "knowledge_node",
            node_key,
            {
                "graph_version": payload.graph_version,
                "field": "ShortNameZH",
                "previous_value": previous_value,
                "new_value": node.base_short_label,
                "previous_revision": previous_revision,
            },
        )
        self._commit_or_conflict()
        return self._response(node, None)

    def _active_node(self, graph_version: str, node_key: str) -> DisplayNode:
        publication = self.repository.active_publication()
        if publication is None:
            raise AppError(
                code="knowledge_graph.no_active_publication",
                message="当前没有已发布的知识图谱。",
                status_code=409,
            )
        if publication.graph_version != graph_version:
            raise AppError(
                code="knowledge_graph.display_graph_version_changed",
                message="图谱版本已经更新，请刷新页面后再修改。",
                status_code=409,
                retryable=True,
            )
        try:
            graph = self.graph_store.read(graph_version)
        except Exception as exc:
            raise AppError(
                code="knowledge_graph.storage_unavailable",
                message="Neo4j 不可用，暂时无法核对节点。",
                status_code=503,
                retryable=True,
            ) from exc
        raw_node = next(
            (
                item
                for item in graph.nodes
                if str(item.get("stable_key")) == node_key
                and item.get("type") in TEACHER_VISIBLE_NODE_TYPES
            ),
            None,
        )
        if raw_node is None:
            raise AppError(
                code="knowledge_graph.display_node_not_found",
                message="节点不存在、已失效或不允许快捷编辑。",
                status_code=404,
            )
        properties = raw_node.get("properties")
        normalized = properties if isinstance(properties, dict) else {}
        formal_label = next(
            (str(normalized[key]) for key in LABEL_FIELDS if normalized.get(key)),
            node_key,
        )
        base_short_label = next(
            (str(normalized[key]) for key in SHORT_LABEL_FIELDS if normalized.get(key)),
            formal_label,
        )
        return DisplayNode(
            graph_version=graph_version,
            node_key=node_key,
            base_short_label=base_short_label,
        )

    def _commit_or_conflict(self) -> None:
        try:
            self.repository.commit()
        except (IntegrityError, StaleDataError) as exc:
            self.db.rollback()
            raise AppError(
                code="knowledge_graph.display_revision_conflict",
                message="该中文短名已被其他教师修改，请刷新后重试。",
                status_code=409,
                retryable=True,
            ) from exc

    @staticmethod
    def _raise_conflict() -> Never:
        raise AppError(
            code="knowledge_graph.display_revision_conflict",
            message="该中文短名已被其他教师修改，请刷新后重试。",
            status_code=409,
            retryable=True,
        )

    @staticmethod
    def _response(
        node: DisplayNode, override: KnowledgeNodeDisplayOverride | None
    ) -> NodeDisplayMutationResponse:
        return NodeDisplayMutationResponse(
            graph_version=node.graph_version,
            node_id=node.node_key,
            short_label=override.short_name_zh if override else node.base_short_label,
            revision=override.revision if override else 0,
            has_override=override is not None,
            updated_at=override.updated_at if override else None,
        )
