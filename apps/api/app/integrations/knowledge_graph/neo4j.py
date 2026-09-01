from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any

from app.integrations.knowledge_graph.base import StoredGraph

NODE_LABELS = {
    item: item
    for item in (
        "Scenario",
        "Stage",
        "StudentRole",
        "CounterpartyRole",
        "LearningOutcome",
        "Phenomenon",
        "NegotiationStrategy",
        "KnowledgeResource",
        "KnowledgePoint",
        "Terminology",
        "TradeRule",
        "DocumentKnowledge",
        "BusinessProcess",
        "CommunicationKnowledge",
        "MarketKnowledge",
        "Scaffold",
        "RubricDimension",
        "NegotiationOutcome",
    )
}
RELATION_TYPES = {
    item: item
    for item in (
        "ASSIGNS_ROLE",
        "SIMULATES_COUNTERPARTY",
        "TARGETS_OUTCOME",
        "CONTAINS_SCENARIO",
        "CONTAINS_PHENOMENON",
        "EXPOSES",
        "ADDRESSES",
        "SUPPORTS",
        "REQUIRES_KNOWLEDGE",
        "FOCUSES_ON",
        "SCAFFOLDS",
        "ASSESSES_WITH",
        "MAY_LEAD_TO",
    )
}


def _json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=str)


def _decode(value: object, fallback: object) -> object:
    if not isinstance(value, str):
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


