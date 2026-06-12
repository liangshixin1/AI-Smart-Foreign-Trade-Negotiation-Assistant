"""统一处理框架级错误，避免前端收到不可解析的 HTML 错误页。"""

from __future__ import annotations

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException


def register_error_handlers(app: Flask) -> None:
    """为 API 请求提供稳定的 JSON 错误契约。"""

    @app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException):
        return jsonify({"error": error.name, "message": error.description}), error.code
