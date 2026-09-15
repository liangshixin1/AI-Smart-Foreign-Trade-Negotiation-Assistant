# [导读] 用途: 定义图存储协议和图谱快照结构。
# [导读] 为什么: 业务层依赖 GraphStore 接口, 因此测试内存实现和 Neo4j 实现可以互换。
# [导读] 结构: StoredGraph、GraphStore。
# [导读] 提醒: read 接受明确版本; 存储接口本身不等于学生或教师权限检查, 权限在业务服务执行。
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class StoredGraph:
    """Stable exchange object that keeps Neo4j driver types inside the adapter."""

    graph_version: str
    nodes: list[dict[str, object]]
    relationships: list[dict[str, object]]


class GraphStore(Protocol):
    @property
    def backend_name(self) -> str: ...

    def publish(
        self,
        graph_version: str,
        nodes: list[dict[str, object]],
        relationships: list[dict[str, object]],
    ) -> None: ...

    def deactivate(self, graph_version: str) -> None: ...

    def read(self, graph_version: str) -> StoredGraph: ...

    def health(self) -> bool: ...

    def close(self) -> None: ...
