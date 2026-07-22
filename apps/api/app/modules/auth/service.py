from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import hash_token, new_token, verify_password
from app.modules.auth.models import AuthSession, User
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import TokenPairResponse, UserSummary


def role_codes(user: User) -> list[str]:
    return sorted(user_role.role.code for user_role in user.user_roles)


def user_summary(user: User) -> UserSummary:
    return UserSummary(
        id=user.id,
        email=user.email,
        student_no=user.student_no,
        display_name=user.display_name,
        roles=role_codes(user),
    )


def _is_expired(value: datetime, now: datetime) -> bool:
    normalized = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    return normalized <= now


class AuthService:
    def __init__(self, repository: AuthRepository, settings: Settings) -> None:
        self.repository = repository
        self.settings = settings

    def login(self, identifier: str, password: str) -> TokenPairResponse:
        user = self.repository.get_user_by_identifier(identifier)
        if (
            user is None
            or user.status != "active"
            or not verify_password(password, user.password_hash)
        ):
            raise AppError(
                code="auth.invalid_credentials",
                message="账号或密码不正确。",
                status_code=401,
            )
        return self._create_session(user)

    def refresh(self, refresh_token: str) -> TokenPairResponse:
        now = datetime.now(UTC)
        token_hash = hash_token(refresh_token, self.settings.auth_token_pepper)
        auth_session = self.repository.get_session_by_refresh_hash(token_hash)
        if (
            auth_session is None
            or auth_session.revoked_at is not None
            or _is_expired(auth_session.refresh_expires_at, now)
            or auth_session.user.status != "active"
        ):
            raise AppError(
                code="auth.invalid_refresh_token",
                message="登录会话已失效，请重新登录。",
                status_code=401,
            )
        access_token, refresh_token_value = self._rotate_tokens(auth_session, now)
        self.repository.commit()
        return TokenPairResponse(
            access_token=access_token,
            refresh_token=refresh_token_value,
            expires_in=self.settings.access_token_ttl_seconds,
            user=user_summary(auth_session.user),
        )

    def logout(self, auth_session: AuthSession) -> None:
        if auth_session.revoked_at is None:
            auth_session.revoked_at = datetime.now(UTC)
            self.repository.commit()

    def _create_session(self, user: User) -> TokenPairResponse:
        now = datetime.now(UTC)
        auth_session = AuthSession(
            user=user,
            access_token_hash="pending",
            refresh_token_hash="pending",
            access_expires_at=now,
            refresh_expires_at=now,
        )
        access_token, refresh_token = self._rotate_tokens(auth_session, now)
        self.repository.add_session(auth_session)
        self.repository.commit()
        return TokenPairResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=self.settings.access_token_ttl_seconds,
            user=user_summary(user),
        )

    def _rotate_tokens(self, auth_session: AuthSession, now: datetime) -> tuple[str, str]:
        access_token = new_token()
        refresh_token = new_token()
        auth_session.access_token_hash = hash_token(access_token, self.settings.auth_token_pepper)
        auth_session.refresh_token_hash = hash_token(refresh_token, self.settings.auth_token_pepper)
        auth_session.access_expires_at = now + timedelta(
            seconds=self.settings.access_token_ttl_seconds
        )
        auth_session.refresh_expires_at = now + timedelta(
            seconds=self.settings.refresh_token_ttl_seconds
        )
        auth_session.rotated_at = now
        return access_token, refresh_token
