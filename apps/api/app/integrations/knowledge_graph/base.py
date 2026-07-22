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
