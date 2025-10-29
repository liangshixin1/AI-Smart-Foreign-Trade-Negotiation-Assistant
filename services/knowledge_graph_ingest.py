"""Business hooks that project core events into the Neo4j knowledge graph."""

from __future__ import annotations

import time
import uuid
from typing import Dict, Iterable, List, Optional

from models.user import User
from services import neo4j_client

DEFAULT_DIFFICULTY = "balanced"


def _normalize_strings(values: Iterable[object]) -> List[str]:
    seen = set()
    normalized: List[str] = []
    for value in values or []:
        candidate: Optional[str]
        if isinstance(value, str):
            candidate = value.strip()
        elif isinstance(value, dict):
            candidate = (
                str(
                    value.get("title")
                    or value.get("name")
                    or value.get("label")
                    or value.get("text")
                    or value.get("value")
                    or ""
                ).strip()
            )
        elif value is None:
            candidate = ""
        else:
            candidate = str(value).strip()
        if candidate and candidate not in seen:
            seen.add(candidate)
            normalized.append(candidate)
    return normalized


def _section_payload(section: Optional[Dict[str, object]]) -> Dict[str, Optional[str]]:
    if not isinstance(section, dict):
        return {"id": None, "title": None, "description": None}
    return {
        "id": str(section.get("id")) if section.get("id") else None,
        "title": str(section.get("title") or section.get("name") or "") or None,
        "description": str(section.get("description") or "") or None,
    }


def _chapter_payload(chapter: Optional[Dict[str, object]]) -> Dict[str, Optional[str]]:
    if not isinstance(chapter, dict):
        return {"id": None, "title": None, "description": None}
    return {
        "id": str(chapter.get("id")) if chapter.get("id") else None,
        "title": str(chapter.get("title") or chapter.get("name") or "") or None,
        "description": str(chapter.get("description") or "") or None,
    }


def record_session_creation(
    *,
    session_id: str,
    user: User,
    scenario: Dict[str, object],
    difficulty: str = DEFAULT_DIFFICULTY,
    expects_bargaining: bool = False,
    chapter: Optional[Dict[str, object]] = None,
    section: Optional[Dict[str, object]] = None,
    assignment_id: Optional[str] = None,
) -> None:
    """Push session metadata into Neo4j if the driver is configured."""

    if not neo4j_client.is_enabled():
        return

    scenario_title = str(scenario.get("scenario_title") or scenario.get("title") or "").strip()
    scenario_summary = str(
        scenario.get("scenario_summary")
        or scenario.get("summary")
        or scenario.get("description")
        or ""
    ).strip()
    knowledge_points = _normalize_strings(scenario.get("knowledge_points", []) or [])
    chapter_payload = _chapter_payload(chapter)
    section_payload = _section_payload(section)

    neo4j_client.execute_write(
        """
        MERGE (s:Session {id: $session_id})
        SET s.startedAt = datetime({epochmillis: $timestamp}),
            s.difficulty = $difficulty,
            s.expectsBargaining = $expects_bargaining,
            s.assignmentId = $assignment_id,
            s.scenarioTitle = $scenario_title,
            s.scenarioSummary = $scenario_summary

        MERGE (u:User {id: $user_id})
        ON CREATE SET u.createdAt = datetime({epochmillis: $timestamp})
        SET u.username = $username,
            u.displayName = $display_name,
            u.lastSeenAt = datetime({epochmillis: $timestamp})

        MERGE (u)-[:STARTED]->(s)

        FOREACH (chapterId IN CASE WHEN $chapter.id IS NULL THEN [] ELSE [$chapter.id] END |
            MERGE (c:Chapter {id: chapterId})
            SET c.title = COALESCE($chapter.title, c.title),
                c.description = COALESCE($chapter.description, c.description)
            MERGE (s)-[:IN_CHAPTER]->(c)
        )

        FOREACH (sectionId IN CASE WHEN $section.id IS NULL THEN [] ELSE [$section.id] END |
            MERGE (sec:Section {id: sectionId})
            SET sec.title = COALESCE($section.title, sec.title),
                sec.description = COALESCE($section.description, sec.description)
            MERGE (s)-[:IN_SECTION]->(sec)
            FOREACH (chapterId IN CASE WHEN $chapter.id IS NULL THEN [] ELSE [$chapter.id] END |
                MERGE (c2:Chapter {id: chapterId})
                SET c2.title = COALESCE($chapter.title, c2.title),
                    c2.description = COALESCE($chapter.description, c2.description)
                MERGE (sec)-[:BELONGS_TO]->(c2)
            )
        )

        WITH s
        UNWIND $knowledge_points AS kp
        MERGE (k:KnowledgePoint {name: kp})
        MERGE (s)-[:COVERED]->(k)
        """,
        {
            "session_id": session_id,
            "timestamp": int(time.time() * 1000),
            "difficulty": difficulty or DEFAULT_DIFFICULTY,
            "expects_bargaining": bool(expects_bargaining),
            "assignment_id": assignment_id,
            "scenario_title": scenario_title or None,
            "scenario_summary": scenario_summary or None,
            "user_id": user.id,
            "username": user.username,
            "display_name": user.display_name or user.username,
            "knowledge_points": knowledge_points,
            "chapter": {
                "id": chapter_payload.get("id"),
                "title": chapter_payload.get("title"),
                "description": chapter_payload.get("description"),
            },
            "section": {
                "id": section_payload.get("id"),
                "title": section_payload.get("title"),
                "description": section_payload.get("description"),
            },
        },
    )


