# [导读] 所属业务: 一次训练从创建到提交的生命周期。
# [导读] 业务名词: Attempt 是一次训练记录; Scenario 是该次训练的场景; Submission 是正式提交时冻
# [导读] 结的内容快照。
# [导读] 用途: 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。
# [导读] 为什么: 接口层尽量只做请求转接和响应组装, 使业务规则能在服务层复用; 调整参数时需同步前
# [导读] 端 API 与 schemas。
# [导读] 结构: _service、_recovery、list_attempts、create_attempt、get_attempt、save_draft、
# [导读] retry_atte
# [导读] mpt、send_message。
# [导读] 提醒: 重练创建新 Attempt, 重试评价沿用原提交; 场景 private 部分是对手底牌, 不得放入学生
# [导读] 响应。
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
from app.modules.document_correction.schemas import SubmitInput
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
    return TrainingService(
        db,
        provider,
        graph_store,
        request.app.state.settings.simulation_enabled,
        request.app.state.settings.document_correction_enabled,
        request.app.state.settings.document_correction_skip_prerequisite,
    )


def _recovery(request: Request, db: Session) -> TrainingRecoveryService:
    provider: LLMProvider = request.app.state.llm_provider
    graph_store: GraphStore = request.app.state.graph_store
    return TrainingRecoveryService(
        db,
        provider,
        graph_store,
        request.app.state.settings.simulation_enabled,
        request.app.state.settings.document_correction_enabled,
        request.app.state.settings.document_correction_skip_prerequisite,
    )


# [导读] 承接 GET ; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相信客户端传入的用
# [导读] 户编号。
@router.get("", response_model=list[AttemptHistoryItemResponse])
def list_attempts(
    request: Request,
    principal: Annotated[Principal, Depends(student_required)],
    db: Annotated[Session, Depends(get_db)],
) -> list[AttemptHistoryItemResponse]:
    return _recovery(request, db).history(principal.user)


# [导读] 承接 POST ; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相信客户端传入的
# [导读] 用户编号。
@router.post("", response_model=AttemptResponse, status_code=201)
def create_attempt(
    payload: CreateAttemptRequest,
    request: Request,
    principal: Annotated[Principal, Depends(student_required)],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[
        str | None, Header(alias="Idempotency-Key", min_length=8, max_length=120)
    ] = None,
) -> AttemptResponse:
    return _service(request, db).create_attempt(principal.user, payload, idempotency_key)


# [导读] 承接 GET /{attempt_id}; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相信
# [导读] 客户端传入的用户编号。
@router.get("/{attempt_id}", response_model=AttemptResponse)
def get_attempt(
    attempt_id: uuid.UUID,
    request: Request,
    principal: Annotated[Principal, Depends(student_required)],
    db: Annotated[Session, Depends(get_db)],
) -> AttemptResponse:
    return _service(request, db).get_attempt(principal.user, attempt_id)


# [导读] 承接 PUT /{attempt_id}/draft; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不
# [导读] 能相信客户端传入的用户编号。
@router.put("/{attempt_id}/draft", response_model=AttemptResponse)
def save_draft(
    attempt_id: uuid.UUID,
    payload: DraftRequest,
    request: Request,
    principal: Annotated[Principal, Depends(student_required)],
    db: Annotated[Session, Depends(get_db)],
) -> AttemptResponse:
    return _recovery(request, db).save_draft(principal.user, attempt_id, payload)


# [导读] 承接 POST /{attempt_id}/retry; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不
# [导读] 能相信客户端传入的用户编号。
@router.post("/{attempt_id}/retry", response_model=AttemptResponse, status_code=201)
def retry_attempt(
    attempt_id: uuid.UUID,
    request: Request,
    principal: Annotated[Principal, Depends(student_required)],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=8)],
) -> AttemptResponse:
    return _recovery(request, db).retry(principal.user, attempt_id, idempotency_key)


# [导读] 承接 POST /{attempt_id}/messages; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对,
# [导读] 不能相信客户端传入的用户编号。
@router.post("/{attempt_id}/messages", response_model=AttemptResponse)
def send_message(
    attempt_id: uuid.UUID,
    payload: MessageRequest,
    request: Request,
    principal: Annotated[Principal, Depends(student_required)],
    db: Annotated[Session, Depends(get_db)],
) -> AttemptResponse:
    return _service(request, db).send_message(principal.user, attempt_id, payload)


# [导读] 承接 POST /{attempt_id}/messages/stream; 身份来自依赖注入, 业务归属限制仍由下方查询或服
# [导读] 务核对, 不能相信客户端传入的用户编号。
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


# [导读] 承接 POST /{attempt_id}/submit; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对,
# [导读] 不能相信客户端传入的用户编号。
@router.post("/{attempt_id}/submit", response_model=AttemptResponse)
def submit_attempt(
    attempt_id: uuid.UUID,
    request: Request,
    principal: Annotated[Principal, Depends(student_required)],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=8)],
    payload: SubmitInput | None = None,
) -> AttemptResponse:
    training = _service(request, db)
    current = training.get_attempt(principal.user, attempt_id)
    if current.workspace_kind == "lc_correction":
        from app.modules.document_correction.grading_service import submit
        from app.modules.document_correction.profile_service import error

        if payload is None:
            raise error("revision_required", "提交需要当前已保存版本。", 422)
        return submit(
            db,
            principal.user,
            attempt_id,
            idempotency_key,
            payload.expected_revision,
            request.app.state.settings.document_correction_enabled,
        )
    attempt, submission = training.begin_submission(principal.user, attempt_id, idempotency_key)
    if attempt.status in {"completed", "evaluation_failed"}:
        return training.get_attempt(principal.user, attempt.id)
    provider: LLMProvider = request.app.state.llm_provider
    return AssessmentService(db, provider).evaluate(principal.user, attempt, submission)


# [导读] 承接 POST /{attempt_id}/evaluation/retry; 身份来自依赖注入, 业务归属限制仍由下方查询或
# [导读] 服务核对, 不能相信客户端传入的用户编号。
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
