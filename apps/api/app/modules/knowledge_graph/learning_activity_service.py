from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore, StoredGraph
from app.modules.auth.models import User
from app.modules.knowledge_graph.consumption_service import KNOWLEDGE_NODE_TYPES
from app.modules.knowledge_graph.repository import KnowledgeGraphRepository
from app.modules.knowledge_graph.schemas import LearningActivityRequest, LearningActivityResponse
from app.modules.training.models import Attempt


class KnowledgeLearningActivityService:
    """记录可复盘的内容学习行为; 完成状态不交给大模型判断。"""

    def __init__(self, db: Session, graph_store: GraphStore) -> None:
        self.db = db
        self.graph_store = graph_store
        self.repository = KnowledgeGraphRepository(db)

    def record(
        self,
        student: User,
        node_key: str,
        payload: LearningActivityRequest,
    ) -> LearningActivityResponse:
        replay = self.repository.learning_activity_by_client_event(
            student.id, payload.client_event_id
        )
        if replay is not None:
            return LearningActivityResponse.model_validate(replay)

        attempt = self._attempt(student.id, payload.attempt_id)
        graph = self._graph_for(attempt)
        node = next((item for item in graph.nodes if str(item.get("stable_key")) == node_key), None)
        if node is None or str(node.get("type")) not in (
            KNOWLEDGE_NODE_TYPES | {"NegotiationStrategy"}
        ):
            raise AppError(
                code="knowledge_graph.learning_node_not_found",
                message="该知识或策略不属于当前图谱版本。",
                status_code=404,
            )
        if payload.event_type == "completed":
            completed = self.repository.completed_learning_activity(
                student.id, graph.graph_version, node_key
            )
            if completed is not None:
                return LearningActivityResponse.model_validate(completed)
        activity = self.repository.add_learning_activity(
            student_id=student.id,
            graph_version=graph.graph_version,
            node_key=node_key,
            node_type=str(node["type"]),
            event_type=payload.event_type,
            source=payload.source,
            attempt_id=attempt.id if attempt else None,
            client_event_id=payload.client_event_id,
        )
        self.repository.commit()
        self.repository.refresh(activity)
        return LearningActivityResponse.model_validate(activity)

    def _attempt(self, student_id: uuid.UUID, attempt_id: uuid.UUID | None) -> Attempt | None:
        if attempt_id is None:
            return None
        attempt = self.db.get(Attempt, attempt_id)
        if attempt is None or attempt.student_id != student_id:
            raise AppError(
                code="training.attempt_not_found",
                message="训练不存在或无权访问。",
                status_code=404,
            )
        return attempt

    def _graph_for(self, attempt: Attempt | None) -> StoredGraph:
        if attempt is not None:
            version = attempt.content_bindings.get("knowledge_graph_version")
            if version:
                return self._read(str(version))
        publication = self.repository.active_publication()
        if publication is None:
            raise AppError(
                code="knowledge_graph.no_active_publication",
                message="当前没有已发布的知识图谱。",
                status_code=409,
            )
        return self._read(publication.graph_version)

    def _read(self, version: str) -> StoredGraph:
        try:
            graph = self.graph_store.read(version)
        except Exception as exc:
            raise AppError(
                code="knowledge_graph.storage_unavailable",
                message="Neo4j 不可用，暂时无法记录学习进度。",
                status_code=503,
                retryable=True,
            ) from exc
        if not graph.nodes:
            raise AppError(
                code="knowledge_graph.version_not_materialized",
                message="学习内容绑定的图谱版本不存在。",
                status_code=503,
                retryable=True,
            )
        return graph
