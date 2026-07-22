from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.modules.auth.dependencies import Principal, require_roles

router = APIRouter(prefix="/api/v1", tags=["workspaces"])


class WorkspaceResponse(BaseModel):
    role: str
    message: str


@router.get("/student/workspace", response_model=WorkspaceResponse)
def student_workspace(
    principal: Annotated[Principal, Depends(require_roles("student"))],
) -> WorkspaceResponse:
    return WorkspaceResponse(role="student", message=f"欢迎，{principal.user.display_name}")


@router.get("/teacher/workspace", response_model=WorkspaceResponse)
def teacher_workspace(
    principal: Annotated[Principal, Depends(require_roles("teacher"))],
) -> WorkspaceResponse:
    return WorkspaceResponse(role="teacher", message=f"欢迎，{principal.user.display_name}")


@router.get("/technician/workspace", response_model=WorkspaceResponse)
def technician_workspace(
    principal: Annotated[Principal, Depends(require_roles("technician"))],
) -> WorkspaceResponse:
    return WorkspaceResponse(role="technician", message=f"欢迎，{principal.user.display_name}")
