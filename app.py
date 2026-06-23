"""应用入口：负责初始化 Flask 与路由蓝图。"""

from __future__ import annotations

import threading
from dotenv import load_dotenv
from flask import Flask, send_from_directory

import database
from levels import CHAPTERS
from services import graph_service
from services import rag_matcher
from routes import admin as admin_routes
from routes import assignments as assignment_routes
from routes import auth as auth_routes
from routes import assistants as assistants_routes
from routes import scenarios as scenario_routes
from routes import theory as theory_routes
from routes import graph as graph_routes
from routes import knowledge as knowledge_routes
from routes import asr as asr_routes
from routes import tts as tts_routes


def _warm_rag_index() -> None:
    """后台预热 RAG 向量索引（加载 embedding 模型），不阻塞 Flask 启动。"""
    try:
        rag_matcher.refresh_knowledge_index()
    except Exception:
        pass


def create_app() -> Flask:
    """创建并配置 Flask 应用。"""
    load_dotenv()
    database.init_database()
    database.seed_default_levels(CHAPTERS)
    graph_service.bootstrap_graph()

    # RAG 向量索引（含 embedding 模型加载）放入后台线程，避免拖慢启动速度。
    threading.Thread(target=_warm_rag_index, daemon=True, name="rag-warmup").start()

    app = Flask(__name__, static_folder="static")

    # 注册拆分后的业务蓝图，保持模块清晰职责
    app.register_blueprint(auth_routes.bp)
    app.register_blueprint(scenario_routes.bp)
    app.register_blueprint(assignment_routes.bp)
    app.register_blueprint(assistants_routes.bp)
    app.register_blueprint(admin_routes.bp)
    app.register_blueprint(theory_routes.bp)
    app.register_blueprint(graph_routes.bp)
    app.register_blueprint(knowledge_routes.bp)
    app.register_blueprint(asr_routes.bp)
    app.register_blueprint(tts_routes.bp)
    # WebSocket 支持（flask-sock）
    asr_routes.sock.init_app(app)

    @app.route("/")
    def index() -> str:
        """前端入口文件，由静态资源目录托管。"""
        return send_from_directory(app.static_folder, "index.html")

    return app


app = create_app()


if __name__ == "__main__":  # pragma: no cover
    app.run(host="0.0.0.0", debug=True)
