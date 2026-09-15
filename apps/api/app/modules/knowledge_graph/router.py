# [导读] 所属业务: 教学知识图谱、学习内容与证据。
# [导读] 业务名词: 图谱用节点与关系表达阶段、商务现象、知识点和策略; Scaffold 是本次训练固定的学
# [导读] 习支持库。
# [导读] 用途: 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。
# [导读] 为什么: 接口层尽量只做请求转接和响应组装, 使业务规则能在服务层复用; 调整参数时需同步前
# [导读] 端 API 与 schemas。
# [导读] 结构: _graph_store、_services、_job_response、_is_technician、download_template、
# [导读] upload_work
# [导读] book、import_detail、validation_issues。
# [导读] 提醒: graph_version 与 node_key 一起定位内容; 显示短名不等于稳定编号, 历史证据不能随当
# [导读] 前图谱重写。
from __future__ import annotations

import uuid
from pathlib import Path
from typing import Annotated, cast
from urllib.parse import unquote

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.session import get_db
from app.integrations.knowledge_graph.base import GraphStore
from app.modules.auth.dependencies import Principal, require_roles
from app.modules.knowledge_graph.consumption_service import KnowledgeGraphConsumptionService
from app.modules.knowledge_graph.display_service import KnowledgeNodeDisplayService
from app.modules.knowledge_graph.import_service import KnowledgeImportService
from app.modules.knowledge_graph.insights_service import KnowledgeGraphInsightsService
from app.modules.knowledge_graph.learning_router import router as learning_router
from app.modules.knowledge_graph.repository import KnowledgeGraphRepository
from app.modules.knowledge_graph.review_service import KnowledgeReviewService
from app.modules.knowledge_graph.scaffold_service import KnowledgeScaffoldService
from app.modules.knowledge_graph.schemas import (
    GraphChangeSetResponse,
    GraphViewResponse,
    ImportJobResponse,
    NodeDisplayMutationResponse,
    NodeDisplayRestoreRequest,
    NodeDisplayUpdateRequest,
    PublicationResponse,
    ReviewDecisionRequest,
    ScaffoldEventRequest,
    ScaffoldInteractionResponse,
    StudentScaffoldResponse,
    TeacherKnowledgeInsightsResponse,
    ValidationIssueResponse,
)

router = APIRouter(prefix="/api/v1/knowledge-graph", tags=["knowledge-graph"])
router.include_router(learning_router)
Contributor = Annotated[Principal, Depends(require_roles("teacher", "technician"))]
Technician = Annotated[Principal, Depends(require_roles("technician"))]
Student = Annotated[Principal, Depends(require_roles("student"))]
Teacher = Annotated[Principal, Depends(require_roles("teacher"))]
TEMPLATE_PATH = (
    Path(__file__).resolve().parents[5]
    / "content"
    / "knowledge-graph"
    / "templates"
    / "expert-knowledge-graph-v3.xlsx"
)


def _graph_store(request: Request) -> GraphStore:
    return cast(GraphStore, request.app.state.graph_store)


def _services(
    request: Request, db: Session
) -> tuple[KnowledgeImportService, KnowledgeReviewService]:
    repository = KnowledgeGraphRepository(db)
    return KnowledgeImportService(repository), KnowledgeReviewService(
        repository, _graph_store(request)
    )


def _job_response(job: object, idempotent: bool = False) -> ImportJobResponse:
    response = ImportJobResponse.model_validate(job)
    return response.model_copy(update={"idempotent_replay": idempotent})


def _is_technician(principal: Principal) -> bool:
    return "technician" in principal.roles


# [导读] 承接 GET /templates/teacher-case/latest; 身份来自依赖注入, 业务归属限制仍由下方查询或服
# [导读] 务核对, 不能相信客户端传入的用户编号。
@router.get("/templates/teacher-case/latest")
def download_template(_: Contributor) -> FileResponse:
    return FileResponse(
        TEMPLATE_PATH,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="expert-knowledge-graph-v3.xlsx",
    )


# [导读] 承接 POST /imports; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相信客户
# [导读] 端传入的用户编号。
@router.post("/imports", response_model=ImportJobResponse, status_code=201)
async def upload_workbook(
    request: Request,
    principal: Contributor,
    db: Annotated[Session, Depends(get_db)],
    x_file_name: Annotated[str, Header(alias="X-File-Name")] = "teacher-case.xlsx",
    x_template_version: Annotated[str, Header(alias="X-Template-Version")] = "3.1",
) -> ImportJobResponse:
    content_length = int(request.headers.get("Content-Length", "0") or 0)
    if content_length > 5 * 1024 * 1024:
        raise AppError(
            code="knowledge_graph.file_too_large",
            message="文件超过 5 MB 限制。",
            status_code=413,
        )
    content = await request.body()
    importer, _ = _services(request, db)
    job, idempotent = importer.import_workbook(
        actor_id=principal.user.id,
        filename=unquote(x_file_name),
        content=content,
        template_version=x_template_version,
    )
    return _job_response(job, idempotent)


