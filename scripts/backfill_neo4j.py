"""Backfill historical SQLite data into the Neo4j knowledge graph."""

from __future__ import annotations

import argparse
import json
from typing import Dict, Iterable, List, Optional

from dotenv import load_dotenv

import database
from models.user import User
from services import knowledge_graph_ingest, neo4j_client


def _iter_sessions(limit: Optional[int] = None) -> Iterable[Dict[str, object]]:
    sql = (
        """
        SELECT s.id, s.user_id, s.chapter_id, s.section_id, s.system_prompt,
               s.evaluation_prompt, s.scenario_json, s.expects_bargaining,
               s.difficulty, s.assignment_id, u.username, u.display_name, u.role
        FROM chat_sessions s
        JOIN users u ON u.id = s.user_id
        ORDER BY s.created_at ASC
        """
    )
    params: List[object] = []
    if limit:
        sql += " LIMIT ?"
        params.append(limit)
    with database.get_connection() as conn:
        rows = conn.execute(sql, params).fetchall()
        for row in rows:
            yield {
                "id": row["id"],
                "user_id": row["user_id"],
                "chapter_id": row["chapter_id"],
                "section_id": row["section_id"],
                "scenario": json.loads(row["scenario_json"]) if row["scenario_json"] else {},
                "difficulty": row["difficulty"],
                "expects_bargaining": bool(row["expects_bargaining"]),
                "assignment_id": row["assignment_id"],
                "username": row["username"],
                "display_name": row["display_name"],
                "role": row["role"],
            }


def _load_evaluations(session_id: str) -> List[Dict[str, object]]:
    with database.get_connection() as conn:
        rows = conn.execute(
            """
            SELECT score, score_label, commentary,
                   action_items_json, knowledge_points_json, bargaining_win_rate
            FROM evaluations
            WHERE session_id = ?
            ORDER BY created_at ASC, id ASC
            """,
            (session_id,),
        ).fetchall()
    evaluations: List[Dict[str, object]] = []
    for row in rows:
        evaluations.append(
            {
                "score": row["score"],
                "scoreLabel": row["score_label"],
                "commentary": row["commentary"],
                "actionItems": json.loads(row["action_items_json"]) if row["action_items_json"] else [],
                "knowledgePoints": json.loads(row["knowledge_points_json"]) if row["knowledge_points_json"] else [],
                "bargainingWinRate": row["bargaining_win_rate"],
            }
        )
    return evaluations


def _sync_session(record: Dict[str, object], *, dry_run: bool, include_evaluations: bool) -> Dict[str, int]:
    chapter = database.get_chapter(record.get("chapter_id")) if record.get("chapter_id") else None
    section = (
        database.get_section_template(record.get("chapter_id"), record.get("section_id"))
        if record.get("chapter_id") and record.get("section_id")
        else None
    )
    user = User(
        id=int(record.get("user_id") or 0),
        username=str(record.get("username") or ""),
        role=str(record.get("role") or ""),
        display_name=record.get("display_name"),
    )
    summary = {"sessions": 1, "evaluations": 0}
    if dry_run:
        if include_evaluations:
            summary["evaluations"] = len(_load_evaluations(str(record.get("id"))))
        return summary

    knowledge_graph_ingest.record_session_creation(
        session_id=str(record.get("id")),
        user=user,
        scenario=record.get("scenario") or {},
        difficulty=str(record.get("difficulty") or "balanced"),
        expects_bargaining=bool(record.get("expects_bargaining")),
        chapter=chapter,
        section=section,
        assignment_id=record.get("assignment_id"),
    )

    if include_evaluations:
        evaluations = _load_evaluations(str(record.get("id")))
        for evaluation in evaluations:
            knowledge_graph_ingest.record_evaluation(
                session_id=str(record.get("id")),
                evaluation=evaluation,
                scenario=record.get("scenario") or {},
            )
        summary["evaluations"] = len(evaluations)
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Estimate work without writing to Neo4j")
    parser.add_argument("--limit", type=int, default=None, help="Limit the number of sessions processed")
    parser.add_argument(
        "--skip-evaluations",
        action="store_true",
        help="Do not backfill historical evaluations",
    )
    args = parser.parse_args()

    load_dotenv()

    if not args.dry_run and not neo4j_client.is_enabled():
        print("Neo4j connection is not configured. Use --dry-run for planning or set env vars.")
        return 1

    if not args.dry_run:
        neo4j_client.init_neo4j()

    totals = {"sessions": 0, "evaluations": 0}
    for session in _iter_sessions(args.limit):
        result = _sync_session(session, dry_run=args.dry_run, include_evaluations=not args.skip_evaluations)
        totals["sessions"] += result["sessions"]
        totals["evaluations"] += result.get("evaluations", 0)

    mode = "DRY RUN" if args.dry_run else "EXECUTED"
    print(f"[{mode}] Sessions processed: {totals['sessions']}")
    if not args.skip_evaluations:
        print(f"[{mode}] Evaluations processed: {totals['evaluations']}")
    return 0


if __name__ == "__main__":  # pragma: no cover - script entry point
    raise SystemExit(main())
