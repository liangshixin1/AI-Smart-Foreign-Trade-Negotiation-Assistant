from __future__ import annotations

import uuid
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.llm.base import LLMProvider
from app.modules.auth.dependencies import Principal, require_roles
from app.modules.simulation.schemas import SimulationResponse
from app.modules.simulation.service import SimulationService

student_router = APIRouter(prefix="/api/v1/attempts", tags=["simulation"])
teacher_router = APIRouter(prefix="/api/v1/teacher/attempts", tags=["simulation"])
Student = Annotated[Principal, Depends(require_roles("student"))]
Teacher = Annotated[Principal, Depends(require_roles("teacher"))]
Db = Annotated[Session, Depends(get_db)]


@student_router.get("/{attempt_id}/simulation", response_model=SimulationResponse)
def student_simulation(attempt_id: uuid.UUID, principal: Student, db: Db) -> SimulationResponse:
    return SimulationService(db).student_get(principal.user, attempt_id)


@student_router.post(
    "/{attempt_id}/simulation/messages/{assistant_message_id}/retry-analysis",
    response_model=SimulationResponse,
)
def retry_analysis(
    attempt_id: uuid.UUID,
    assistant_message_id: uuid.UUID,
    request: Request,
    principal: Student,
    db: Db,
) -> SimulationResponse:
    provider = cast(LLMProvider, request.app.state.llm_provider)
    graph_store = cast(GraphStore, request.app.state.graph_store)
    return SimulationService(db, provider, graph_store).retry_analysis(
        principal.user, attempt_id, assistant_message_id
    )


@teacher_router.get("/{attempt_id}/simulation", response_model=SimulationResponse)
def teacher_simulation(attempt_id: uuid.UUID, principal: Teacher, db: Db) -> SimulationResponse:
    return SimulationService(db).teacher_get(principal.user.id, attempt_id)
