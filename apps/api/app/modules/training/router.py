from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.llm.base import LLMProvider
from app.modules.assessment.service import AssessmentService
from app.modules.auth.dependencies import Principal, require_roles
from app.modules.training.recovery_service import TrainingRecoveryService
from app.modules.training.schemas import (
    AttemptHistoryItemResponse,
    AttemptResponse,
    CreateAttemptRequest,
    DraftRequest,
    MessageRequest,
)
from app.modules.training.service import TrainingService
from app.modules.training.streaming_service import StreamingConversationService

router = APIRouter(prefix="/api/v1/attempts", tags=["training"])
student_required = require_roles("student")


def _service(request: Request, db: Session) -> TrainingService:
    provider: LLMProvider = request.app.state.llm_provider
    graph_store: GraphStore = request.app.state.graph_store
    return TrainingService(db, provider, graph_store)


def _recovery(request: Request, db: Session) -> TrainingRecoveryService:
    provider: LLMProvider = request.app.state.llm_provider
    graph_store: GraphStore = request.app.state.graph_store
    return TrainingRecoveryService(db, provider, graph_store)


@router.get("", response_model=list[AttemptHistoryItemResponse])
def list_attempts(
    request: Request,
    principal: Annotated[Principal, Depends(student_required)],
    db: Annotated[Session, Depends(get_db)],
) -> list[AttemptHistoryItemResponse]:
    return _recovery(request, db).history(principal.user)


@router.post("", response_model=AttemptResponse, status_code=201)
def create_attempt(
    payload: CreateAttemptRequest,
    request: Request,
    principal: Annotated[Principal, Depends(student_required)],
    db: Annotated[Session, Depends(get_db)],
) -> AttemptResponse:
    return _service(request, db).create_attempt(principal.user, payload)


@router.get("/{attempt_id}", response_model=AttemptResponse)
def get_attempt(
    attempt_id: uuid.UUID,
    request: Request,
    principal: Annotated[Principal, Depends(student_required)],
    db: Annotated[Session, Depends(get_db)],
) -> AttemptResponse:
    return _service(request, db).get_attempt(principal.user, attempt_id)


@router.put("/{attempt_id}/draft", response_model=AttemptResponse)
def save_draft(
    attempt_id: uuid.UUID,
    payload: DraftRequest,
    request: Request,
    principal: Annotated[Principal, Depends(student_required)],
    db: Annotated[Session, Depends(get_db)],
) -> AttemptResponse:
    return _recovery(request, db).save_draft(principal.user, attempt_id, payload)


@router.post("/{attempt_id}/retry", response_model=AttemptResponse, status_code=201)
def retry_attempt(
    attempt_id: uuid.UUID,
    request: Request,
    principal: Annotated[Principal, Depends(student_required)],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=8)],
) -> AttemptResponse:
    return _recovery(request, db).retry(principal.user, attempt_id, idempotency_key)


@router.post("/{attempt_id}/messages", response_model=AttemptResponse)
def send_message(
    attempt_id: uuid.UUID,
    payload: MessageRequest,
    request: Request,
    principal: Annotated[Principal, Depends(student_required)],
    db: Annotated[Session, Depends(get_db)],
) -> AttemptResponse:
    return _service(request, db).send_message(principal.user, attempt_id, payload)


@router.post("/{attempt_id}/messages/stream")
def stream_message(
    attempt_id: uuid.UUID,
    payload: MessageRequest,
    request: Request,
    principal: Annotated[Principal, Depends(student_required)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    provider: LLMProvider = request.app.state.llm_provider
    graph_store: GraphStore = request.app.state.graph_store
    service = StreamingConversationService(db, provider, graph_store)
    context = service.prepare(principal.user, attempt_id, payload)
    return StreamingResponse(
        service.events(context),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{attempt_id}/submit", response_model=AttemptResponse)
def submit_attempt(
    attempt_id: uuid.UUID,
    request: Request,
    principal: Annotated[Principal, Depends(student_required)],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=8)],
) -> AttemptResponse:
    training = _service(request, db)
    attempt, submission = training.begin_submission(principal.user, attempt_id, idempotency_key)
    if attempt.status in {"completed", "evaluation_failed"}:
        return training.get_attempt(principal.user, attempt.id)
    provider: LLMProvider = request.app.state.llm_provider
    return AssessmentService(db, provider).evaluate(principal.user, attempt, submission)


@router.post("/{attempt_id}/evaluation/retry", response_model=AttemptResponse)
def retry_evaluation(
    attempt_id: uuid.UUID,
    request: Request,
    principal: Annotated[Principal, Depends(student_required)],
    db: Annotated[Session, Depends(get_db)],
) -> AttemptResponse:
    training = _service(request, db)
    attempt, submission = training.begin_evaluation_retry(principal.user, attempt_id)
    provider: LLMProvider = request.app.state.llm_provider
    return AssessmentService(db, provider).evaluate(principal.user, attempt, submission)
