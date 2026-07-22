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
