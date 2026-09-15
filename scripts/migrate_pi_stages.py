"""Backup, migrate and verify the local PI graph. Run with PYTHONPATH=apps/api."""

from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import build_engine, build_session_factory
from app.integrations.knowledge_graph import build_graph_store
from app.modules.auth.models import Role, User, UserRole
from app.modules.knowledge_graph.models import KnowledgeGraphAuditEvent
from app.modules.knowledge_graph.pi_migration import migrate_pi_stages
from app.modules.knowledge_graph.repository import KnowledgeGraphRepository


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply", action="store_true", help="Publish the authorized migration"
    )
    parser.add_argument("--output-dir", type=Path, default=Path("tmp/pi-ten-stages"))
    args = parser.parse_args()
    settings = get_settings()
    engine = build_engine(settings)
    if engine.url.get_backend_name() != "sqlite" or settings.app_env != "development":
        raise RuntimeError(
            "This backup/rollout command is restricted to local development SQLite."
        )
    store = build_graph_store(settings)
    try:
        if not store.health():
            raise RuntimeError("Graph storage unavailable; no data has been modified.")
        with build_session_factory(engine)() as db:
            repository = KnowledgeGraphRepository(db)
            active = repository.active_publication()
            if active is None:
                raise RuntimeError("No active graph.")
            report: dict[str, object] = {"previous_version": active.graph_version}
            if not args.apply:
                print(json.dumps(report, indent=2))
                return
            args.output_dir.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
            backup = args.output_dir / f"before-pi-{stamp}.db"
            with (
                sqlite3.connect(str(engine.url.database)) as source,
                sqlite3.connect(backup) as target,
            ):
                source.backup(target)
            actor = db.scalar(
                select(User).join(UserRole).join(Role).where(Role.code == "technician")
            )
            if actor is None:
                raise RuntimeError(
                    "A technician account is required for the audit trail."
                )
            publication = migrate_pi_stages(db, store, actor.id)
            graph = store.read(publication.graph_version)
            stages = [n for n in graph.nodes if n["type"] == "Stage"]
            if len(stages) != 10:
                raise RuntimeError("Published graph does not contain ten stages.")
            report.update(
                {
                    "graph_version": publication.graph_version,
                    "backup": str(backup.resolve()),
                    "stage_count": len(stages),
                    "node_count": len(graph.nodes),
                    "relationship_count": len(graph.relationships),
                    "audit": [
                        event.details
                        for event in db.scalars(
                            select(KnowledgeGraphAuditEvent).where(
                                KnowledgeGraphAuditEvent.action == "pi.stages_migrated",
                                KnowledgeGraphAuditEvent.target_id
                                == str(publication.id),
                            )
                        )
                    ],
                }
            )
            (args.output_dir / "migration-report.json").write_text(
                json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(json.dumps(report, ensure_ascii=False, indent=2))
    finally:
        store.close()
        engine.dispose()


if __name__ == "__main__":
    main()
