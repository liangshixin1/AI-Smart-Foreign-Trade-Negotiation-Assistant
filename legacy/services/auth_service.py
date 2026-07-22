"""认证与鉴权相关的服务。"""

from __future__ import annotations

from functools import wraps
from typing import Callable, Dict, Optional, Tuple

from flask import abort, g, jsonify, request

import database
from models.user import User

ErrorResponse = Tuple[Dict[str, str], int]


def extract_token() -> Optional[str]:
    """统一从请求头中提取 token。"""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    token = request.headers.get("X-Auth-Token")
    if token:
        return token.strip()
    return None


def resolve_user(required_role: Optional[str] = None) -> Tuple[Optional[User], Optional[ErrorResponse]]:
    """根据 token 获取当前用户，并根据需要校验角色。"""
    token = extract_token()
    if not token:
        return None, ({"error": "Authentication required"}, 401)
    raw_user = database.get_user_by_token(token)
    if not raw_user:
        return None, ({"error": "Invalid or expired token"}, 401)
    user = User.from_record(raw_user)
    if required_role and user.role != required_role:
        return None, ({"error": "Forbidden"}, 403)
    return user, None


def require_role(role: Optional[str] = None) -> Callable:
    """路由装饰器，用于复用鉴权逻辑并将用户信息写入 flask.g。"""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            user, error = resolve_user(required_role=role)
            if error:
                body, status = error
                return jsonify(body), status
            g.current_user = user
            return func(*args, **kwargs)

        return wrapper

    return decorator


def current_user() -> User:
    """方便服务层访问当前用户。未登录时会抛出 401。"""
    user: Optional[User] = getattr(g, "current_user", None)
    if not user:
        abort(401, description="Authentication required")
    return user
