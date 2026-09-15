# [导读] 所属业务: 教学知识图谱、学习内容与证据。
# [导读] 业务名词: 图谱用节点与关系表达阶段、商务现象、知识点和策略; Scaffold 是本次训练固定的学
# [导读] 习支持库。
# [导读] 用途与原因: 承接节点正文、附件及学习事件 HTTP 请求; 学生和教师的内容可见性不同, 必须保
# [导读] 留各入口的角色校验。
# [导读] 结构: _graph_store、student_learning_asset、teacher_learning_asset、
# [导读] upload_teacher_learnin
# [导读] g_asset、delete_teacher_learning_asset、student_learning_content、record_student_learni
# [导读] ng_activity、teacher_learning_contents。
# [导读] 提醒: graph_version 与 node_key 一起定位内容; 显示短名不等于稳定编号, 历史证据不能随当
# [导读] 前图谱重写。
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


# [导读] 承接 GET
# [导读] /student/content/{node_key}/assets/{kind}; 身份来自依赖注入, 业务归属限制仍由下方查询或
# [导读] 服务核对, 不能相信客户端传入的用户编号。
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


# [导读] 承接 GET
# [导读] /teacher/content/{node_key}/assets/{kind}; 身份来自依赖注入, 业务归属限制仍由下方查询或
# [导读] 服务核对, 不能相信客户端传入的用户编号。
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


# [导读] 承接 PUT
# [导读] /teacher/content/{node_key}/assets/{kind}; 身份来自依赖注入, 业务归属限制仍由下方查询或
# [导读] 服务核对, 不能相信客户端传入的用户编号。
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


# [导读] 承接 DELETE
# [导读] /teacher/content/{node_key}/assets/{kind}; 身份来自依赖注入, 业务归属限制仍由下方查询或
# [导读] 服务核对, 不能相信客户端传入的用户编号。
@router.delete("/teacher/content/{node_key}/assets/{kind}", response_model=LearningContentResponse)
def delete_teacher_learning_asset(
    node_key: str,
    kind: Literal["video", "slides"],
    request: Request,
    _: Teacher,
    db: Annotated[Session, Depends(get_db)],
) -> LearningContentResponse:
    return KnowledgeContentService(db, _graph_store(request)).delete_asset(node_key, kind)


# [导读] 承接 GET /student/content/{node_key}; 身份来自依赖注入, 业务归属限制仍由下方查询或服务
# [导读] 核对, 不能相信客户端传入的用户编号。
@router.get("/student/content/{node_key}", response_model=LearningContentResponse)
def student_learning_content(
    node_key: str,
    request: Request,
    _: Student,
    db: Annotated[Session, Depends(get_db)],
) -> LearningContentResponse:
    return KnowledgeContentService(db, _graph_store(request)).detail(node_key, student=True)


# [导读] 承接 POST
# [导读] /student/content/{node_key}/activities; 身份来自依赖注入, 业务归属限制仍由下方查询或服
# [导读] 务核对, 不能相信客户端传入的用户编号。
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


# [导读] 承接 GET /teacher/content; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相
# [导读] 信客户端传入的用户编号。
@router.get("/teacher/content", response_model=list[LearningContentResponse])
def teacher_learning_contents(
    request: Request,
    _: Teacher,
    db: Annotated[Session, Depends(get_db)],
) -> list[LearningContentResponse]:
    return KnowledgeContentService(db, _graph_store(request)).list_for_teacher()


# [导读] 承接 GET /teacher/content/{node_key}; 身份来自依赖注入, 业务归属限制仍由下方查询或服务
# [导读] 核对, 不能相信客户端传入的用户编号。
@router.get("/teacher/content/{node_key}", response_model=LearningContentResponse)
def teacher_learning_content(
    node_key: str,
    request: Request,
    _: Teacher,
    db: Annotated[Session, Depends(get_db)],
) -> LearningContentResponse:
    return KnowledgeContentService(db, _graph_store(request)).detail(node_key, student=False)


# [导读] 承接 PUT /teacher/content/{node_key}; 身份来自依赖注入, 业务归属限制仍由下方查询或服务
# [导读] 核对, 不能相信客户端传入的用户编号。
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
