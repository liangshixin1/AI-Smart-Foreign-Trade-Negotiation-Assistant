"""应用启动任务。

启动编排与 Flask 创建过程分离后，测试可跳过昂贵的数据库、图谱和向量索引初始化，
生产环境仍可获得与旧入口一致的行为。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from time import perf_counter

import database
from levels import CHAPTERS
from services import graph_service, rag_matcher

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class StartupTaskResult:
    """单个启动任务的可观测结果。"""

    name: str
    ready: bool
    duration_ms: int
    detail: str = ""


def _run_optional_task(name: str, task) -> StartupTaskResult:
    """执行可降级任务；失败会记录原因，但不会拖垮整个 Web 应用。"""
    started_at = perf_counter()
    try:
        task()
        return StartupTaskResult(name, True, int((perf_counter() - started_at) * 1000))
    except Exception as exc:  # 外部 AI/Neo4j 服务不可用时允许主应用继续提供基础能力
        LOGGER.warning("启动任务 %s 执行失败：%s", name, exc, exc_info=True)
        return StartupTaskResult(
            name,
            False,
            int((perf_counter() - started_at) * 1000),
            str(exc),
        )


def bootstrap_services() -> tuple[StartupTaskResult, ...]:
    """按依赖顺序初始化本地数据库，并以降级方式预热外部能力。"""
    started_at = perf_counter()
    database.init_database()
    database.seed_default_levels(CHAPTERS)
    database_result = StartupTaskResult(
        "sqlite", True, int((perf_counter() - started_at) * 1000)
    )
    return (
        database_result,
        _run_optional_task("neo4j", graph_service.bootstrap_graph),
        _run_optional_task("knowledge_index", rag_matcher.refresh_knowledge_index),
    )
