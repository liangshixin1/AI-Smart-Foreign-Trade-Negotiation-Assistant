# [导读] 所属业务: 登录与角色授权。
# [导读] 业务名词: Principal 是已校验的当前访问者; AuthSession 是登录令牌对应的服务端会话。
# [导读] 用途与原因: 协调登录、刷新和退出, 并轮换令牌; 失效或撤销会话不能继续换取新令牌。
# [导读] 结构: role_codes、user_summary、_is_expired、AuthService。
# [导读] 提醒: 角色通过只说明可使用这一类接口; 学生归属和教师班级范围仍需在业务查询中核对。
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

    # [导读] 对账号不存在、禁用与密码错误返回同类失败, 减少账号枚举; 校验通过才建立会话。
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

    # [导读] 刷新前检查旧会话, 再同时轮换两类令牌并提交; 旧令牌不能无限复用。
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

    # [导读] 撤销服务端会话, 已有撤销时间时保持原值, 使重复退出安全。
    def logout(self, auth_session: AuthSession) -> None:
        if auth_session.revoked_at is None:
            auth_session.revoked_at = datetime.now(UTC)
            self.repository.commit()

    # [导读] 此操作内部会提交数据库会话; 调用方需把该提交视为事务边界, 后续失败不能靠一次外层
    # [导读] rollback 撤销已提交记录。
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

    # [导读] 分别生成访问和刷新令牌, 仅保存摘要与有效期; 明文只在本次响应返回。
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
