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


@router.get("/llm-config", response_model=LLMConfigResponse)
def config(request: Request, _: Technician) -> LLMConfigResponse:
    return present_config(request.app.state.settings)


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
