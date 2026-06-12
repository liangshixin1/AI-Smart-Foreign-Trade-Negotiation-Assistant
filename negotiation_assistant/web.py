"""框架级 Web 接口，包括前端入口与运行状态检查。"""

from __future__ import annotations

from pathlib import Path

from flask import Blueprint, current_app, jsonify, send_from_directory

bp = Blueprint("platform", __name__)


@bp.get("/")
def legacy_index():
    """继续托管旧版前端，确保渐进式迁移期间业务功能不受影响。"""
    return send_from_directory(current_app.static_folder, "index.html")


@bp.get("/modern/")
@bp.get("/modern/<path:asset_path>")
def modern_frontend(asset_path: str = "index.html"):
    """托管 React 构建产物，并为客户端路由回退到入口文件。"""
    frontend_dir = Path(current_app.config["MODERN_FRONTEND_DIR"]).resolve()
    requested_file = frontend_dir / asset_path
    if asset_path != "index.html" and requested_file.is_file():
        return send_from_directory(frontend_dir, asset_path)
    if (frontend_dir / "index.html").is_file():
        return send_from_directory(frontend_dir, "index.html")
    return jsonify({"error": "modern_frontend_not_built", "hint": "运行 npm run build"}), 503


@bp.get("/api/system/health")
def health():
    """提供无外部依赖的轻量健康检查，供部署平台和新版前端使用。"""
    startup = current_app.extensions.get("startup_results", ())
    checks = {
        result.name: {
            "ready": result.ready,
            "durationMs": result.duration_ms,
            **({"detail": result.detail} if result.detail else {}),
        }
        for result in startup
    }
    return jsonify(
        {
            "status": "ok" if all(item["ready"] for item in checks.values()) else "degraded",
            "service": "negotiation-assistant",
            "environment": current_app.config["ENV"],
            "checks": checks,
        }
    )
