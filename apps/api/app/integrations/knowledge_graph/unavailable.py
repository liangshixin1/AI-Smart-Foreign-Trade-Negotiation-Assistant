# [导读] 用途: 在图存储未启用或配置不足时提供明确失败的适配器。
# [导读] 为什么: 保持 GraphStore 接口形状, 让调用方通过统一错误路径展示不可用状态。
# [导读] 结构: GraphStoreUnavailable、UnavailableGraphStore。
# [导读] 提醒: 不要把这种失败替换成空图并当作真实无数据, 否则会掩盖部署或连接问题。
from __future__ import annotations

from typing import Never

from app.integrations.knowledge_graph.base import StoredGraph


class GraphStoreUnavailable(RuntimeError):
    pass


class UnavailableGraphStore:
    """Explicit failure adapter; it never silently falls back to relational storage."""

    def __init__(self, reason: str) -> None:
        self.reason = reason

    @property
    def backend_name(self) -> str:
        return "unavailable"

    def _raise(self) -> Never:
        raise GraphStoreUnavailable(self.reason)

    def publish(
        self,
        graph_version: str,
        nodes: list[dict[str, object]],
        relationships: list[dict[str, object]],
    ) -> None:
        del graph_version, nodes, relationships
        self._raise()

    def deactivate(self, graph_version: str) -> None:
        del graph_version
        self._raise()

    def read(self, graph_version: str) -> StoredGraph:
        del graph_version
        self._raise()

    def health(self) -> bool:
        return False

    def close(self) -> None:
        return None
