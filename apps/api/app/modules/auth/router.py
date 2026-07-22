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


@router.post("/auth/login", response_model=TokenPairResponse)
def login(
    payload: LoginRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> TokenPairResponse:
    return auth_service(request, db).login(payload.identifier, payload.password)


@router.post("/auth/refresh", response_model=TokenPairResponse)
def refresh(
    payload: RefreshRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> TokenPairResponse:
    return auth_service(request, db).refresh(payload.refresh_token)


@router.post("/auth/logout", status_code=204)
def logout(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    principal: Annotated[Principal, Depends(current_principal)],
) -> Response:
    auth_service(request, db).logout(principal.auth_session)
    return Response(status_code=204)


@router.get("/me", response_model=MeResponse)
def me(principal: Annotated[Principal, Depends(current_principal)]) -> MeResponse:
    return MeResponse(user=user_summary(principal.user))
