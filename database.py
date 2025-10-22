"""SQLite persistence layer for the AI negotiation tutor application."""

from __future__ import annotations

import json
import os
import secrets
import sqlite3
from contextlib import contextmanager
from typing import Dict, Iterator, List, Optional

from werkzeug.security import check_password_hash, generate_password_hash


DATABASE_PATH = os.getenv("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "app.db"))


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_database() -> None:
    os.makedirs(os.path.dirname(DATABASE_PATH) or ".", exist_ok=True)
    with get_connection() as conn:
        conn.executescript(
            """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS auth_tokens (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                chapter_id TEXT NOT NULL,
                section_id TEXT NOT NULL,
                system_prompt TEXT NOT NULL,
                evaluation_prompt TEXT NOT NULL,
                scenario_json TEXT NOT NULL,
                expects_bargaining INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS evaluations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                score REAL,
                score_label TEXT,
                commentary TEXT,
                action_items_json TEXT,
                knowledge_points_json TEXT,
                bargaining_win_rate REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
            );
            """
        )
        conn.commit()

    ensure_default_users()


def ensure_default_users() -> None:
    defaults = [
        ("0000", "0000", "student"),
        ("0001", "0001", "teacher"),
    ]
    with get_connection() as conn:
        for username, password, role in defaults:
            row = conn.execute(
                "SELECT id FROM users WHERE username = ?", (username,)
            ).fetchone()
            if row:
                continue
            conn.execute(
                "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                (username, generate_password_hash(password), role),
            )
        conn.commit()


def authenticate_user(username: str, password: str) -> Optional[Dict[str, object]]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash, role FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if not row:
            return None
        if not check_password_hash(row["password_hash"], password):
            return None
        return {
            "id": row["id"],
            "username": row["username"],
            "role": row["role"],
        }


def issue_auth_token(user_id: int) -> str:
    token = secrets.token_hex(32)
    with get_connection() as conn:
        conn.execute("DELETE FROM auth_tokens WHERE user_id = ?", (user_id,))
        conn.execute(
            "INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)", (token, user_id)
        )
        conn.commit()
    return token


def get_user_by_token(token: str) -> Optional[Dict[str, object]]:
    if not token:
        return None
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.username, u.role
            FROM auth_tokens t
            JOIN users u ON u.id = t.user_id
            WHERE t.token = ?
            """,
            (token,),
        ).fetchone()
        if not row:
            return None
        return {"id": row["id"], "username": row["username"], "role": row["role"]}


def create_session(
    session_id: str,
    user_id: int,
    chapter_id: str,
    section_id: str,
    system_prompt: str,
    evaluation_prompt: str,
    scenario: Dict[str, object],
    expects_bargaining: bool,
) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO chat_sessions (
                id, user_id, chapter_id, section_id, system_prompt,
                evaluation_prompt, scenario_json, expects_bargaining
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                user_id,
                chapter_id,
                section_id,
                system_prompt,
                evaluation_prompt,
                json.dumps(scenario, ensure_ascii=False),
                1 if expects_bargaining else 0,
            ),
        )
        conn.commit()


def add_message(session_id: str, role: str, content: str) -> None:
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
            (session_id, role, content),
        )
        conn.execute(
            "UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (session_id,),
        )
        conn.commit()


def remove_last_message(session_id: str) -> None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT 1",
            (session_id,),
        ).fetchone()
        if not row:
            return
        conn.execute("DELETE FROM messages WHERE id = ?", (row["id"],))
        conn.execute(
            "UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (session_id,),
        )
        conn.commit()


def get_session(session_id: str) -> Optional[Dict[str, object]]:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT id, user_id, chapter_id, section_id, system_prompt,
                   evaluation_prompt, scenario_json, expects_bargaining
            FROM chat_sessions WHERE id = ?
            """,
            (session_id,),
        ).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "user_id": row["user_id"],
            "chapter_id": row["chapter_id"],
            "section_id": row["section_id"],
            "system_prompt": row["system_prompt"],
            "evaluation_prompt": row["evaluation_prompt"],
            "scenario": json.loads(row["scenario_json"]),
            "expects_bargaining": bool(row["expects_bargaining"]),
        }


def get_messages(session_id: str) -> List[Dict[str, object]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT role, content, created_at FROM messages WHERE session_id = ? ORDER BY id",
            (session_id,),
        ).fetchall()
        return [
            {"role": row["role"], "content": row["content"], "createdAt": row["created_at"]}
            for row in rows
        ]


