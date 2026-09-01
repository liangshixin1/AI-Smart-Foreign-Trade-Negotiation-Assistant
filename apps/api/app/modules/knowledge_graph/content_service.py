from __future__ import annotations

import uuid
import zipfile
from io import BytesIO
from pathlib import Path
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.integrations.knowledge_graph.base import GraphStore, StoredGraph
from app.modules.knowledge_graph.consumption_service import (
    KNOWLEDGE_NODE_TYPES,
    KnowledgeGraphConsumptionService,
)
from app.modules.knowledge_graph.models import KnowledgeContentAsset, KnowledgeLearningContent
from app.modules.knowledge_graph.schemas import (
    LearningAssetResponse,
    LearningContentResponse,
    LearningContentUpdateRequest,
)

CONTENT_NODE_TYPES = KNOWLEDGE_NODE_TYPES | {"NegotiationStrategy"}
AssetKind = Literal["video", "slides"]
ASSET_MAX_BYTES = {"video": 100 * 1024 * 1024, "slides": 30 * 1024 * 1024}
VIDEO_TYPES = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogv": "video/ogg",
}
SLIDES_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation"


class KnowledgeContentService:
    def __init__(self, db: Session, graph_store: GraphStore) -> None:
        self.db = db
        self.consumption = KnowledgeGraphConsumptionService(db, graph_store)

    def list_for_teacher(self) -> list[LearningContentResponse]:
        graph = self.consumption._active_graph()
        return [self._response(graph, node, student=False) for node in self._content_nodes(graph)]

    def detail(self, node_key: str, *, student: bool) -> LearningContentResponse:
        graph = self.consumption._active_graph()
        node = self._require_node(graph, node_key)
        response = self._response(graph, node, student=student)
        if student and response.status != "published":
            raise AppError(
                code="knowledge_graph.content_not_published",
                message="该学习内容尚未发布。",
                status_code=404,
            )
        return response

    def update(
        self,
        node_key: str,
        payload: LearningContentUpdateRequest,
        actor_id: uuid.UUID,
    ) -> LearningContentResponse:
        graph = self.consumption._active_graph()
        node = self._require_node(graph, node_key)
        overlay = self.db.scalar(
            select(KnowledgeLearningContent).where(
                KnowledgeLearningContent.graph_version == graph.graph_version,
                KnowledgeLearningContent.node_key == node_key,
            )
        )
        if overlay is None:
            overlay = KnowledgeLearningContent(
                graph_version=graph.graph_version,
                node_key=node_key,
                node_type=str(node["type"]),
                updated_by_user_id=actor_id,
                **payload.model_dump(),
            )
            self.db.add(overlay)
        else:
            for key, value in payload.model_dump().items():
                setattr(overlay, key, value)
            overlay.updated_by_user_id = actor_id
        self.db.commit()
        self.db.refresh(overlay)
        return self._response(graph, node, student=False)

    def upload_asset(
        self,
        node_key: str,
        kind: AssetKind,
        filename: str,
        content: bytes,
        actor_id: uuid.UUID,
    ) -> LearningContentResponse:
        graph = self.consumption._active_graph()
        node = self._require_node(graph, node_key)
        safe_name, content_type = self._validate_asset(kind, filename, content)
        asset = self.db.scalar(
            select(KnowledgeContentAsset).where(
                KnowledgeContentAsset.graph_version == graph.graph_version,
                KnowledgeContentAsset.node_key == node_key,
                KnowledgeContentAsset.asset_kind == kind,
            )
        )
        if asset is None:
            asset = KnowledgeContentAsset(
                graph_version=graph.graph_version,
                node_key=node_key,
                asset_kind=kind,
                filename=safe_name,
                content_type=content_type,
                size_bytes=len(content),
                content=content,
                uploaded_by_user_id=actor_id,
            )
            self.db.add(asset)
        else:
            asset.filename = safe_name
            asset.content_type = content_type
            asset.size_bytes = len(content)
            asset.content = content
            asset.uploaded_by_user_id = actor_id
        self.db.commit()
        return self._response(graph, node, student=False)

    def delete_asset(self, node_key: str, kind: AssetKind) -> LearningContentResponse:
        graph = self.consumption._active_graph()
        node = self._require_node(graph, node_key)
        asset = self._asset(graph.graph_version, node_key, kind)
        if asset is None:
            raise AppError(
                code="knowledge_graph.asset_not_found",
                message="该教学资源尚未上传。",
                status_code=404,
            )
        self.db.delete(asset)
        self.db.commit()
        return self._response(graph, node, student=False)

    def asset_binary(
        self, node_key: str, kind: AssetKind, *, student: bool
    ) -> KnowledgeContentAsset:
        graph = self.consumption._active_graph()
        self._require_node(graph, node_key)
        if student:
            self.detail(node_key, student=True)
        asset = self._asset(graph.graph_version, node_key, kind)
        if asset is None:
            raise AppError(
                code="knowledge_graph.asset_not_found",
                message="该教学资源尚未上传。",
                status_code=404,
            )
        return asset

    def _asset(
        self, graph_version: str, node_key: str, kind: AssetKind
    ) -> KnowledgeContentAsset | None:
        return self.db.scalar(
            select(KnowledgeContentAsset).where(
                KnowledgeContentAsset.graph_version == graph_version,
                KnowledgeContentAsset.node_key == node_key,
                KnowledgeContentAsset.asset_kind == kind,
            )
        )

    def _asset_responses(self, graph_version: str, node_key: str) -> list[LearningAssetResponse]:
        assets = self.db.scalars(
            select(KnowledgeContentAsset)
            .where(
                KnowledgeContentAsset.graph_version == graph_version,
                KnowledgeContentAsset.node_key == node_key,
            )
            .order_by(KnowledgeContentAsset.asset_kind)
        ).all()
        responses: list[LearningAssetResponse] = []
        for asset in assets:
            if asset.asset_kind not in {"video", "slides"}:
                raise RuntimeError(f"Unsupported stored asset kind: {asset.asset_kind}")
            kind: AssetKind = "video" if asset.asset_kind == "video" else "slides"
            responses.append(
                LearningAssetResponse(
                    id=asset.id,
                    kind=kind,
                    filename=asset.filename,
                    content_type=asset.content_type,
                    size_bytes=asset.size_bytes,
                    updated_at=asset.updated_at,
                )
            )
        return responses

    @staticmethod
    def _validate_asset(kind: AssetKind, filename: str, content: bytes) -> tuple[str, str]:
        safe_name = Path(filename.replace("\\", "/")).name.strip()
        if not safe_name or len(safe_name) > 255:
            raise AppError(
                code="knowledge_graph.asset_filename_invalid",
                message="文件名无效或超过 255 个字符。",
                status_code=422,
            )
        if not content:
            raise AppError(
                code="knowledge_graph.asset_empty",
                message="不能上传空文件。",
                status_code=422,
            )
        if len(content) > ASSET_MAX_BYTES[kind]:
            limit_mb = ASSET_MAX_BYTES[kind] // 1024 // 1024
            raise AppError(
                code="knowledge_graph.asset_too_large",
                message=f"文件超过 {limit_mb} MB 限制。",
                status_code=413,
            )
        suffix = Path(safe_name).suffix.lower()
        if kind == "video":
            content_type = VIDEO_TYPES.get(suffix)
            signatures_ok = {
                ".mp4": len(content) >= 12 and content[4:8] == b"ftyp",
                ".webm": content.startswith(b"\x1a\x45\xdf\xa3"),
                ".ogv": content.startswith(b"OggS"),
            }
            if content_type is None or not signatures_ok.get(suffix, False):
                raise AppError(
                    code="knowledge_graph.video_invalid",
                    message="仅支持可验证的 MP4、WebM 或 OGV 视频。",
                    status_code=422,
                )
            return safe_name, content_type
        if suffix != ".pptx":
            raise AppError(
                code="knowledge_graph.slides_format_invalid",
                message="仅支持 PPTX；请将旧版 .ppt 另存为 .pptx 后上传。",
                status_code=422,
            )
        try:
            with zipfile.ZipFile(BytesIO(content)) as archive:
                names = set(archive.namelist())
                valid_pptx = "[Content_Types].xml" in names and "ppt/presentation.xml" in names
        except zipfile.BadZipFile:
            valid_pptx = False
        if not valid_pptx:
            raise AppError(
                code="knowledge_graph.slides_invalid",
                message="文件不是有效的 PPTX 演示文稿。",
                status_code=422,
            )
        return safe_name, SLIDES_TYPE

    @staticmethod
    def _content_nodes(graph: StoredGraph) -> list[dict[str, object]]:
        return sorted(
            (node for node in graph.nodes if node.get("type") in CONTENT_NODE_TYPES),
            key=lambda node: str(node["stable_key"]),
        )

    @classmethod
    def _require_node(cls, graph: StoredGraph, node_key: str) -> dict[str, object]:
        node = next(
            (item for item in cls._content_nodes(graph) if str(item.get("stable_key")) == node_key),
            None,
        )
        if node is None:
            raise AppError(
                code="knowledge_graph.content_not_found",
                message="找不到该知识或策略内容。",
                status_code=404,
            )
        return node

    def _response(
        self, graph: StoredGraph, node: dict[str, object], *, student: bool
    ) -> LearningContentResponse:
        node_key = str(node["stable_key"])
        overlay = self.db.scalar(
            select(KnowledgeLearningContent).where(
                KnowledgeLearningContent.graph_version == graph.graph_version,
                KnowledgeLearningContent.node_key == node_key,
            )
        )
        if overlay is not None:
            return LearningContentResponse(
                graph_version=graph.graph_version,
                node_id=node_key,
                node_type=overlay.node_type,
                title=overlay.title,
                summary=overlay.summary,
                markdown_body=overlay.markdown_body,
                assets=self._asset_responses(graph.graph_version, node_key),
                status="published" if overlay.status == "published" else "draft",
                updated_at=overlay.updated_at,
            )
        raw = node.get("properties")
        properties = raw if isinstance(raw, dict) else {}
        title = str(
            properties.get("Title")
            or properties.get("KnowledgeNameZH")
            or properties.get("ResourceName")
            or properties.get("StrategyName")
            or properties.get("标题（必填）")
            or properties.get("策略名称（必填）")
            or node_key
        )
        default_status = (
            "published" if properties.get("translation_status") == "reviewed" else "draft"
        )
        status = str(properties.get("ContentStatus", default_status))
        summary = str(properties.get("Summary") or properties.get("DefinitionZH") or "")
        markdown_body = str(properties.get("MarkdownContent") or "")
        if not markdown_body and summary:
            markdown_body = f"## {title}\n\n{summary}"
        return LearningContentResponse(
            graph_version=graph.graph_version,
            node_id=node_key,
            node_type=str(node["type"]),
            title=title,
            summary=summary,
            markdown_body=markdown_body,
            assets=self._asset_responses(graph.graph_version, node_key),
            status="published" if status == "published" else "draft",
            updated_at=None,
        )
