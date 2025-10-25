"""应用入口：负责初始化 Flask 与路由蓝图。"""

from __future__ import annotations

from dotenv import load_dotenv
from flask import Flask, send_from_directory

import database
from levels import CHAPTERS
from routes import admin as admin_routes
from routes import assignments as assignment_routes
from routes import auth as auth_routes
from routes import scenarios as scenario_routes
from routes import theory as theory_routes


def create_app() -> Flask:
    """创建并配置 Flask 应用。"""
    load_dotenv()
    database.init_database()
    database.seed_default_levels(CHAPTERS)

    app = Flask(__name__, static_folder="static")

    # 注册拆分后的业务蓝图，保持模块清晰职责
    app.register_blueprint(auth_routes.bp)
    app.register_blueprint(scenario_routes.bp)
    app.register_blueprint(assignment_routes.bp)
    app.register_blueprint(admin_routes.bp)
    app.register_blueprint(theory_routes.bp)

    @app.route("/")
    def index() -> str:
        """前端入口文件，由静态资源目录托管。"""
        return send_from_directory(app.static_folder, "index.html")

    return app


app = create_app()


if __name__ == "__main__":  # pragma: no cover
    app.run(host="0.0.0.0", debug=True)
