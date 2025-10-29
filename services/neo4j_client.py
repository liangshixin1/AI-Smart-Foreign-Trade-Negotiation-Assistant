"""Neo4j client utilities to centralize driver configuration and access."""

from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from typing import Any, Dict, Iterable, Optional

from neo4j import GraphDatabase, basic_auth
from neo4j import Driver
from neo4j.exceptions import Neo4jError

logger = logging.getLogger(__name__)

_driver: Optional[Driver] = None


def is_enabled() -> bool:
    """Return True if Neo4j credentials are configured."""

    uri = os.getenv("NEO4J_URI")
    username = os.getenv("NEO4J_USERNAME") or os.getenv("NEO4J_USER")
    password = os.getenv("NEO4J_PASSWORD")
    return bool(uri and username and password)


def _get_driver() -> Driver:
    global _driver
    if _driver is None:
        if not is_enabled():
            raise RuntimeError("Neo4j driver requested but credentials are missing")
        uri = os.getenv("NEO4J_URI")
        username = os.getenv("NEO4J_USERNAME") or os.getenv("NEO4J_USER") or ""
        password = os.getenv("NEO4J_PASSWORD") or ""
        max_pool_size = int(os.getenv("NEO4J_MAX_POOL_SIZE", "10"))
        max_retry_time = float(os.getenv("NEO4J_MAX_RETRY_TIME", "15"))
        logger.info("Initializing Neo4j driver for %s", uri)
        _driver = GraphDatabase.driver(
            uri,
            auth=basic_auth(username, password),
            max_connection_pool_size=max_pool_size,
            max_retry_time=max_retry_time,
        )
    return _driver


@contextmanager
def get_session(access_mode: str = "WRITE"):
    """Yield a configured driver session when Neo4j is enabled."""

    if not is_enabled():
        raise RuntimeError("Neo4j access requested while driver is disabled")
    driver = _get_driver()
    database_name = os.getenv("NEO4J_DATABASE", "neo4j")
    session = driver.session(database=database_name, default_access_mode=access_mode)
    try:
        yield session
    finally:
        session.close()


def execute_write(query: str, parameters: Optional[Dict[str, Any]] = None) -> Iterable[Any]:
    """Execute a write query if Neo4j is enabled, returning records."""

    if not is_enabled():
        return []
    with get_session("WRITE") as session:
        result = session.run(query, parameters or {})
        return list(result)


def execute_read(query: str, parameters: Optional[Dict[str, Any]] = None) -> Iterable[Any]:
    """Execute a read query if Neo4j is enabled, returning records."""

    if not is_enabled():
        return []
    with get_session("READ") as session:
        result = session.run(query, parameters or {})
        return list(result)


def init_neo4j() -> None:
    """Initialize driver and ensure required constraints exist when enabled."""

    if not is_enabled():
        logger.info("Neo4j disabled: missing URI or credentials")
        return

    try:
        driver = _get_driver()
        database_name = os.getenv("NEO4J_DATABASE", "neo4j")
        with driver.session(database=database_name, default_access_mode="WRITE") as session:
            session.run(
                "CREATE CONSTRAINT IF NOT EXISTS ON (u:User) ASSERT u.id IS UNIQUE"
            )
            session.run(
                "CREATE CONSTRAINT IF NOT EXISTS ON (s:Session) ASSERT s.id IS UNIQUE"
            )
            session.run(
                "CREATE CONSTRAINT IF NOT EXISTS ON (k:KnowledgePoint) ASSERT k.name IS UNIQUE"
            )
            session.run(
                "CREATE CONSTRAINT IF NOT EXISTS ON (a:ActionItem) ASSERT a.id IS UNIQUE"
            )
        logger.info("Neo4j constraints ensured for database '%s'", database_name)
    except Neo4jError as exc:  # pragma: no cover - depends on external service
        logger.exception("Failed to initialize Neo4j: %s", exc)
        raise


def health_check() -> Dict[str, Any]:
    """Return a health summary for monitoring endpoints."""

    if not is_enabled():
        return {"status": "disabled"}

    try:
        records = execute_read("RETURN 1 AS ok")
        ok = any(record["ok"] == 1 for record in records)
        return {"status": "ok" if ok else "error"}
    except Neo4jError as exc:  # pragma: no cover - depends on external service
        logger.exception("Neo4j health check failed: %s", exc)
        return {"status": "error", "error": str(exc)}


def close_driver() -> None:
    """Close the global Neo4j driver, mainly for tests."""

    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None
