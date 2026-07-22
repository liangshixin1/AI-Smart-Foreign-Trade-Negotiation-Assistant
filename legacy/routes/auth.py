"""认证与个人账号相关的接口。"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

import database
from services.auth_service import current_user, require_role
from utils.normalizers import normalize_text

bp = Blueprint("auth", __name__)


@bp.post("/api/login")
def login():
    """登录接口：校验用户名密码并签发访问令牌。"""
    data = request.get_json(force=True)
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    user = database.authenticate_user(username, password)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    token = database.issue_auth_token(int(user["id"]))
    payload = {"token": token, "user": user}
    return jsonify(payload)


@bp.post("/api/account/password")
@require_role()
def update_password():
    """修改本人密码，避免教师或学生共享账号。"""
    user = current_user()
    data = request.get_json(force=True)
    current_password = data.get("currentPassword")
    new_password = normalize_text(data.get("newPassword"))
    if len(new_password) < 4:
        return jsonify({"error": "Password must be at least 4 characters"}), 400

    if not current_password or not database.verify_user_password(user.id, current_password):
        return jsonify({"error": "Current password is incorrect"}), 400

    database.update_user_password(user.id, new_password)
    return jsonify({"status": "updated"})


@bp.post("/api/account/profile")
@require_role()
def update_profile():
    """更新用户展示名称，方便班级同学识别。"""
    user = current_user()
    data = request.get_json(force=True)
    display_name = normalize_text(data.get("displayName"))
    if not display_name:
        return jsonify({"error": "Display name is required"}), 400

    database.update_user_profile(user.id, display_name)
    updated = database.get_user(user.id)
    return jsonify({"status": "updated", "user": updated})
