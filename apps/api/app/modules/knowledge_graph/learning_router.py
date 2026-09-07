from __future__ import annotations

from typing import Annotated, Literal, cast
from urllib.parse import unquote

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.session import get_db
from app.integrations.knowledge_graph.base import GraphStore
from app.modules.auth.dependencies import Principal, require_roles
from app.modules.knowledge_graph.asset_response import learning_asset_response
from app.modules.knowledge_graph.content_service import ASSET_MAX_BYTES, KnowledgeContentService
from app.modules.knowledge_graph.learning_activity_service import KnowledgeLearningActivityService
from app.modules.knowledge_graph.schemas import (
    LearningActivityRequest,
    LearningActivityResponse,
    LearningContentResponse,
    LearningContentUpdateRequest,
)

router = APIRouter()
Student = Annotated[Principal, Depends(require_roles("student"))]
Teacher = Annotated[Principal, Depends(require_roles("teacher"))]


def _graph_store(request: Request) -> GraphStore:
    return cast(GraphStore, request.app.state.graph_store)


@router.get("/student/content/{node_key}/assets/{kind}")
def student_learning_asset(
    node_key: str,
    kind: Literal["video", "slides"],
    request: Request,
    _: Student,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    asset = KnowledgeContentService(db, _graph_store(request)).asset_binary(
        node_key, kind, student=True
    )
    return learning_asset_response(asset)


@router.get("/teacher/content/{node_key}/assets/{kind}")
def teacher_learning_asset(
    node_key: str,
    kind: Literal["video", "slides"],
    request: Request,
    _: Teacher,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    asset = KnowledgeContentService(db, _graph_store(request)).asset_binary(
        node_key, kind, student=False
    )
    return learning_asset_response(asset)


@router.put("/teacher/content/{node_key}/assets/{kind}", response_model=LearningContentResponse)
async def upload_teacher_learning_asset(
    node_key: str,
    kind: Literal["video", "slides"],
    request: Request,
    principal: Teacher,
    db: Annotated[Session, Depends(get_db)],
    x_file_name: Annotated[str, Header(alias="X-File-Name")] = "learning-asset",
) -> LearningContentResponse:
    content_length = int(request.headers.get("Content-Length", "0") or 0)
    if content_length > ASSET_MAX_BYTES[kind]:
        limit_mb = ASSET_MAX_BYTES[kind] // 1024 // 1024
        raise AppError(
            code="knowledge_graph.asset_too_large",
            message=f"文件超过 {limit_mb} MB 限制。",
            status_code=413,
        )
    content = await request.body()
    return KnowledgeContentService(db, _graph_store(request)).upload_asset(
        node_key, kind, unquote(x_file_name), content, principal.user.id
    )


@router.delete("/teacher/content/{node_key}/assets/{kind}", response_model=LearningContentResponse)
def delete_teacher_learning_asset(
    node_key: str,
    kind: Literal["video", "slides"],
    request: Request,
    _: Teacher,
    db: Annotated[Session, Depends(get_db)],
) -> LearningContentResponse:
    return KnowledgeContentService(db, _graph_store(request)).delete_asset(node_key, kind)


@router.get("/student/content/{node_key}", response_model=LearningContentResponse)
def student_learning_content(
    node_key: str,
    request: Request,
    _: Student,
    db: Annotated[Session, Depends(get_db)],
) -> LearningContentResponse:
    return KnowledgeContentService(db, _graph_store(request)).detail(node_key, student=True)


@router.post(
    "/student/content/{node_key}/activities",
    response_model=LearningActivityResponse,
    status_code=201,
)
def record_student_learning_activity(
    node_key: str,
    payload: LearningActivityRequest,
    request: Request,
    principal: Student,
    db: Annotated[Session, Depends(get_db)],
) -> LearningActivityResponse:
    return KnowledgeLearningActivityService(db, _graph_store(request)).record(
        principal.user, node_key, payload
    )


@router.get("/teacher/content", response_model=list[LearningContentResponse])
def teacher_learning_contents(
    request: Request,
    _: Teacher,
    db: Annotated[Session, Depends(get_db)],
) -> list[LearningContentResponse]:
    return KnowledgeContentService(db, _graph_store(request)).list_for_teacher()


@router.get("/teacher/content/{node_key}", response_model=LearningContentResponse)
def teacher_learning_content(
    node_key: str,
    request: Request,
    _: Teacher,
    db: Annotated[Session, Depends(get_db)],
) -> LearningContentResponse:
    return KnowledgeContentService(db, _graph_store(request)).detail(node_key, student=False)


@router.put("/teacher/content/{node_key}", response_model=LearningContentResponse)
def update_teacher_learning_content(
    node_key: str,
    payload: LearningContentUpdateRequest,
    request: Request,
    principal: Teacher,
    db: Annotated[Session, Depends(get_db)],
) -> LearningContentResponse:
    return KnowledgeContentService(db, _graph_store(request)).update(
        node_key, payload, principal.user.id
    )