# [导读] 承接 GET /imports/{job_id}; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能
# [导读] 相信客户端传入的用户编号。
@router.get("/imports/{job_id}", response_model=ImportJobResponse)
def import_detail(
    job_id: uuid.UUID,
    request: Request,
    principal: Contributor,
    db: Annotated[Session, Depends(get_db)],
) -> ImportJobResponse:
    importer, _ = _services(request, db)
    job = importer.require_import(
        job_id, principal.user.id, is_technician=_is_technician(principal)
    )
    return _job_response(job)


# [导读] 承接 GET /imports/{job_id}/issues; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对
# [导读] , 不能相信客户端传入的用户编号。
@router.get("/imports/{job_id}/issues", response_model=list[ValidationIssueResponse])
def validation_issues(
    job_id: uuid.UUID,
    request: Request,
    principal: Contributor,
    db: Annotated[Session, Depends(get_db)],
) -> list[ValidationIssueResponse]:
    importer, _ = _services(request, db)
    importer.require_import(job_id, principal.user.id, is_technician=_is_technician(principal))
    return [
        ValidationIssueResponse.model_validate(issue)
        for issue in importer.repository.issues(job_id)
    ]


# [导读] 承接 GET /imports/{job_id}/change-set; 身份来自依赖注入, 业务归属限制仍由下方查询或服务
# [导读] 核对, 不能相信客户端传入的用户编号。
@router.get("/imports/{job_id}/change-set", response_model=GraphChangeSetResponse)
def import_change_set(
    job_id: uuid.UUID,
    request: Request,
    principal: Contributor,
    db: Annotated[Session, Depends(get_db)],
) -> GraphChangeSetResponse:
    importer, _ = _services(request, db)
    change_set = importer.change_set_for_import(
        job_id, principal.user.id, is_technician=_is_technician(principal)
    )
    return GraphChangeSetResponse.model_validate(change_set)


# [导读] 承接 GET /imports/{job_id}/teaching-preview; 身份来自依赖注入, 业务归属限制仍由下方查询
# [导读] 或服务核对, 不能相信客户端传入的用户编号。
@router.get("/imports/{job_id}/teaching-preview", response_model=list[dict[str, object]])
def teaching_preview(
    job_id: uuid.UUID,
    request: Request,
    principal: Contributor,
    db: Annotated[Session, Depends(get_db)],
) -> list[dict[str, object]]:
    importer, _ = _services(request, db)
    change_set = importer.change_set_for_import(
        job_id, principal.user.id, is_technician=_is_technician(principal)
    )
    return change_set.teaching_preview


# [导读] 承接 POST /change-sets/{change_set_id}/submit-review; 身份来自依赖注入, 业务归属限制仍
# [导读] 由下方查询或服务核对, 不能相信客户
# [导读] 端传入的用户编号。
@router.post("/change-sets/{change_set_id}/submit-review", response_model=GraphChangeSetResponse)
def submit_review(
    change_set_id: uuid.UUID,
    request: Request,
    principal: Contributor,
    db: Annotated[Session, Depends(get_db)],
) -> GraphChangeSetResponse:
    importer, reviewer = _services(request, db)
    change_set = reviewer.require_change_set(change_set_id)
    importer.require_import(
        change_set.import_job_id,
        principal.user.id,
        is_technician=_is_technician(principal),
    )
    return GraphChangeSetResponse.model_validate(
        reviewer.submit_review(change_set, principal.user.id)
    )


# [导读] 承接 POST
# [导读] /change-sets/{change_set_id}/decision; 身份来自依赖注入, 业务归属限制仍由下方查询或服务
# [导读] 核对, 不能相信客户端传入的用户编号。
@router.post("/change-sets/{change_set_id}/decision", response_model=GraphChangeSetResponse)
def decide_change_set(
    change_set_id: uuid.UUID,
    payload: ReviewDecisionRequest,
    request: Request,
    principal: Technician,
    db: Annotated[Session, Depends(get_db)],
) -> GraphChangeSetResponse:
    _, reviewer = _services(request, db)
    change_set = reviewer.require_change_set(change_set_id)
    return GraphChangeSetResponse.model_validate(
        reviewer.decide(change_set, principal.user.id, payload.decision, payload.reason)
    )


