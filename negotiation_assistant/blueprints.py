"""统一维护业务蓝图注册表。"""

from __future__ import annotations

from collections.abc import Iterable

from flask import Flask

from routes import admin, asr, assignments, assistants, auth, graph, knowledge, scenarios, theory, tts


# 新增业务模块时只需在这里登记，应用工厂不再随业务数量增长而膨胀。
BUSINESS_BLUEPRINTS = (
    auth.bp,
    scenarios.bp,
    assignments.bp,
    assistants.bp,
    admin.bp,
    theory.bp,
    graph.bp,
    knowledge.bp,
    asr.bp,
    tts.bp,
)


def register_blueprints(app: Flask, blueprints: Iterable = BUSINESS_BLUEPRINTS) -> None:
    """注册 HTTP 蓝图及需要单独初始化的 WebSocket 扩展。"""
    for blueprint in blueprints:
        app.register_blueprint(blueprint)
    asr.sock.init_app(app)
