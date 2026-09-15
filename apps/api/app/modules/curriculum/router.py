# [导读] 所属业务: 版本化课程与小节。
# [导读] 业务名词: TrainingUnit 是课程小节; Rubric 是评价维度及权重; PromptTemplate 是发给模型的
# [导读] 指令模板。
# [导读] 用途: 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。
# [导读] 为什么: 接口层尽量只做请求转接和响应组装, 使业务规则能在服务层复用; 调整参数时需同步前
# [导读] 端 API 与 schemas。
# [导读] 结构: current_map、unit_detail。
# [导读] 提醒: 旧训练绑定旧课程版本; 更新课程时应创建新版本, 不要直接改写历史训练的版本关联。
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import Principal, require_roles
from app.modules.curriculum.repository import CurriculumRepository
from app.modules.curriculum.schemas import CourseMapResponse, UnitDetailResponse
from app.modules.curriculum.service import CurriculumService

router = APIRouter(prefix="/api/v1", tags=["curriculum"])


# [导读] 承接 GET /courses/current/map; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不
# [导读] 能相信客户端传入的用户编号。
@router.get("/courses/current/map", response_model=CourseMapResponse)
def current_map(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    principal: Annotated[Principal, Depends(require_roles("student"))],
) -> CourseMapResponse:
    return CurriculumService(
        CurriculumRepository(db),
        document_correction_enabled=request.app.state.settings.document_correction_enabled,
        document_correction_skip_prerequisite=request.app.state.settings.document_correction_skip_prerequisite,
    ).get_map(principal.user)


# [导读] 承接 GET /units/{unit_id}; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相
# [导读] 信客户端传入的用户编号。
@router.get("/units/{unit_id}", response_model=UnitDetailResponse)
def unit_detail(
    unit_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    principal: Annotated[Principal, Depends(require_roles("student"))],
) -> UnitDetailResponse:
    return CurriculumService(
        CurriculumRepository(db),
        request.app.state.settings.simulation_enabled,
        request.app.state.settings.document_correction_enabled,
        request.app.state.settings.document_correction_skip_prerequisite,
    ).get_unit(principal.user, unit_id)
