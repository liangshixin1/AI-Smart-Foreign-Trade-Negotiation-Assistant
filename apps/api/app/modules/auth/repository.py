# [导读] 所属业务: 登录与角色授权。
# [导读] 业务名词: Principal 是已校验的当前访问者; AuthSession 是登录令牌对应的服务端会话。
# [导读] 用途: 封装该业务使用的查询和持久化操作。
# [导读] 为什么: 把 SQL 查询集中便于核对过滤范围; 保持用户、课程版本及状态条件, flush 不代表
# [导读] commit, 事务归属要沿调用方确认。
# [导读] 结构: AuthRepository。
# [导读] 提醒: 角色通过只说明可使用这一类接口; 学生归属和教师班级范围仍需在业务查询中核对。
from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.modules.auth.models import AuthSession, User, UserRole


class AuthRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_user_by_identifier(self, identifier: str) -> User | None:
        normalized = identifier.strip().lower()
        statement = (
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .where(or_(func.lower(User.email) == normalized, User.student_no == identifier.strip()))
        )
        return self.db.scalar(statement)

    def get_user(self, user_id: uuid.UUID) -> User | None:
        statement = (
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .where(User.id == user_id)
        )
        return self.db.scalar(statement)

    def get_session_by_access_hash(self, token_hash: str) -> AuthSession | None:
        return self.db.scalar(
            select(AuthSession)
            .options(selectinload(AuthSession.user).selectinload(User.user_roles))
            .where(AuthSession.access_token_hash == token_hash)
        )

    def get_session_by_refresh_hash(self, token_hash: str) -> AuthSession | None:
        return self.db.scalar(
            select(AuthSession)
            .options(selectinload(AuthSession.user).selectinload(User.user_roles))
            .where(AuthSession.refresh_token_hash == token_hash)
        )

    def add_session(self, auth_session: AuthSession) -> None:
        self.db.add(auth_session)

    def commit(self) -> None:
        self.db.commit()
