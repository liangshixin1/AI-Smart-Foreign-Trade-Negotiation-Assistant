"""兼容入口：应用装配逻辑已迁移到 ``negotiation_assistant`` 包。"""

from negotiation_assistant import create_app

# WSGI 服务器仍可通过 ``app:app`` 启动；测试应直接调用 create_app(run_startup=False)。
app = create_app()


if __name__ == "__main__":  # pragma: no cover
    app.run(host="0.0.0.0", debug=app.config["DEBUG"])
