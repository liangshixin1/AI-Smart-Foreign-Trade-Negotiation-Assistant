# [导读] 用途: 将业务错误、参数校验错误和未捕获异常统一成 API 错误结构。
# [导读] 为什么: 统一错误代码与 request_id, 前端才能稳定区分可重试失败与权限或输入问题。
# [导读] 结构: AppError、_payload、register_error_handlers。
# [导读] 提醒: 对外响应与内部异常详情应分开; 不要在错误消息中加入密钥、对手底牌或其他学生的信息
# [导读] 。
from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        status_code: int,
        retryable: bool = False,
        details: Mapping[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.retryable = retryable
        self.details = dict(details or {})


def _payload(
    request: Request,
    *,
    code: str,
    message: str,
    retryable: bool,
    details: Mapping[str, Any] | list[Any] | None = None,
) -> dict[str, object]:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
            "request_id": getattr(request.state, "request_id", "unknown"),
            "retryable": retryable,
        }
    }


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload(
                request,
                code=exc.code,
                message=exc.message,
                retryable=exc.retryable,
                details=exc.details,
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = [
            {
                "type": error.get("type", "validation_error"),
                "loc": error.get("loc", ()),
                "msg": error.get("msg", "Invalid value"),
            }
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=_payload(
                request,
                code="request.validation_failed",
                message="请求数据不符合接口要求。",
                retryable=False,
                details=details,
            ),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "Unhandled request failure request_id=%s path=%s",
            getattr(request.state, "request_id", "unknown"),
            request.url.path,
            exc_info=exc,
        )
        return JSONResponse(
            status_code=500,
            content=_payload(
                request,
                code="internal.unexpected_error",
                message="服务暂时无法完成请求。",
                retryable=True,
            ),
        )