def record_evaluation(
    *,
    session_id: str,
    evaluation: Dict[str, object],
    scenario: Optional[Dict[str, object]] = None,
) -> None:
    """Push evaluation outcomes into Neo4j."""

    if not neo4j_client.is_enabled():
        return

    timestamp = int(time.time() * 1000)
    evaluation_id = f"{session_id}-{uuid.uuid4()}"
    action_items = _normalize_strings(evaluation.get("actionItems", []) or [])
    knowledge_points = _normalize_strings(evaluation.get("knowledgePoints", []) or [])
    scenario_points: List[str] = []
    if isinstance(scenario, dict):
        scenario_points = _normalize_strings(scenario.get("knowledge_points", []) or [])
    merged_points = _normalize_strings(list(knowledge_points) + list(scenario_points))

    neo4j_client.execute_write(
        """
        MATCH (s:Session {id: $session_id})
        SET s.latestScore = $score,
            s.latestScoreLabel = $score_label,
            s.lastEvaluatedAt = datetime({epochmillis: $timestamp}),
            s.bargainingWinRate = $bargaining_win_rate,
            s.latestCommentary = $commentary

        MERGE (e:Evaluation {id: $evaluation_id})
        SET e.score = $score,
            e.scoreLabel = $score_label,
            e.commentary = $commentary,
            e.createdAt = datetime({epochmillis: $timestamp})
        MERGE (s)-[:HAS_EVALUATION]->(e)

        WITH s
        UNWIND $knowledge_points AS kp
        MERGE (k:KnowledgePoint {name: kp})
        MERGE (s)-[:COVERED]->(k)

        WITH s
        UNWIND $action_items AS text
        MERGE (a:ActionItem {id: $session_id + ':' + text})
        SET a.text = text,
            a.createdAt = datetime({epochmillis: $timestamp})
        MERGE (s)-[:HAS_ACTION_ITEM]->(a)
        """,
        {
            "session_id": session_id,
            "evaluation_id": evaluation_id,
            "timestamp": timestamp,
            "score": evaluation.get("score"),
            "score_label": evaluation.get("scoreLabel"),
            "commentary": evaluation.get("commentary"),
            "bargaining_win_rate": evaluation.get("bargainingWinRate"),
            "action_items": action_items,
            "knowledge_points": merged_points,
        },
    )
