# [导读] 所属业务: 登录与角色授权。
# [导读] 业务名词: Principal 是已校验的当前访问者; AuthSession 是登录令牌对应的服务端会话。
# [导读] 用途: 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。
# [导读] 为什么: 接口层尽量只做请求转接和响应组装, 使业务规则能在服务层复用; 调整参数时需同步前
# [导读] 端 API 与 schemas。
# [导读] 结构: auth_service、login、refresh、logout、me。
# [导读] 提醒: 角色通过只说明可使用这一类接口; 学生归属和教师班级范围仍需在业务查询中核对。
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.session import get_db
from app.modules.auth.dependencies import Principal, current_principal
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import (
    LoginRequest,
    MeResponse,
    RefreshRequest,
    TokenPairResponse,
)
from app.modules.auth.service import AuthService, user_summary

router = APIRouter(prefix="/api/v1", tags=["auth"])


def auth_service(request: Request, db: Session) -> AuthService:
    settings: Settings = request.app.state.settings
    return AuthService(AuthRepository(db), settings)


# [导读] 承接 POST /auth/login; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相信客
# [导读] 户端传入的用户编号。
@router.post("/auth/login", response_model=TokenPairResponse)
def login(
    payload: LoginRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> TokenPairResponse:
    return auth_service(request, db).login(payload.identifier, payload.password)


# [导读] 承接 POST /auth/refresh; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相信
# [导读] 客户端传入的用户编号。
@router.post("/auth/refresh", response_model=TokenPairResponse)
def refresh(
    payload: RefreshRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> TokenPairResponse:
    return auth_service(request, db).refresh(payload.refresh_token)


# [导读] 承接 POST /auth/logout; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相信
# [导读] 客户端传入的用户编号。
@router.post("/auth/logout", status_code=204)
def logout(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    principal: Annotated[Principal, Depends(current_principal)],
) -> Response:
    auth_service(request, db).logout(principal.auth_session)
    return Response(status_code=204)


# [导读] 承接 GET /me; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相信客户端传入
# [导读] 的用户编号。
@router.get("/me", response_model=MeResponse)
def me(principal: Annotated[Principal, Depends(current_principal)]) -> MeResponse:
    return MeResponse(user=user_summary(principal.user))
