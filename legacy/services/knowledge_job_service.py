"""Persistence helpers for knowledge graph auto-build jobs and drafts."""

from __future__ import annotations

import json
import uuid
from typing import Dict, List, Sequence

import database


def create_job() -> str:
    job_id = str(uuid.uuid4())
    with database.get_connection() as conn:
        conn.execute(
            """
            INSERT INTO knowledge_jobs (id, status, total, processed)
            VALUES (?, 'processing', 0, 0)
            """,
            (job_id,),
        )
        conn.commit()
    return job_id


def update_job(job_id: str, status: str = None, total: int = None, processed: int = None) -> None:
    fields = []
    params = []
    if status is not None:
        fields.append("status = ?")
        params.append(status)
    if total is not None:
        fields.append("total = ?")
        params.append(total)
    if processed is not None:
        fields.append("processed = ?")
        params.append(processed)
    if not fields:
        return
    params.append(job_id)
    with database.get_connection() as conn:
        conn.execute(
            f"""
            UPDATE knowledge_jobs
            SET {", ".join(fields)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            params,
        )
        conn.commit()


def get_job(job_id: str) -> Dict[str, object]:
    with database.get_connection() as conn:
        row = conn.execute(
            "SELECT id, status, total, processed, created_at, updated_at FROM knowledge_jobs WHERE id = ?",
            (job_id,),
        ).fetchone()
    if not row:
        return {}
    return dict(row)


def insert_drafts(job_id: str, drafts: Sequence[Dict[str, object]]) -> None:
    with database.get_connection() as conn:
        for draft in drafts:
            draft_id = draft.get("id") or str(uuid.uuid4())
            tags = draft.get("tags") or []
            conn.execute(
                """
                INSERT INTO knowledge_drafts (id, job_id, name, summary, body_html, tags_json, status)
                VALUES (?, ?, ?, ?, ?, ?, 'draft')
                """,
                (
                    draft_id,
                    job_id,
                    draft.get("name", ""),
                    draft.get("summary", ""),
                    draft.get("bodyHtml") or draft.get("content") or "",
                    json.dumps(tags, ensure_ascii=False),
                ),
            )
        conn.commit()


def list_drafts(job_id: str) -> List[Dict[str, object]]:
    with database.get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, job_id, name, summary, body_html, tags_json, status, created_at, updated_at
            FROM knowledge_drafts
            WHERE job_id = ?
            ORDER BY created_at
            """,
            (job_id,),
        ).fetchall()
    drafts: List[Dict[str, object]] = []
    for row in rows:
        draft = dict(row)
        try:
            draft["tags"] = json.loads(draft.pop("tags_json") or "[]")
        except json.JSONDecodeError:
            draft["tags"] = []
        drafts.append(draft)
    return drafts


def mark_drafts(job_id: str, draft_ids: Sequence[str], status: str) -> None:
    if not draft_ids:
        return
    with database.get_connection() as conn:
        conn.executemany(
            """
            UPDATE knowledge_drafts
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE job_id = ? AND id = ?
            """,
            [(status, job_id, d_id) for d_id in draft_ids],
        )
        conn.commit()
