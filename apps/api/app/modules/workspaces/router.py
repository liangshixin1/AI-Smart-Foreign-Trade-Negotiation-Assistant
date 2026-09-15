# [导读] 所属业务: 角色工作区入口检查。
# [导读] 业务名词: 工作区按学生、教师和技术人员区分, 供前端确认登录者可进入的角色界面。
# [导读] 用途: 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。
# [导读] 为什么: 接口层尽量只做请求转接和响应组装, 使业务规则能在服务层复用; 调整参数时需同步前
# [导读] 端 API 与 schemas。
# [导读] 结构: WorkspaceResponse、student_workspace、teacher_workspace、technician_workspace。
# [导读] 提醒: 前端导航只方便使用; 后端的角色依赖仍必须校验每次请求。
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.modules.auth.dependencies import Principal, require_roles

router = APIRouter(prefix="/api/v1", tags=["workspaces"])


class WorkspaceResponse(BaseModel):
    role: str
    message: str


# [导读] 承接 GET /student/workspace; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能
# [导读] 相信客户端传入的用户编号。
@router.get("/student/workspace", response_model=WorkspaceResponse)
def student_workspace(
    principal: Annotated[Principal, Depends(require_roles("student"))],
) -> WorkspaceResponse:
    return WorkspaceResponse(role="student", message=f"欢迎，{principal.user.display_name}")


# [导读] 承接 GET /teacher/workspace; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能
# [导读] 相信客户端传入的用户编号。
@router.get("/teacher/workspace", response_model=WorkspaceResponse)
def teacher_workspace(
    principal: Annotated[Principal, Depends(require_roles("teacher"))],
) -> WorkspaceResponse:
    return WorkspaceResponse(role="teacher", message=f"欢迎，{principal.user.display_name}")


# [导读] 承接 GET /technician/workspace; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对,
# [导读] 不能相信客户端传入的用户编号。
@router.get("/technician/workspace", response_model=WorkspaceResponse)
def technician_workspace(
    principal: Annotated[Principal, Depends(require_roles("technician"))],
) -> WorkspaceResponse:
    return WorkspaceResponse(role="technician", message=f"欢迎，{principal.user.display_name}")
