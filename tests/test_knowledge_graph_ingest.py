from __future__ import annotations

from typing import List

import pathlib
import sys
import types

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

if "neo4j" not in sys.modules:
    neo4j_stub = types.ModuleType("neo4j")

    class _DummyDriver:
        def session(self, *args, **kwargs):  # pragma: no cover - safety net only
            raise RuntimeError("Neo4j driver stub does not support sessions")

        def close(self):  # pragma: no cover - safety net only
            return None

    class _DummyGraphDatabase:
        @staticmethod
        def driver(*args, **kwargs):  # pragma: no cover - safety net only
            return _DummyDriver()

    def _basic_auth(user, password):  # pragma: no cover - safety net only
        return (user, password)

    neo4j_stub.GraphDatabase = _DummyGraphDatabase()
    neo4j_stub.Driver = _DummyDriver
    neo4j_stub.basic_auth = _basic_auth
    neo4j_exceptions = types.ModuleType("neo4j.exceptions")

    class Neo4jError(Exception):
        pass

    neo4j_exceptions.Neo4jError = Neo4jError
    neo4j_stub.exceptions = neo4j_exceptions
    sys.modules["neo4j"] = neo4j_stub
    sys.modules["neo4j.exceptions"] = neo4j_exceptions

from models.user import User
from routes import knowledge_graph as knowledge_graph_routes
from services import knowledge_graph_ingest


@pytest.fixture(autouse=True)
def reset_driver(monkeypatch):
    monkeypatch.setattr(knowledge_graph_ingest.neo4j_client, "close_driver", lambda: None)
    yield


def test_record_session_creation_normalizes_inputs(monkeypatch):
    captured: List[dict] = []

    monkeypatch.setattr(knowledge_graph_ingest.neo4j_client, "is_enabled", lambda: True)
    monkeypatch.setattr(
        knowledge_graph_ingest.neo4j_client,
        "execute_write",
        lambda query, parameters=None: captured.append({"query": query, "params": parameters}) or [],
    )

    user = User(id=1, username="alice", role="student", display_name="Alice")
    scenario = {
        "scenario_title": "Deal",
        "knowledge_points": [" Price Strategy ", {"title": "Objection Handling"}, {"name": "Price Strategy"}],
    }
    section = {"id": "sec-1", "title": "Section", "description": "desc"}
    knowledge_graph_ingest.record_session_creation(
        session_id="sess-1",
        user=user,
        scenario=scenario,
        difficulty="advanced",
        expects_bargaining=True,
        chapter={"id": "chap-1", "title": "Chapter", "description": "chapter desc"},
        section=section,
    )

    assert captured, "execute_write should be invoked when Neo4j is enabled"
    params = captured[0]["params"]
    assert params["knowledge_points"] == ["Price Strategy", "Objection Handling"]
    assert params["expects_bargaining"] is True
    assert params["section"]["id"] == "sec-1"
    assert params["chapter"]["title"] == "Chapter"


def test_record_evaluation_merges_points_and_actions(monkeypatch):
    captured: List[dict] = []

    monkeypatch.setattr(knowledge_graph_ingest.neo4j_client, "is_enabled", lambda: True)
    monkeypatch.setattr(
        knowledge_graph_ingest.neo4j_client,
        "execute_write",
        lambda query, parameters=None: captured.append({"query": query, "params": parameters}) or [],
    )

    evaluation = {
        "score": 85,
        "scoreLabel": "B",
        "commentary": "Solid performance",
        "actionItems": ["  tighten opening ", "tighten opening"],
        "knowledgePoints": ["Listening", {"title": "Closing"}],
        "bargainingWinRate": 0.6,
    }
    scenario = {"knowledge_points": ["Listening", "Relationship Building"]}

    knowledge_graph_ingest.record_evaluation(
        session_id="sess-2",
        evaluation=evaluation,
        scenario=scenario,
    )

    params = captured[0]["params"]
    assert params["action_items"] == ["tighten opening"]
    assert params["knowledge_points"] == ["Listening", "Closing", "Relationship Building"]
    assert params["score"] == 85
    assert params["bargaining_win_rate"] == 0.6


def test_aggregate_knowledge_summarises_scores():
    records = [
        {
            "name": "Negotiation",
            "sessionId": "sess-1",
            "latestScore": 90,
            "latestScoreLabel": "A",
            "lastEvaluatedAt": "2024-01-02",
            "difficulty": "advanced",
        },
        {
            "name": "Negotiation",
            "sessionId": "sess-2",
            "latestScore": None,
            "latestScoreLabel": None,
            "lastEvaluatedAt": "2024-01-01",
            "difficulty": "balanced",
        },
        {
            "name": "Listening",
            "sessionId": "sess-3",
            "latestScore": 75,
            "latestScoreLabel": "B",
            "lastEvaluatedAt": "2024-01-03",
            "difficulty": "balanced",
        },
    ]

    summary = knowledge_graph_routes._aggregate_knowledge(records)
    assert summary[0]["name"] == "Negotiation"
    assert summary[0]["sessionCount"] == 2
    assert summary[0]["averageScore"] == 90.0
    assert len(summary[0]["sessions"]) == 2
    assert summary[1]["name"] == "Listening"
    assert summary[1]["averageScore"] == 75.0


def test_collect_action_items_orders_results():
    records = [
        {"text": "Follow up", "sessionCount": 1},
        {"text": "Clarify budget", "sessionCount": 3},
        {"text": "Send proposal", "sessionCount": 2},
    ]

    items = knowledge_graph_routes._collect_action_items(records)
    assert [item["text"] for item in items] == ["Clarify budget", "Send proposal", "Follow up"]
