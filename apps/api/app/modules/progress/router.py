from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import Principal, require_roles
from app.modules.training.repository import TrainingRepository
from app.modules.training.schemas import ProgressItemResponse, ProgressResponse

router = APIRouter(prefix="/api/v1/me", tags=["progress"])


@router.get("/progress", response_model=ProgressResponse)
def my_progress(
    principal: Annotated[Principal, Depends(require_roles("student"))],
    db: Annotated[Session, Depends(get_db)],
) -> ProgressResponse:
    repository = TrainingRepository(db)
    records = repository.progress(principal.user.id)
    return ProgressResponse(
        completed_units=len(records),
        items=[
            ProgressItemResponse(
                unit_id=repository.unit(item.unit_id).unit_key,
                completed_attempt_id=item.completed_attempt_id,
                latest_score=item.latest_score,
                best_score=item.best_score,
                completed_at=item.completed_at,
            )
            for item in records
        ],
    )
