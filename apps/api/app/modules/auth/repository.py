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
