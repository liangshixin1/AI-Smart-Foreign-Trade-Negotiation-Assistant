"""Routes for exposing knowledge graph insights via the API."""

from __future__ import annotations

from typing import Dict, Iterable, List

from flask import Blueprint, jsonify

from services import neo4j_client
from services.auth_service import current_user, require_role

bp = Blueprint("knowledge_graph", __name__)


def _aggregate_knowledge(records: Iterable[Dict[str, object]]) -> List[Dict[str, object]]:
    summary: Dict[str, Dict[str, object]] = {}
    for record in records:
        name = record.get("name") if isinstance(record, dict) else None
        if name is None and hasattr(record, "get"):
            name = record.get("name")
        if not name:
            continue
        item = summary.setdefault(
            name,
            {
                "name": name,
                "sessionCount": 0,
                "_scoreTotal": 0.0,
                "_scoredSessions": 0,
                "sessions": [],
            },
        )
        item["sessionCount"] += 1
        session_id = None
        latest_score = None
        score_label = None
        last_evaluated_at = None
        difficulty = None
        if hasattr(record, "get"):
            session_id = record.get("sessionId")
            latest_score = record.get("latestScore")
            score_label = record.get("latestScoreLabel")
            last_evaluated_at = record.get("lastEvaluatedAt")
            difficulty = record.get("difficulty")
        elif isinstance(record, dict):
            session_id = record.get("sessionId")
            latest_score = record.get("latestScore")
            score_label = record.get("latestScoreLabel")
            last_evaluated_at = record.get("lastEvaluatedAt")
            difficulty = record.get("difficulty")
        if latest_score is not None:
            try:
                numeric_score = float(latest_score)
            except (TypeError, ValueError):
                numeric_score = None
            if numeric_score is not None:
                item["_scoreTotal"] += numeric_score
                item["_scoredSessions"] += 1
        if session_id:
            item["sessions"].append(
                {
                    "sessionId": session_id,
                    "score": latest_score,
                    "scoreLabel": score_label,
                    "lastEvaluatedAt": last_evaluated_at,
                    "difficulty": difficulty,
                }
            )
    payload: List[Dict[str, object]] = []
    for value in summary.values():
        scored_sessions = value.pop("_scoredSessions")
        score_total = value.pop("_scoreTotal")
        average_score = None
        if scored_sessions:
            average_score = round(score_total / scored_sessions, 2)
        value["averageScore"] = average_score
        # Limit to last five session references for brevity
        value["sessions"] = sorted(
            value["sessions"],
            key=lambda item: (item.get("lastEvaluatedAt") or "", item.get("sessionId")),
            reverse=True,
        )[:5]
        payload.append(value)
    payload.sort(key=lambda item: (-item.get("sessionCount", 0), item.get("name")))
    return payload


def _collect_action_items(records: Iterable[Dict[str, object]]) -> List[Dict[str, object]]:
    payload: List[Dict[str, object]] = []
    for record in records:
        text = record.get("text") if isinstance(record, dict) else None
        count = record.get("sessionCount") if isinstance(record, dict) else None
        if text is None and hasattr(record, "get"):
            text = record.get("text")
            count = record.get("sessionCount")
        if not text:
            continue
        try:
            count_int = int(count) if count is not None else 0
        except (TypeError, ValueError):
            count_int = 0
        payload.append({"text": text, "sessionCount": count_int})
    payload.sort(key=lambda item: (-item["sessionCount"], item["text"]))
    return payload


def _knowledge_payload(user_id: int) -> Dict[str, object]:
    if not neo4j_client.is_enabled():
        return {
            "status": "disabled",
            "knowledgePoints": [],
            "actionItems": [],
        }
    knowledge_records = neo4j_client.execute_read(
        """
        MATCH (u:User {id: $user_id})-[:STARTED]->(s:Session)-[:COVERED]->(k:KnowledgePoint)
        RETURN k.name AS name,
               s.id AS sessionId,
               s.latestScore AS latestScore,
               s.latestScoreLabel AS latestScoreLabel,
               s.lastEvaluatedAt AS lastEvaluatedAt,
               s.difficulty AS difficulty
        """,
        {"user_id": user_id},
    )
    action_records = neo4j_client.execute_read(
        """
        MATCH (u:User {id: $user_id})-[:STARTED]->(s:Session)-[:HAS_ACTION_ITEM]->(a:ActionItem)
        RETURN a.text AS text, COUNT(DISTINCT s) AS sessionCount
        """,
        {"user_id": user_id},
    )
    return {
        "status": "ok",
        "knowledgePoints": _aggregate_knowledge(knowledge_records),
        "actionItems": _collect_action_items(action_records),
    }


@bp.get("/api/knowledge_graph/health")
@require_role("teacher")
def graph_health():
    """Expose Neo4j driver health for quick diagnostics."""

    status = neo4j_client.health_check()
    http_status = 200 if status.get("status") != "error" else 503
    return jsonify(status), http_status


@bp.get("/api/knowledge_graph/me/knowledge")
@require_role("student")
def my_knowledge():
    """Return knowledge point insights for the current student."""

    user = current_user()
    payload = _knowledge_payload(user.id)
    http_status = 200 if payload.get("status") == "ok" else 503
    return jsonify({"userId": user.id, **payload}), http_status


@bp.get("/api/knowledge_graph/users/<int:user_id>/knowledge")
@require_role("teacher")
def user_knowledge(user_id: int):
    """Allow instructors to inspect a student's progress via the knowledge graph."""

    payload = _knowledge_payload(user_id)
    http_status = 200 if payload.get("status") == "ok" else 503
    return jsonify({"userId": user_id, **payload}), http_status
