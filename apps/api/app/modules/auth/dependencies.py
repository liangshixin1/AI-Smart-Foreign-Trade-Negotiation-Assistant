# [导读] 所属业务: 登录与角色授权。
# [导读] 业务名词: Principal 是已校验的当前访问者; AuthSession 是登录令牌对应的服务端会话。
# [导读] 用途与原因: 从 Bearer 令牌还原登录会话, 再检查有效期、撤销状态和角色; 让接口无需各自重
# [导读] 复实现认证。
# [导读] 结构: Principal、current_principal、require_roles。
# [导读] 提醒: 角色通过只说明可使用这一类接口; 学生归属和教师班级范围仍需在业务查询中核对。
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import hash_token
from app.db.session import get_db
from app.modules.auth.models import AuthSession, User
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import _is_expired, role_codes

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    user: User
    auth_session: AuthSession
    roles: frozenset[str]


# [导读] 先校验令牌对应会话, 再检查撤销、到期和账号状态; 客户端声称的角色不能作为身份依据。
def current_principal(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> Principal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AppError(code="auth.required", message="请先登录。", status_code=401)
    settings: Settings = request.app.state.settings
    token_hash = hash_token(credentials.credentials, settings.auth_token_pepper)
    auth_session = AuthRepository(db).get_session_by_access_hash(token_hash)
    now = datetime.now(UTC)
    if (
        auth_session is None
        or auth_session.revoked_at is not None
        or _is_expired(auth_session.access_expires_at, now)
        or auth_session.user.status != "active"
    ):
        raise AppError(
            code="auth.session_expired",
            message="登录会话已失效，请重新登录。",
            status_code=401,
        )
    return Principal(
        user=auth_session.user,
        auth_session=auth_session,
        roles=frozenset(role_codes(auth_session.user)),
    )


# [导读] 生成可复用的角色依赖; 这是角色级门槛, 资源是否属于当前学生或教师还需业务查询限制。
def require_roles(*allowed_roles: str) -> Callable[[Principal], Principal]:
    def authorize(
        principal: Annotated[Principal, Depends(current_principal)],
    ) -> Principal:
        if principal.roles.isdisjoint(allowed_roles):
            raise AppError(
                code="auth.forbidden",
                message="你没有访问该资源的权限。",
                status_code=403,
            )
        return principal

    return authorize