# [导读] 承接 POST
# [导读] /change-sets/{change_set_id}/publish; 身份来自依赖注入, 业务归属限制仍由下方查询或服务
# [导读] 核对, 不能相信客户端传入的用户编号。
@router.post("/change-sets/{change_set_id}/publish", response_model=PublicationResponse)
def publish_change_set(
    change_set_id: uuid.UUID,
    request: Request,
    principal: Technician,
    db: Annotated[Session, Depends(get_db)],
) -> PublicationResponse:
    _, reviewer = _services(request, db)
    return PublicationResponse.model_validate(
        reviewer.publish(reviewer.require_change_set(change_set_id), principal.user.id)
    )


# [导读] 承接 GET /publications/active; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不
# [导读] 能相信客户端传入的用户编号。
@router.get("/publications/active", response_model=PublicationResponse | None)
def active_publication(
    _: Technician, db: Annotated[Session, Depends(get_db)]
) -> PublicationResponse | None:
    publication = KnowledgeGraphRepository(db).active_publication()
    return PublicationResponse.model_validate(publication) if publication else None


# [导读] 承接 POST
# [导读] /publications/{publication_id}/rollback; 身份来自依赖注入, 业务归属限制仍由下方查询或服
# [导读] 务核对, 不能相信客户端传入的用户编号。
@router.post("/publications/{publication_id}/rollback", response_model=PublicationResponse)
def rollback_publication(
    publication_id: uuid.UUID,
    request: Request,
    principal: Technician,
    db: Annotated[Session, Depends(get_db)],
) -> PublicationResponse:
    repository = KnowledgeGraphRepository(db)
    publication = repository.get_publication(publication_id)
    if publication is None:
        raise AppError(
            code="knowledge_graph.publication_not_found",
            message="找不到该演示版本。",
            status_code=404,
        )
    return PublicationResponse.model_validate(
        KnowledgeReviewService(repository, _graph_store(request)).rollback(
            publication, principal.user.id
        )
    )


# [导读] 承接 GET
# [导读] /student/attempts/{attempt_id}/scaffolds; 身份来自依赖注入, 业务归属限制仍由下方查询或
# [导读] 服务核对, 不能相信客户端传入的用户编号。
@router.get(
    "/student/attempts/{attempt_id}/scaffolds",
    response_model=StudentScaffoldResponse,
)
def student_scaffolds(
    attempt_id: uuid.UUID,
    request: Request,
    principal: Student,
    db: Annotated[Session, Depends(get_db)],
) -> StudentScaffoldResponse:
    return KnowledgeScaffoldService(db, _graph_store(request)).student_scaffolds(
        principal.user, attempt_id
    )


# [导读] 承接 POST /student/attempts/{attempt_id}/scaffold-events; 身份来自依赖注入, 业务归属限
# [导读] 制仍由下方查询或服务核对, 不能
# [导读] 相信客户端传入的用户编号。
@router.post(
    "/student/attempts/{attempt_id}/scaffold-events",
    response_model=ScaffoldInteractionResponse,
    status_code=201,
)
def record_scaffold_event(
    attempt_id: uuid.UUID,
    payload: ScaffoldEventRequest,
    request: Request,
    principal: Student,
    db: Annotated[Session, Depends(get_db)],
) -> ScaffoldInteractionResponse:
    return KnowledgeScaffoldService(db, _graph_store(request)).record_event(
        principal.user, attempt_id, payload
    )


# [导读] 承接 GET /teacher/graph; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相信
# [导读] 客户端传入的用户编号。
@router.get("/teacher/graph", response_model=GraphViewResponse)
def teacher_graph(
    request: Request,
    _: Teacher,
    db: Annotated[Session, Depends(get_db)],
) -> GraphViewResponse:
    return KnowledgeGraphConsumptionService(db, _graph_store(request)).teacher_graph()


# [导读] 承接 GET /student/graph; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相信
# [导读] 客户端传入的用户编号。
@router.get("/student/graph", response_model=GraphViewResponse)
def student_graph(
    request: Request,
    _: Student,
    db: Annotated[Session, Depends(get_db)],
) -> GraphViewResponse:
    return KnowledgeGraphConsumptionService(db, _graph_store(request)).student_graph()


