# [导读] 所属业务: 技术人员的模型运行配置。
# [导读] 业务名词: 模型按场景生成、对话、评价三种用途分别配置; 连接测试用于确认后端可调用相应用
# [导读] 途的模型。
# [导读] 用途: 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。
# [导读] 为什么: 接口层尽量只做请求转接和响应组装, 使业务规则能在服务层复用; 调整参数时需同步前
# [导读] 端 API 与 schemas。
# [导读] 结构: config、save_config、test_config。
# [导读] 提醒: 密钥是后端秘密, 接口展示只能使用脱敏状态; 保存环境文件后还需更新进程中的配置和模
# [导读] 型实例。
from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request

from app.core.errors import AppError
from app.integrations.llm import build_llm_provider
from app.integrations.llm.base import LLMMessage, LLMProviderError, LLMRequest
from app.modules.auth.dependencies import Principal, require_roles
from app.modules.technician.schemas import ConnectivityResult, LLMConfigResponse, LLMConfigUpdate
from app.modules.technician.service import present_config, update_env

router = APIRouter(prefix="/api/v1/technician", tags=["technician"])
Technician = Annotated[Principal, Depends(require_roles("technician"))]


# [导读] 承接 GET /llm-config; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相信客
# [导读] 户端传入的用户编号。
@router.get("/llm-config", response_model=LLMConfigResponse)
def config(request: Request, _: Technician) -> LLMConfigResponse:
    return present_config(request.app.state.settings)


# [导读] 承接 PUT /llm-config; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相信客
# [导读] 户端传入的用户编号。
@router.put("/llm-config", response_model=LLMConfigResponse)
def save_config(data: LLMConfigUpdate, request: Request, _: Technician) -> LLMConfigResponse:
    try:
        settings = update_env(request.app.state.settings, data)
    except ValueError as exc:
        raise AppError(
            code="technician.invalid_config",
            message=str(exc),
            status_code=422,
        ) from exc
    request.app.state.settings = settings
    request.app.state.llm_provider = build_llm_provider(settings)
    return present_config(settings)


# [导读] 承接 POST /llm-config/test/{purpose}; 身份来自依赖注入, 业务归属限制仍由下方查询或服务
# [导读] 核对, 不能相信客户端传入的用户编号。
@router.post("/llm-config/test/{purpose}", response_model=ConnectivityResult)
def test_config(
    purpose: Literal["scenario", "conversation", "evaluation"], request: Request, _: Technician
) -> ConnectivityResult:
    try:
        response = request.app.state.llm_provider.complete(
            LLMRequest(
                purpose=purpose,
                prompt_template_id="technician-connectivity",
                prompt_version="1.0.0",
                correlation_id=f"connectivity-{purpose}-{request.state.request_id}",
                messages=[LLMMessage(role="user", content="Reply only with OK.")],
            )
        )
    except LLMProviderError as exc:
        raise AppError(
            code=f"technician.connectivity_{exc.category}",
            message="连通性测试失败，请检查 Key、模型和网络。",
            status_code=502,
            retryable=exc.retryable,
        ) from exc
    return ConnectivityResult(
        purpose=purpose, status="ok", model=response.model, total_tokens=response.usage.total_tokens
    )
