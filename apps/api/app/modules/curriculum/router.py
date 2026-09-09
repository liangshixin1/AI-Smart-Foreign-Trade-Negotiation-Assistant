from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import Principal, require_roles
from app.modules.curriculum.repository import CurriculumRepository
from app.modules.curriculum.schemas import CourseMapResponse, UnitDetailResponse
from app.modules.curriculum.service import CurriculumService

router = APIRouter(prefix="/api/v1", tags=["curriculum"])


@router.get("/courses/current/map", response_model=CourseMapResponse)
def current_map(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    principal: Annotated[Principal, Depends(require_roles("student"))],
) -> CourseMapResponse:
    return CurriculumService(
        CurriculumRepository(db),
        document_correction_enabled=request.app.state.settings.document_correction_enabled,
        document_correction_skip_prerequisite=request.app.state.settings.document_correction_skip_prerequisite,
    ).get_map(principal.user)


@router.get("/units/{unit_id}", response_model=UnitDetailResponse)
def unit_detail(
    unit_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    principal: Annotated[Principal, Depends(require_roles("student"))],
) -> UnitDetailResponse:
    return CurriculumService(
        CurriculumRepository(db),
        request.app.state.settings.simulation_enabled,
        request.app.state.settings.document_correction_enabled,
        request.app.state.settings.document_correction_skip_prerequisite,
    ).get_unit(principal.user, unit_id)
