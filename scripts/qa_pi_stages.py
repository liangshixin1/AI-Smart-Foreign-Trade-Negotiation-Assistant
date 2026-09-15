"""Read-only verification of the active PI graph and relational snapshots."""

from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import build_engine, build_session_factory
from app.integrations.knowledge_graph import build_graph_store
from app.modules.knowledge_graph.models import (
    KnowledgeGraphPhenomenonSnapshot,
    KnowledgeGraphStageSnapshot,
)
from app.modules.knowledge_graph.pi_stages import PI_COMPILER_VERSION, PI_STAGES
from app.modules.knowledge_graph.repository import KnowledgeGraphRepository


def main() -> None:
    settings = get_settings()
    engine = build_engine(settings)
    store = build_graph_store(settings)
    try:
        with build_session_factory(engine)() as db:
            repo = KnowledgeGraphRepository(db)
            publication = repo.active_publication()
            assert publication is not None, "No active graph"
            change = repo.get_change_set(publication.change_set_id)
            assert change is not None and change.compiler_version == PI_COMPILER_VERSION
            graph = store.read(publication.graph_version)
            stages = sorted(
                [node for node in graph.nodes if node["type"] == "Stage"],
                key=lambda n: n["properties"]["Seq"],
            )
            assert [
                (n["properties"]["StageNameZH"], n["properties"]["StageNameEN"])
                for n in stages
            ] == list(PI_STAGES)
            snapshots = list(
                db.scalars(
                    select(KnowledgeGraphStageSnapshot)
                    .where(KnowledgeGraphStageSnapshot.change_set_id == change.id)
                    .order_by(KnowledgeGraphStageSnapshot.sequence)
                )
            )
            assert [s.name_en for s in snapshots] == [name for _, name in PI_STAGES]
            nodes = {str(n["stable_key"]): n for n in graph.nodes}
            assert len(nodes) == 346
            for edge in graph.relationships:
                assert edge["source"] in nodes and edge["target"] in nodes
            for row in db.scalars(
                select(KnowledgeGraphPhenomenonSnapshot).where(
                    KnowledgeGraphPhenomenonSnapshot.change_set_id == change.id
                )
            ):
                node = nodes[f"phenomenon:{row.phenomenon_id}"]
                assert node["properties"]["StageID"] == row.stage_id
                assert any(
                    e["source"] == f"stage:{row.stage_id}"
                    and e["target"] == node["stable_key"]
                    and e["type"] == "CONTAINS_PHENOMENON"
                    for e in graph.relationships
                )
            report = {
                "graph_version": publication.graph_version,
                "stage_count": len(stages),
                "nodes": len(nodes),
                "relationships": len(graph.relationships),
                "sql_neo4j_consistent": True,
                "dangling_edges": 0,
                "canonical_names_and_sequence": True,
            }
            output = Path("tmp/pi-ten-stages/live-qa.json")
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(
                json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(json.dumps(report, ensure_ascii=False, indent=2))
    finally:
        store.close()
        engine.dispose()


if __name__ == "__main__":
    main()