class Neo4jGraphStore:
    """Production Neo4j graph store.

    Nodes are version-isolated and a publication is written in one transaction.
    """

    def __init__(
        self,
        *,
        uri: str,
        username: str,
        password: str,
        database: str,
        connection_timeout_seconds: float,
    ) -> None:
        # Driver construction is lazy and does not verify connectivity during app startup.
        from neo4j import GraphDatabase

        self.database = database
        self.driver = GraphDatabase.driver(
            uri,
            auth=(username, password),
            connection_timeout=connection_timeout_seconds,
        )

    @property
    def backend_name(self) -> str:
        return "neo4j"

    def publish(
        self,
        graph_version: str,
        nodes: list[dict[str, object]],
        relationships: list[dict[str, object]],
    ) -> None:
        node_rows = [self._node_row(item) for item in nodes]
        relationship_rows = [self._relationship_row(item) for item in relationships]
        with self.driver.session(database=self.database) as session:
            # Neo4j forbids mixing schema modification and data writes in one transaction.
            # Constraint creation is idempotent; graph replacement remains one write transaction.
            session.run(
                "CREATE CONSTRAINT knowledge_node_identity IF NOT EXISTS "
                "FOR (n:KnowledgeNode) REQUIRE (n.graph_version, n.stable_key) IS UNIQUE"
            ).consume()
            session.run(
                "CREATE CONSTRAINT graph_publication_version IF NOT EXISTS "
                "FOR (p:GraphPublication) REQUIRE p.graph_version IS UNIQUE"
            ).consume()
            session.execute_write(
                self._write_graph,
                graph_version,
                node_rows,
                relationship_rows,
            )

    @staticmethod
    def _write_graph(
        tx: Any,
        version: str,
        nodes: list[dict[str, object]],
        rels: list[dict[str, object]],
    ) -> None:
        run = tx.run
        run("MATCH (n:KnowledgeNode {graph_version: $version}) DETACH DELETE n", version=version)
        run(
            "UNWIND $nodes AS row "
            "CREATE (n:KnowledgeNode {graph_version: $version, stable_key: row.stable_key}) "
            "SET n.node_type = row.node_type, n.properties_json = row.properties_json, "
            "n.source_anchors_json = row.source_anchors_json, n.change_type = row.change_type, "
            "n.display_name = row.display_name, n.course_unit = row.course_unit",
            version=version,
            nodes=nodes,
        ).consume()
        for node_type, label in NODE_LABELS.items():
            run(
                f"MATCH (n:KnowledgeNode {{graph_version: $version, node_type: $node_type}}) "
                f"SET n:{label}",
                version=version,
                node_type=node_type,
            ).consume()
        for relation_type, type_name in RELATION_TYPES.items():
            typed_rows = [row for row in rels if row["relation_type"] == relation_type]
            if not typed_rows:
                continue
            # type_name is selected only from the fixed allowlist above.
            run(
                "UNWIND $rels AS row "
                "MATCH (s:KnowledgeNode {graph_version: $version, stable_key: row.source}) "
                "MATCH (t:KnowledgeNode {graph_version: $version, stable_key: row.target}) "
                f"CREATE (s)-[r:{type_name} "
                "{graph_version: $version, stable_key: row.stable_key}]->(t) "
                "SET r.relation_type = row.relation_type, "
                "r.properties_json = row.properties_json",
                version=version,
                rels=typed_rows,
            ).consume()
        run("MATCH (p:GraphPublication) SET p.active = false").consume()
        run(
            "MERGE (p:GraphPublication {graph_version: $version}) "
            "SET p.active = true, p.published_at = datetime()",
            version=version,
        ).consume()

    def deactivate(self, graph_version: str) -> None:
        with self.driver.session(database=self.database) as session:
            session.run(
                "MATCH (p:GraphPublication {graph_version: $version}) SET p.active = false",
                version=graph_version,
            ).consume()

    def read(self, graph_version: str) -> StoredGraph:
        with self.driver.session(database=self.database) as session:
            node_records = session.run(
                "MATCH (n:KnowledgeNode {graph_version: $version}) "
                "RETURN n.stable_key AS stable_key, n.node_type AS node_type, "
                "n.properties_json AS properties_json, n.source_anchors_json AS anchors_json, "
                "n.change_type AS change_type ORDER BY n.stable_key",
                version=graph_version,
            )
            nodes = [self._record_to_node(record) for record in node_records]
            relation_records = session.run(
                "MATCH (s:KnowledgeNode {graph_version: $version})"
                "-[r {graph_version: $version}]->"
                "(t:KnowledgeNode {graph_version: $version}) "
                "RETURN r.stable_key AS stable_key, s.stable_key AS source, "
                "r.relation_type AS relation_type, t.stable_key AS target, "
                "r.properties_json AS properties_json ORDER BY r.stable_key",
                version=graph_version,
            )
            relationships = [self._record_to_relationship(record) for record in relation_records]
        return StoredGraph(graph_version, nodes, relationships)

    def health(self) -> bool:
        try:
            self.driver.verify_connectivity()
        except Exception:
            return False
        return True

    def close(self) -> None:
        self.driver.close()

    @staticmethod
    def _node_row(node: dict[str, object]) -> dict[str, object]:
        node_type = str(node["type"])
        if node_type not in NODE_LABELS:
            raise ValueError(f"Unsupported graph node type: {node_type}")
        properties = node.get("properties")
        property_map = properties if isinstance(properties, dict) else {}
        display_name = next(
            (
                str(property_map[key])
                for key in (
                    "StageNameZH",
                    "PhenomenonNameZH",
                    "ResourceNameZH",
                    "StrategyNameZH",
                    "Title",
                    "ResourceName",
                    "StrategyName",
                    "TeacherRecognitionPoint",
                    "ScenarioName",
                    "标题（必填）",
                    "策略名称（必填）",
                    "教师希望学生识别什么（必填）",
                    "案例名称（必填）",
                    "name",
                )
                if property_map.get(key)
            ),
            str(node.get("stable_key", "")),
        )
        return {
            "stable_key": str(node["stable_key"]),
            "node_type": node_type,
            "properties_json": _json(property_map),
            "source_anchors_json": _json(node.get("source_anchors", [])),
            "change_type": str(node.get("change_type", "reused")),
            "display_name": display_name,
            "course_unit": str(
                property_map.get("CourseUnit") or property_map.get("对应课程小节（必填）", "")
            ),
        }

    @staticmethod
    def _relationship_row(item: dict[str, object]) -> dict[str, object]:
        relation_type = str(item["type"])
        if relation_type not in RELATION_TYPES:
            raise ValueError(f"Unsupported graph relationship type: {relation_type}")
        return {
            "stable_key": str(item["stable_key"]),
            "source": str(item["source"]),
            "target": str(item["target"]),
            "relation_type": relation_type,
            "properties_json": _json(item.get("properties", {})),
        }

    @staticmethod
    def _record_to_node(record: Mapping[str, object]) -> dict[str, object]:
        return {
            "stable_key": str(record["stable_key"]),
            "type": str(record["node_type"]),
            "properties": _decode(record.get("properties_json"), {}),
            "source_anchors": _decode(record.get("anchors_json"), []),
            "change_type": str(record.get("change_type", "reused")),
        }

    @staticmethod
    def _record_to_relationship(record: Mapping[str, object]) -> dict[str, object]:
        return {
            "stable_key": str(record["stable_key"]),
            "source": str(record["source"]),
            "type": str(record["relation_type"]),
            "target": str(record["target"]),
            "properties": _decode(record.get("properties_json"), {}),
        }
