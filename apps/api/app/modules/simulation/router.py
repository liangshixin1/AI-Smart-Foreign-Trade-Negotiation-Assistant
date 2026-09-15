# [导读] 所属业务: 带角色演出和态势的谈判仿真。
# [导读] 业务名词: Simulation 是逐段台词演出的训练体验; Presentation 是已保存的演出; State 是按
# [导读] 证据计算的谈判态势。
# [导读] 用途: 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。
# [导读] 为什么: 接口层尽量只做请求转接和响应组装, 使业务规则能在服务层复用; 调整参数时需同步前
# [导读] 端 API 与 schemas。
# [导读] 结构: student_simulation、retry_analysis、teacher_simulation。
# [导读] 提醒: 台词、逐轮评价与态势是不同结果; 分析失败不应丢掉已保存台词, 重试需尊重训练绑定的
# [导读] 配置和规则版本。
from __future__ import annotations

import uuid
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.llm.base import LLMProvider
from app.modules.auth.dependencies import Principal, require_roles
from app.modules.simulation.schemas import SimulationResponse
from app.modules.simulation.service import SimulationService

student_router = APIRouter(prefix="/api/v1/attempts", tags=["simulation"])
teacher_router = APIRouter(prefix="/api/v1/teacher/attempts", tags=["simulation"])
Student = Annotated[Principal, Depends(require_roles("student"))]
Teacher = Annotated[Principal, Depends(require_roles("teacher"))]
Db = Annotated[Session, Depends(get_db)]


# [导读] 承接 GET /{attempt_id}/simulation; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对
# [导读] , 不能相信客户端传入的用户编号。
@student_router.get("/{attempt_id}/simulation", response_model=SimulationResponse)
def student_simulation(attempt_id: uuid.UUID, principal: Student, db: Db) -> SimulationResponse:
    return SimulationService(db).student_get(principal.user, attempt_id)


# [导读] 承接 POST /{attempt_id}/simulation/messages/{assistant_message_id}/retry-analysis; 身份
# [导读] 来自
# [导读] 依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相信客户端传入的用户编号。
@student_router.post(
    "/{attempt_id}/simulation/messages/{assistant_message_id}/retry-analysis",
    response_model=SimulationResponse,
)
def retry_analysis(
    attempt_id: uuid.UUID,
    assistant_message_id: uuid.UUID,
    request: Request,
    principal: Student,
    db: Db,
) -> SimulationResponse:
    provider = cast(LLMProvider, request.app.state.llm_provider)
    graph_store = cast(GraphStore, request.app.state.graph_store)
    return SimulationService(db, provider, graph_store).retry_analysis(
        principal.user, attempt_id, assistant_message_id
    )


# [导读] 承接 GET /{attempt_id}/simulation; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对
# [导读] , 不能相信客户端传入的用户编号。
@teacher_router.get("/{attempt_id}/simulation", response_model=SimulationResponse)
def teacher_simulation(attempt_id: uuid.UUID, principal: Teacher, db: Db) -> SimulationResponse:
    return SimulationService(db).teacher_get(principal.user.id, attempt_id)
