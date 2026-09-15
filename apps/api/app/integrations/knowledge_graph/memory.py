# [导读] 用途: 用内存字典实现图存储协议, 供测试或明确配置的内存模式使用。
# [导读] 为什么: 读写时复制图数据, 避免调用者修改返回值时意外改变已保存的版本。
# [导读] 结构: MemoryGraphStore。
# [导读] 提醒: 这是进程内数据, 不具备持久化能力; 不可据此宣称 Neo4j 发布流程已通过真实环境验证。
from __future__ import annotations

from copy import deepcopy

from app.integrations.knowledge_graph.base import StoredGraph


class MemoryGraphStore:
    """CI implementation with the same behavior contract as the Neo4j store."""

    def __init__(self) -> None:
        self._graphs: dict[str, StoredGraph] = {}
        self._active_version: str | None = None

    @property
    def backend_name(self) -> str:
        return "memory"

    def publish(
        self,
        graph_version: str,
        nodes: list[dict[str, object]],
        relationships: list[dict[str, object]],
    ) -> None:
        self._graphs[graph_version] = StoredGraph(
            graph_version=graph_version,
            nodes=deepcopy(nodes),
            relationships=deepcopy(relationships),
        )
        self._active_version = graph_version

    def deactivate(self, graph_version: str) -> None:
        if self._active_version == graph_version:
            self._active_version = None

    def read(self, graph_version: str) -> StoredGraph:
        graph = self._graphs.get(graph_version)
        if graph is None:
            return StoredGraph(graph_version=graph_version, nodes=[], relationships=[])
        return StoredGraph(
            graph_version=graph.graph_version,
            nodes=deepcopy(graph.nodes),
            relationships=deepcopy(graph.relationships),
        )

    def health(self) -> bool:
        return True

    def close(self) -> None:
        return None
