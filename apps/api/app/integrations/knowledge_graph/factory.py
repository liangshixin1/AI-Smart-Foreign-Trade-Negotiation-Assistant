from __future__ import annotations

from app.core.config import Settings
from app.integrations.knowledge_graph.base import GraphStore
from app.integrations.knowledge_graph.memory import MemoryGraphStore
from app.integrations.knowledge_graph.unavailable import UnavailableGraphStore


def build_graph_store(settings: Settings) -> GraphStore:
    if settings.app_env == "test" or settings.knowledge_graph_provider == "memory":
        return MemoryGraphStore()
    if settings.knowledge_graph_provider == "disabled":
        return UnavailableGraphStore("知识图谱功能当前未启用。")
    password = settings.neo4j_password.get_secret_value().strip() if settings.neo4j_password else ""
    if not settings.neo4j_uri or not settings.neo4j_username or not password:
        return UnavailableGraphStore(
            "Neo4j 未配置：请设置 NEO4J_URI、NEO4J_USERNAME 和 NEO4J_PASSWORD。"
        )
    from app.integrations.knowledge_graph.neo4j import Neo4jGraphStore

    return Neo4jGraphStore(
        uri=settings.neo4j_uri,
        username=settings.neo4j_username,
        password=password,
        database=settings.neo4j_database,
        connection_timeout_seconds=settings.neo4j_connection_timeout_seconds,
    )