# [导读] 承接 GET
# [导读] /student/attempts/{attempt_id}/graph; 身份来自依赖注入, 业务归属限制仍由下方查询或服务
# [导读] 核对, 不能相信客户端传入的用户编号。
@router.get("/student/attempts/{attempt_id}/graph", response_model=GraphViewResponse)
def student_attempt_graph(
    attempt_id: uuid.UUID,
    request: Request,
    principal: Student,
    db: Annotated[Session, Depends(get_db)],
) -> GraphViewResponse:
    return KnowledgeGraphConsumptionService(db, _graph_store(request)).student_attempt_graph(
        principal.user.id, attempt_id
    )


# [导读] 承接 GET
# [导读] /teacher/attempts/{attempt_id}/graph; 身份来自依赖注入, 业务归属限制仍由下方查询或服务
# [导读] 核对, 不能相信客户端传入的用户编号。
@router.get("/teacher/attempts/{attempt_id}/graph", response_model=GraphViewResponse)
def teacher_attempt_graph(
    attempt_id: uuid.UUID,
    request: Request,
    principal: Teacher,
    db: Annotated[Session, Depends(get_db)],
) -> GraphViewResponse:
    return KnowledgeGraphConsumptionService(db, _graph_store(request)).teacher_attempt_graph(
        principal.user.id, attempt_id
    )


# [导读] 承接 PUT /teacher/nodes/{node_key}/display; 身份来自依赖注入, 业务归属限制仍由下方查询
# [导读] 或服务核对, 不能相信客户端传入的用户编号。
@router.put(
    "/teacher/nodes/{node_key}/display",
    response_model=NodeDisplayMutationResponse,
)
def update_node_display(
    node_key: str,
    payload: NodeDisplayUpdateRequest,
    request: Request,
    principal: Teacher,
    db: Annotated[Session, Depends(get_db)],
) -> NodeDisplayMutationResponse:
    return KnowledgeNodeDisplayService(db, _graph_store(request)).update(
        node_key, payload, principal.user.id
    )


# [导读] 承接 POST
# [导读] /teacher/nodes/{node_key}/display/restore; 身份来自依赖注入, 业务归属限制仍由下方查询或
# [导读] 服务核对, 不能相信客户端传入的用户编号。
@router.post(
    "/teacher/nodes/{node_key}/display/restore",
    response_model=NodeDisplayMutationResponse,
)
def restore_node_display(
    node_key: str,
    payload: NodeDisplayRestoreRequest,
    request: Request,
    principal: Teacher,
    db: Annotated[Session, Depends(get_db)],
) -> NodeDisplayMutationResponse:
    return KnowledgeNodeDisplayService(db, _graph_store(request)).restore(
        node_key, payload, principal.user.id
    )


# [导读] 承接 GET /student/me/insights; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不
# [导读] 能相信客户端传入的用户编号。
@router.get("/student/me/insights", response_model=TeacherKnowledgeInsightsResponse)
def own_knowledge_insights(
    request: Request,
    principal: Student,
    db: Annotated[Session, Depends(get_db)],
) -> TeacherKnowledgeInsightsResponse:
    return KnowledgeGraphInsightsService(db, _graph_store(request)).own(principal.user.id)


# [导读] 承接 GET /teacher/classrooms/{classroom_id}/insights; 身份来自依赖注入, 业务归属限制仍
# [导读] 由下方查询或服务核对, 不能相信客户
# [导读] 端传入的用户编号。
@router.get(
    "/teacher/classrooms/{classroom_id}/insights",
    response_model=TeacherKnowledgeInsightsResponse,
)
def classroom_knowledge_insights(
    classroom_id: uuid.UUID,
    request: Request,
    principal: Teacher,
    db: Annotated[Session, Depends(get_db)],
) -> TeacherKnowledgeInsightsResponse:
    return KnowledgeGraphInsightsService(db, _graph_store(request)).classroom(
        principal.user.id, classroom_id
    )


# [导读] 承接 GET
# [导读] /teacher/students/{student_id}/insights; 身份来自依赖注入, 业务归属限制仍由下方查询或服
# [导读] 务核对, 不能相信客户端传入的用户编号。
@router.get(
    "/teacher/students/{student_id}/insights",
    response_model=TeacherKnowledgeInsightsResponse,
)
def student_knowledge_insights(
    student_id: uuid.UUID,
    request: Request,
    principal: Teacher,
    db: Annotated[Session, Depends(get_db)],
) -> TeacherKnowledgeInsightsResponse:
    return KnowledgeGraphInsightsService(db, _graph_store(request)).student(
        principal.user.id, student_id
    )
