from __future__ import annotations

from collections.abc import Generator

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings


def build_engine(settings: Settings) -> Engine:
    connect_args = (
        {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
    )
    return create_engine(settings.database_url, pool_pre_ping=True, connect_args=connect_args)


def build_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db(request: Request) -> Generator[Session, None, None]:
    factory: sessionmaker[Session] = request.app.state.session_factory
    with factory() as session:
        yield session
