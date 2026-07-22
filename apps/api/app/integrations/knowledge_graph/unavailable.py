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
