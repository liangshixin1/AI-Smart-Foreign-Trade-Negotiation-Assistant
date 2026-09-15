# [导读] 所属业务: 信用证结构化审改。
# [导读] 业务名词: 信用证是银行按约定单据付款的承诺; MT700 是本项目采用的信用证报文样式; 批注是
# [导读] 学生提出的改证意见。
# [导读] 用途: 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。
# [导读] 为什么: 接口层尽量只做请求转接和响应组装, 使业务规则能在服务层复用; 调整参数时需同步前
# [导读] 端 API 与 schemas。
# [导读] 结构: service、get_document、save_annotation、delete_annotation、check、
# [导读] teacher_document、gen
# [导读] erate_feedback、hint_endpoint。
# [导读] 提醒: 原证与标准答案以快照保存; 学生只改批注。成绩由版本化本地规则计算, 模型仅生成额外
# [导读] 讲评。
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


# [导读] 承接 GET BASE; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相信客户端传入
# [导读] 的用户编号。
@router.get(BASE)
def get_document(
    attempt_id: uuid.UUID, request: Request, principal: Student, db: Db
) -> dict[str, Any]:
    return service(db, request, principal, attempt_id).present(attempt_id)


# [导读] 承接 PUT BASE + '/annotations/{target_ref}'; 身份来自依赖注入, 业务归属限制仍由下方查询
# [导读] 或服务核对, 不能相信客户端传入的用户编号。
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


# [导读] 承接 DELETE BASE +
# [导读] '/annotations/{target_ref}'; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能
# [导读] 相信客户端传入的用户编号。
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


# [导读] 承接 POST BASE + '/check-completeness'; 身份来自依赖注入, 业务归属限制仍由下方查询或服
# [导读] 务核对, 不能相信客户端传入的用户编号。
@router.post(BASE + "/check-completeness")
def check(attempt_id: uuid.UUID, request: Request, principal: Student, db: Db) -> dict[str, Any]:
    return service(db, request, principal, attempt_id).completeness(attempt_id)


# [导读] 承接 GET /api/v1/teacher/attempts/{attempt_id}/document-correction; 身份来自依赖注入,
# [导读] 业务归属限制仍由下方
# [导读] 查询或服务核对, 不能相信客户端传入的用户编号。
@router.get("/api/v1/teacher/attempts/{attempt_id}/document-correction")
def teacher_document(attempt_id: uuid.UUID, principal: Teacher, db: Db) -> dict[str, Any]:
    TeacherAnalyticsService(db, principal.user.id).attempt_replay(attempt_id)
    return AnnotationService(db, False).present(attempt_id, teacher=True)


# [导读] 承接 POST BASE + '/feedback'; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不
# [导读] 能相信客户端传入的用户编号。
@router.post(BASE + "/feedback")
@router.post("/api/v1/attempts/{attempt_id}/retry-evaluation")
def generate_feedback(
    attempt_id: uuid.UUID, request: Request, principal: Student, db: Db
) -> dict[str, Any]:
    from app.modules.document_correction.feedback_service import feedback

    service(db, request, principal, attempt_id)
    return feedback(db, request.app.state.llm_provider, attempt_id)


# [导读] 承接 POST BASE + '/hints'; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相
# [导读] 信客户端传入的用户编号。
@router.post(BASE + "/hints")
def hint_endpoint(
    attempt_id: uuid.UUID, payload: HintInput, request: Request, principal: Student, db: Db
) -> dict[str, Any]:
    from app.modules.document_correction.support_service import hint

    attempt = owned_attempt(TrainingRepository(db), principal.user, attempt_id)
    return hint(db, request.app.state.graph_store, attempt, payload)


# [导读] 承接 GET /api/v1/technician/document-correction/status; 身份来自依赖注入, 业务归属限制
# [导读] 仍由下方查询或服务核对, 不能相信
# [导读] 客户端传入的用户编号。
@router.get("/api/v1/technician/document-correction/status")
def environment_status(
    request: Request, principal: Annotated[Principal, Depends(require_roles("technician"))], db: Db
) -> dict[str, Any]:
    from app.modules.document_correction.health import readiness

    return readiness(db, request.app.state.settings.document_correction_enabled)