def list_sessions_for_user(user_id: int) -> List[Dict[str, object]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT s.id, s.chapter_id, s.section_id, s.updated_at, s.created_at,
                   json_extract(s.scenario_json, '$.scenario_title') AS scenario_title,
                   json_extract(s.scenario_json, '$.scenario_summary') AS scenario_summary
            FROM chat_sessions s
            WHERE s.user_id = ?
            ORDER BY s.updated_at DESC
            """,
            (user_id,),
        ).fetchall()
        return [
            {
                "id": row["id"],
                "chapterId": row["chapter_id"],
                "sectionId": row["section_id"],
                "title": row["scenario_title"],
                "summary": row["scenario_summary"],
                "updatedAt": row["updated_at"],
                "createdAt": row["created_at"],
            }
            for row in rows
        ]


def save_evaluation(session_id: str, evaluation: Dict[str, object]) -> None:
    action_items = evaluation.get("actionItems", [])
    knowledge_points = evaluation.get("knowledgePoints", [])
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO evaluations (
                session_id, score, score_label, commentary,
                action_items_json, knowledge_points_json, bargaining_win_rate
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                evaluation.get("score"),
                evaluation.get("scoreLabel"),
                evaluation.get("commentary"),
                json.dumps(action_items, ensure_ascii=False),
                json.dumps(knowledge_points, ensure_ascii=False),
                evaluation.get("bargainingWinRate"),
            ),
        )
        conn.execute(
            "UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (session_id,),
        )
        conn.commit()


def get_latest_evaluation(session_id: str) -> Optional[Dict[str, object]]:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT score, score_label, commentary, action_items_json,
                   knowledge_points_json, bargaining_win_rate, created_at
            FROM evaluations
            WHERE session_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            """,
            (session_id,),
        ).fetchone()
        if not row:
            return None
        return {
            "score": row["score"],
            "scoreLabel": row["score_label"],
            "commentary": row["commentary"],
            "actionItems": json.loads(row["action_items_json"]) if row["action_items_json"] else [],
            "knowledgePoints": json.loads(row["knowledge_points_json"])
            if row["knowledge_points_json"]
            else [],
            "bargainingWinRate": row["bargaining_win_rate"],
            "createdAt": row["created_at"],
        }


def list_students_progress() -> List[Dict[str, object]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT u.id, u.username,
                   COUNT(DISTINCT s.id) AS session_count,
                   COUNT(DISTINCT e.id) AS evaluation_count,
                   MAX(s.updated_at) AS last_active
            FROM users u
            LEFT JOIN chat_sessions s ON s.user_id = u.id
            LEFT JOIN evaluations e ON e.session_id = s.id
            WHERE u.role = 'student'
            GROUP BY u.id, u.username
            ORDER BY u.username
            """
        ).fetchall()
        return [
            {
                "id": row["id"],
                "username": row["username"],
                "sessionCount": row["session_count"],
                "evaluationCount": row["evaluation_count"],
                "lastActive": row["last_active"],
            }
            for row in rows
        ]


def get_student_detail(student_id: int) -> Optional[Dict[str, object]]:
    with get_connection() as conn:
        user_row = conn.execute(
            "SELECT id, username, role, created_at FROM users WHERE id = ?", (student_id,)
        ).fetchone()
        if not user_row or user_row["role"] != "student":
            return None

        sessions = conn.execute(
            """
            SELECT s.id, s.chapter_id, s.section_id, s.updated_at, s.created_at,
                   json_extract(s.scenario_json, '$.scenario_title') AS title,
                   json_extract(s.scenario_json, '$.scenario_summary') AS summary
            FROM chat_sessions s
            WHERE s.user_id = ?
            ORDER BY s.updated_at DESC
            """,
            (student_id,),
        ).fetchall()

        result_sessions: List[Dict[str, object]] = []
        for session in sessions:
            eval_row = conn.execute(
                """
                SELECT score, score_label, bargaining_win_rate, created_at
                FROM evaluations
                WHERE session_id = ?
                ORDER BY created_at DESC, id DESC
                LIMIT 1
                """,
                (session["id"],),
            ).fetchone()
            result_sessions.append(
                {
                    "id": session["id"],
                    "chapterId": session["chapter_id"],
                    "sectionId": session["section_id"],
                    "title": session["title"],
                    "summary": session["summary"],
                    "updatedAt": session["updated_at"],
                    "createdAt": session["created_at"],
                    "latestEvaluation": {
                        "score": eval_row["score"] if eval_row else None,
                        "scoreLabel": eval_row["score_label"] if eval_row else None,
                        "bargainingWinRate": eval_row["bargaining_win_rate"] if eval_row else None,
                        "createdAt": eval_row["created_at"] if eval_row else None,
                    }
                    if eval_row
                    else None,
                }
            )

        return {
            "id": user_row["id"],
            "username": user_row["username"],
            "role": user_row["role"],
            "createdAt": user_row["created_at"],
            "sessions": result_sessions,
        }


def delete_session(session_id: str) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
        conn.commit()

