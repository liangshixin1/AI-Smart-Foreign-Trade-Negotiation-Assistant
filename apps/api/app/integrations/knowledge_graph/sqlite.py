"""Transactional, versioned local graph store for the desktop distribution."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from app.integrations.knowledge_graph.base import StoredGraph


class SQLiteGraphStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS graphs "
                "(version TEXT PRIMARY KEY, nodes TEXT NOT NULL, edges TEXT NOT NULL, "
                "active INTEGER NOT NULL DEFAULT 0)"
            )

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.path, timeout=15)

    @property
    def backend_name(self) -> str:
        return "sqlite"

    def publish(
        self,
        graph_version: str,
        nodes: list[dict[str, object]],
        relationships: list[dict[str, object]],
    ) -> None:
        nodes_json = json.dumps(nodes, ensure_ascii=False, allow_nan=False)
        edges_json = json.dumps(relationships, ensure_ascii=False, allow_nan=False)
        with self._connect() as db:
            db.execute("UPDATE graphs SET active=0")
            db.execute(
                "INSERT OR REPLACE INTO graphs VALUES (?, ?, ?, 1)",
                (graph_version, nodes_json, edges_json),
            )

    def deactivate(self, graph_version: str) -> None:
        with self._connect() as db:
            db.execute("UPDATE graphs SET active=0 WHERE version=?", (graph_version,))

    def read(self, graph_version: str) -> StoredGraph:
        with self._connect() as db:
            row = db.execute(
                "SELECT nodes, edges FROM graphs WHERE version=?", (graph_version,)
            ).fetchone()
        return StoredGraph(
            graph_version, json.loads(row[0]) if row else [], json.loads(row[1]) if row else []
        )

    def health(self) -> bool:
        try:
            with self._connect() as db:
                return db.execute("PRAGMA quick_check").fetchone() == ("ok",)
        except sqlite3.Error:
            return False

    def close(self) -> None:
        pass
