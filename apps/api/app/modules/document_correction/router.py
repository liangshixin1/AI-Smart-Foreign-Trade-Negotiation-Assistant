from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import Principal, require_roles
from app.modules.document_correction.annotation_service import AnnotationService
from app.modules.document_correction.schemas import AnnotationInput, RevisionInput
from app.modules.document_correction.support_service import HintInput
from app.modules.teacher_analytics.service import TeacherAnalyticsService
from app.modules.training.access import owned_attempt
from app.modules.training.repository import TrainingRepository

router = APIRouter(tags=["document-correction"])
Student = Annotated[Principal, Depends(require_roles("student"))]
Teacher = Annotated[Principal, Depends(require_roles("teacher"))]
Db = Annotated[Session, Depends(get_db)]
BASE = "/api/v1/attempts/{attempt_id}/document-correction"


def service(
    db: Session, request: Request, principal: Principal, attempt_id: uuid.UUID
) -> AnnotationService:
    owned_attempt(TrainingRepository(db), principal.user, attempt_id)
    return AnnotationService(db, request.app.state.settings.document_correction_enabled)


@router.get(BASE)
def get_document(
    attempt_id: uuid.UUID, request: Request, principal: Student, db: Db
) -> dict[str, Any]:
    return service(db, request, principal, attempt_id).present(attempt_id)


@router.put(BASE + "/annotations/{target_ref}")
def save_annotation(
    attempt_id: uuid.UUID,
    target_ref: str,
    payload: AnnotationInput,
    request: Request,
    principal: Student,
    db: Db,
) -> dict[str, Any]:
    return service(db, request, principal, attempt_id).mutate(attempt_id, target_ref, payload)


@router.delete(BASE + "/annotations/{target_ref}")
def delete_annotation(
    attempt_id: uuid.UUID,
    target_ref: str,
    payload: RevisionInput,
    request: Request,
    principal: Student,
    db: Db,
) -> dict[str, Any]:
    return service(db, request, principal, attempt_id).mutate(attempt_id, target_ref, payload, True)


@router.post(BASE + "/check-completeness")
def check(attempt_id: uuid.UUID, request: Request, principal: Student, db: Db) -> dict[str, Any]:
    return service(db, request, principal, attempt_id).completeness(attempt_id)


@router.get("/api/v1/teacher/attempts/{attempt_id}/document-correction")
def teacher_document(attempt_id: uuid.UUID, principal: Teacher, db: Db) -> dict[str, Any]:
    TeacherAnalyticsService(db, principal.user.id).attempt_replay(attempt_id)
    return AnnotationService(db, False).present(attempt_id, teacher=True)


@router.post(BASE + "/feedback")
@router.post("/api/v1/attempts/{attempt_id}/retry-evaluation")
def generate_feedback(
    attempt_id: uuid.UUID, request: Request, principal: Student, db: Db
) -> dict[str, Any]:
    from app.modules.document_correction.feedback_service import feedback

    service(db, request, principal, attempt_id)
    return feedback(db, request.app.state.llm_provider, attempt_id)


@router.post(BASE + "/hints")
def hint_endpoint(
    attempt_id: uuid.UUID, payload: HintInput, request: Request, principal: Student, db: Db
) -> dict[str, Any]:
    from app.modules.document_correction.support_service import hint

    attempt = owned_attempt(TrainingRepository(db), principal.user, attempt_id)
    return hint(db, request.app.state.graph_store, attempt, payload)


@router.get("/api/v1/technician/document-correction/status")
def environment_status(
    request: Request, principal: Annotated[Principal, Depends(require_roles("technician"))], db: Db
) -> dict[str, Any]:
    from app.modules.document_correction.health import readiness

    return readiness(db, request.app.state.settings.document_correction_enabled)
