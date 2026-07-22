from __future__ import annotations

import uuid
from pathlib import Path
from typing import Annotated, Literal, cast
from urllib.parse import quote, unquote

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.session import get_db
from app.integrations.knowledge_graph.base import GraphStore
from app.modules.auth.dependencies import Principal, require_roles
from app.modules.knowledge_graph.consumption_service import KnowledgeGraphConsumptionService
from app.modules.knowledge_graph.content_service import ASSET_MAX_BYTES, KnowledgeContentService
from app.modules.knowledge_graph.import_service import KnowledgeImportService
from app.modules.knowledge_graph.models import KnowledgeContentAsset
from app.modules.knowledge_graph.repository import KnowledgeGraphRepository
from app.modules.knowledge_graph.review_service import KnowledgeReviewService
from app.modules.knowledge_graph.scaffold_service import KnowledgeScaffoldService
from app.modules.knowledge_graph.schemas import (
    GraphChangeSetResponse,
    GraphViewResponse,
    ImportJobResponse,
    LearningContentResponse,
    LearningContentUpdateRequest,
    PublicationResponse,
    ReviewDecisionRequest,
    ScaffoldEventRequest,
    ScaffoldInteractionResponse,
    StudentScaffoldResponse,
    TeacherKnowledgeInsightsResponse,
    ValidationIssueResponse,
)

router = APIRouter(prefix="/api/v1/knowledge-graph", tags=["knowledge-graph"])
Contributor = Annotated[Principal, Depends(require_roles("teacher", "technician"))]
Technician = Annotated[Principal, Depends(require_roles("technician"))]
Student = Annotated[Principal, Depends(require_roles("student"))]
Teacher = Annotated[Principal, Depends(require_roles("teacher"))]
TEMPLATE_PATH = (
    Path(__file__).resolve().parents[5]
    / "content"
    / "knowledge-graph"
    / "templates"
    / "teacher-knowledge-graph-v2.xlsx"
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


@router.get("/templates/teacher-case/latest")
def download_template(_: Contributor) -> FileResponse:
    return FileResponse(
        TEMPLATE_PATH,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="teacher-knowledge-graph-v2.xlsx",
    )


@router.post("/imports", response_model=ImportJobResponse, status_code=201)
async def upload_workbook(
    request: Request,
    principal: Contributor,
    db: Annotated[Session, Depends(get_db)],
    x_file_name: Annotated[str, Header(alias="X-File-Name")] = "teacher-case.xlsx",
    x_template_version: Annotated[str, Header(alias="X-Template-Version")] = "2.0",
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


@router.get("/publications/active", response_model=PublicationResponse | None)
def active_publication(
    _: Technician, db: Annotated[Session, Depends(get_db)]
) -> PublicationResponse | None:
    publication = KnowledgeGraphRepository(db).active_publication()
    return PublicationResponse.model_validate(publication) if publication else None


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


@router.get("/teacher/graph", response_model=GraphViewResponse)
def teacher_graph(
    request: Request,
    _: Teacher,
    db: Annotated[Session, Depends(get_db)],
) -> GraphViewResponse:
    return KnowledgeGraphConsumptionService(db, _graph_store(request)).teacher_graph()


@router.get("/student/graph", response_model=GraphViewResponse)
def student_graph(
    request: Request,
    _: Student,
    db: Annotated[Session, Depends(get_db)],
) -> GraphViewResponse:
    return KnowledgeGraphConsumptionService(db, _graph_store(request)).student_graph()


def _asset_response(asset: KnowledgeContentAsset) -> Response:
    filename = quote(asset.filename)
    return Response(
        content=asset.content,
        media_type=asset.content_type,
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{filename}",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


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
    return _asset_response(asset)


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
    return _asset_response(asset)


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
        node_key,
        kind,
        unquote(x_file_name),
        content,
        principal.user.id,
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
    return KnowledgeGraphConsumptionService(db, _graph_store(request)).classroom_insights(
        principal.user.id, classroom_id
    )


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
    return KnowledgeGraphConsumptionService(db, _graph_store(request)).student_insights(
        principal.user.id, student_id
    )
