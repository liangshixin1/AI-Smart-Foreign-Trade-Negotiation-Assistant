"""Flask 应用工厂，是应用装配的唯一入口。"""

from __future__ import annotations

from dotenv import load_dotenv
from flask import Flask
from typing import Optional

from .blueprints import register_blueprints
from .bootstrap import bootstrap_services
from .config import AppSettings
from .errors import register_error_handlers
from .web import bp as platform_blueprint


def create_app(
    settings: Optional[AppSettings] = None,
    *,
    run_startup: bool = True,
) -> Flask:
    """创建可配置、可测试的 Flask 应用。

    ``run_startup=False`` 专供单元测试和只检查路由结构的工具使用，避免连接 Neo4j、
    加载嵌入模型等昂贵操作。
    """
    load_dotenv()
    resolved_settings = settings or AppSettings.from_env()
    app = Flask(__name__, static_folder="../static", static_url_path="/static")
    app.config.from_mapping(resolved_settings.flask_config())

    register_blueprints(app)
    app.register_blueprint(platform_blueprint)
    register_error_handlers(app)

    app.extensions["startup_results"] = bootstrap_services() if run_startup else ()
    return app
