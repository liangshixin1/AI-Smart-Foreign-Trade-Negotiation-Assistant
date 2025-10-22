"""SQLite persistence layer for the AI negotiation tutor application."""

from __future__ import annotations

import json
import os
import secrets
import sqlite3
import uuid
from collections import defaultdict
from contextlib import contextmanager
from typing import Dict, Iterator, List, Optional, Tuple, TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover - typing only
    from levels import ChapterConfig

from werkzeug.security import check_password_hash, generate_password_hash


DATABASE_PATH = os.getenv("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "app.db"))


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
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

            CREATE TABLE IF NOT EXISTS level_chapters (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                order_index INTEGER DEFAULT 0,
                is_default INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS level_sections (
                id TEXT PRIMARY KEY,
                chapter_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                environment_prompt_template TEXT NOT NULL,
                environment_user_message TEXT NOT NULL,
                conversation_prompt_template TEXT NOT NULL,
                evaluation_prompt_template TEXT NOT NULL,
                expects_bargaining INTEGER DEFAULT 0,
                order_index INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_default INTEGER DEFAULT 0,
                FOREIGN KEY(chapter_id) REFERENCES level_chapters(id) ON DELETE CASCADE
            );
            """
        )
        conn.commit()

    ensure_schema()
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


def ensure_schema() -> None:
    with get_connection() as conn:
        chat_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(chat_sessions)").fetchall()
        }
        if "difficulty" not in chat_columns:
            conn.execute(
                "ALTER TABLE chat_sessions ADD COLUMN difficulty TEXT DEFAULT 'balanced'"
            )

        chapter_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(level_chapters)").fetchall()
        }
        if chapter_columns and "is_default" not in chapter_columns:
            conn.execute(
                "ALTER TABLE level_chapters ADD COLUMN is_default INTEGER DEFAULT 0"
            )
        if chapter_columns and "order_index" not in chapter_columns:
            conn.execute(
                "ALTER TABLE level_chapters ADD COLUMN order_index INTEGER DEFAULT 0"
            )

        section_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(level_sections)").fetchall()
        }
        if section_columns and "is_default" not in section_columns:
            conn.execute(
                "ALTER TABLE level_sections ADD COLUMN is_default INTEGER DEFAULT 0"
            )
        if section_columns and "order_index" not in section_columns:
            conn.execute(
                "ALTER TABLE level_sections ADD COLUMN order_index INTEGER DEFAULT 0"
            )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_level_chapters_order ON level_chapters(order_index, title)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_level_sections_chapter_order ON level_sections(chapter_id, order_index)"
        )
        conn.commit()


def _next_order_index(
    conn: sqlite3.Connection, table: str, where_clause: str = "", params: Tuple[object, ...] = ()
) -> int:
    query = f"SELECT COALESCE(MAX(order_index), 0) AS max_index FROM {table}"
    if where_clause:
        query = f"{query} WHERE {where_clause}"
    row = conn.execute(query, params).fetchone()
    max_value = row["max_index"] if row and row["max_index"] is not None else 0
    return int(max_value) + 1


def seed_default_levels(chapters: "List[ChapterConfig]") -> None:
    with get_connection() as conn:
        for chapter_order, chapter in enumerate(chapters, start=1):
            chapter_row = conn.execute(
                "SELECT id, order_index FROM level_chapters WHERE id = ?", (chapter.id,)
            ).fetchone()
            if not chapter_row:
                conn.execute(
                    """
                    INSERT INTO level_chapters (id, title, description, order_index, is_default)
                    VALUES (?, ?, ?, ?, 1)
                    """,
                    (chapter.id, chapter.title, "", chapter_order),
                )
            else:
                conn.execute(
                    "UPDATE level_chapters SET is_default = 1 WHERE id = ?",
                    (chapter.id,),
                )
                if not chapter_row["order_index"]:
                    conn.execute(
                        "UPDATE level_chapters SET order_index = ? WHERE id = ?",
                        (chapter_order, chapter.id),
                    )

            for section_order, section in enumerate(chapter.sections, start=1):
                section_row = conn.execute(
                    "SELECT id, order_index FROM level_sections WHERE id = ?",
                    (section.id,),
                ).fetchone()
                if not section_row:
                    conn.execute(
                        """
                        INSERT INTO level_sections (
                            id, chapter_id, title, description,
                            environment_prompt_template, environment_user_message,
                            conversation_prompt_template, evaluation_prompt_template,
                            expects_bargaining, order_index, is_default
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                        """,
                        (
                            section.id,
                            chapter.id,
                            section.title,
                            section.description,
                            section.environment_prompt_template,
                            section.environment_user_message,
                            section.conversation_prompt_template,
                            section.evaluation_prompt_template,
                            1 if section.expects_bargaining else 0,
                            section_order,
                        ),
                    )
                else:
                    conn.execute(
                        "UPDATE level_sections SET is_default = 1 WHERE id = ?",
                        (section.id,),
                    )
                    if not section_row["order_index"]:
                        conn.execute(
                            "UPDATE level_sections SET order_index = ? WHERE id = ?",
                            (section_order, section.id),
                        )
        conn.commit()


def list_level_hierarchy(include_prompts: bool = False) -> List[Dict[str, object]]:
    with get_connection() as conn:
        chapter_rows = conn.execute(
            """
            SELECT id, title, description, order_index, is_default
            FROM level_chapters
            ORDER BY order_index, title
            """
        ).fetchall()
        section_rows = conn.execute(
            """
            SELECT
                id,
                chapter_id,
                title,
                description,
                environment_prompt_template,
                environment_user_message,
                conversation_prompt_template,
                evaluation_prompt_template,
                expects_bargaining,
                order_index,
                is_default
            FROM level_sections
            ORDER BY chapter_id, order_index, title
            """
        ).fetchall()

    chapter_map: Dict[str, Dict[str, object]] = {}
    for chapter in chapter_rows:
        chapter_map[chapter["id"]] = {
            "id": chapter["id"],
            "title": chapter["title"],
            "description": chapter["description"] or "",
            "orderIndex": chapter["order_index"],
            "isDefault": bool(chapter["is_default"]),
            "sections": [],
        }

    for section in section_rows:
        chapter = chapter_map.get(section["chapter_id"])
        if not chapter:
            continue
        section_payload = {
            "id": section["id"],
            "chapterId": section["chapter_id"],
            "title": section["title"],
            "description": section["description"],
            "expectsBargaining": bool(section["expects_bargaining"]),
            "orderIndex": section["order_index"],
            "isDefault": bool(section["is_default"]),
        }
        if include_prompts:
            section_payload.update(
                {
                    "environmentPromptTemplate": section["environment_prompt_template"],
                    "environmentUserMessage": section["environment_user_message"],
                    "conversationPromptTemplate": section["conversation_prompt_template"],
                    "evaluationPromptTemplate": section["evaluation_prompt_template"],
                }
            )
        chapter["sections"].append(section_payload)

    for chapter in chapter_map.values():
        chapter["sections"].sort(key=lambda s: (s["orderIndex"], s["title"]))

    return sorted(chapter_map.values(), key=lambda c: (c["orderIndex"], c["title"]))


def get_chapter(chapter_id: str) -> Optional[Dict[str, object]]:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT id, title, description, order_index, is_default
            FROM level_chapters
            WHERE id = ?
            """,
            (chapter_id,),
        ).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "title": row["title"],
            "description": row["description"] or "",
            "orderIndex": row["order_index"],
            "isDefault": bool(row["is_default"]),
        }


def get_section_template(chapter_id: str, section_id: str) -> Optional[Dict[str, object]]:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT
                id,
                chapter_id,
                title,
                description,
                environment_prompt_template,
                environment_user_message,
                conversation_prompt_template,
                evaluation_prompt_template,
                expects_bargaining,
                order_index,
                is_default
            FROM level_sections
            WHERE id = ? AND chapter_id = ?
            """,
            (section_id, chapter_id),
        ).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "chapter_id": row["chapter_id"],
            "title": row["title"],
            "description": row["description"],
            "environment_prompt_template": row["environment_prompt_template"],
            "environment_user_message": row["environment_user_message"],
            "conversation_prompt_template": row["conversation_prompt_template"],
            "evaluation_prompt_template": row["evaluation_prompt_template"],
            "expects_bargaining": bool(row["expects_bargaining"]),
            "order_index": row["order_index"],
            "is_default": bool(row["is_default"]),
        }


def get_section(section_id: str) -> Optional[Dict[str, object]]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT chapter_id FROM level_sections WHERE id = ?",
            (section_id,),
        ).fetchone()
    if not row:
        return None
    return get_section_template(row["chapter_id"], section_id)


def create_chapter(
    title: str,
    description: str = "",
    order_index: Optional[int] = None,
    chapter_id: Optional[str] = None,
) -> Dict[str, object]:
    chapter_id = chapter_id or f"chapter-{uuid.uuid4().hex[:8]}"
    with get_connection() as conn:
        if order_index is None:
            order_index = _next_order_index(conn, "level_chapters")
        conn.execute(
            """
            INSERT INTO level_chapters (id, title, description, order_index, is_default)
            VALUES (?, ?, ?, ?, 0)
            """,
            (chapter_id, title, description, order_index),
        )
        conn.commit()
    chapter = get_chapter(chapter_id)
    assert chapter is not None
    return chapter


def update_chapter(
    chapter_id: str,
    *,
    title: Optional[str] = None,
    description: Optional[str] = None,
    order_index: Optional[int] = None,
) -> Optional[Dict[str, object]]:
    fields = []
    params: List[object] = []
    if title is not None:
        fields.append("title = ?")
        params.append(title)
    if description is not None:
        fields.append("description = ?")
        params.append(description)
    if order_index is not None:
        fields.append("order_index = ?")
        params.append(order_index)
    if not fields:
        return get_chapter(chapter_id)
    params.append(chapter_id)
    with get_connection() as conn:
        conn.execute(
            f"UPDATE level_chapters SET {', '.join(fields)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            tuple(params),
        )
        conn.commit()
    return get_chapter(chapter_id)


def delete_chapter(chapter_id: str) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM level_chapters WHERE id = ?", (chapter_id,))
        conn.commit()


def create_section(
    chapter_id: str,
    title: str,
    description: str,
    environment_prompt_template: str,
    environment_user_message: str,
    conversation_prompt_template: str,
    evaluation_prompt_template: str,
    expects_bargaining: bool = False,
    order_index: Optional[int] = None,
    section_id: Optional[str] = None,
) -> Optional[Dict[str, object]]:
    with get_connection() as conn:
        chapter_exists = conn.execute(
            "SELECT 1 FROM level_chapters WHERE id = ?",
            (chapter_id,),
        ).fetchone()
        if not chapter_exists:
            return None
        section_id = section_id or f"section-{uuid.uuid4().hex[:10]}"
        if order_index is None:
            order_index = _next_order_index(
                conn, "level_sections", "chapter_id = ?", (chapter_id,)
            )
        conn.execute(
            """
            INSERT INTO level_sections (
                id, chapter_id, title, description,
                environment_prompt_template, environment_user_message,
                conversation_prompt_template, evaluation_prompt_template,
                expects_bargaining, order_index, is_default
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            """,
            (
                section_id,
                chapter_id,
                title,
                description,
                environment_prompt_template,
                environment_user_message,
                conversation_prompt_template,
                evaluation_prompt_template,
                1 if expects_bargaining else 0,
                order_index,
            ),
        )
        conn.commit()
    return get_section(section_id)


def update_section(
    section_id: str,
    *,
    chapter_id: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
    environment_prompt_template: Optional[str] = None,
    environment_user_message: Optional[str] = None,
    conversation_prompt_template: Optional[str] = None,
    evaluation_prompt_template: Optional[str] = None,
    expects_bargaining: Optional[bool] = None,
    order_index: Optional[int] = None,
) -> Optional[Dict[str, object]]:
    section = get_section(section_id)
    if not section:
        return None

    with get_connection() as conn:
        if chapter_id and chapter_id != section["chapter_id"]:
            chapter_exists = conn.execute(
                "SELECT 1 FROM level_chapters WHERE id = ?",
                (chapter_id,),
            ).fetchone()
            if not chapter_exists:
                return None
        updates = []
        params: List[object] = []
        if chapter_id is not None:
            updates.append("chapter_id = ?")
            params.append(chapter_id)
        if title is not None:
            updates.append("title = ?")
            params.append(title)
        if description is not None:
            updates.append("description = ?")
            params.append(description)
        if environment_prompt_template is not None:
            updates.append("environment_prompt_template = ?")
            params.append(environment_prompt_template)
        if environment_user_message is not None:
            updates.append("environment_user_message = ?")
            params.append(environment_user_message)
        if conversation_prompt_template is not None:
            updates.append("conversation_prompt_template = ?")
            params.append(conversation_prompt_template)
        if evaluation_prompt_template is not None:
            updates.append("evaluation_prompt_template = ?")
            params.append(evaluation_prompt_template)
        if expects_bargaining is not None:
            updates.append("expects_bargaining = ?")
            params.append(1 if expects_bargaining else 0)
        target_chapter_id = chapter_id if chapter_id is not None else section["chapter_id"]
        if order_index is not None:
            updates.append("order_index = ?")
            params.append(order_index)
        elif chapter_id and chapter_id != section["chapter_id"]:
            new_index = _next_order_index(
                conn, "level_sections", "chapter_id = ?", (target_chapter_id,)
            )
            updates.append("order_index = ?")
            params.append(new_index)

        if updates:
            params.append(section_id)
            conn.execute(
                f"UPDATE level_sections SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                tuple(params),
            )
            conn.commit()

    return get_section(section_id)


def delete_section(section_id: str) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM level_sections WHERE id = ?", (section_id,))
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
    difficulty: str,
) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO chat_sessions (
                id, user_id, chapter_id, section_id, system_prompt,
                evaluation_prompt, scenario_json, expects_bargaining, difficulty
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                difficulty,
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


def reset_session(session_id: str) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
        conn.execute("DELETE FROM evaluations WHERE session_id = ?", (session_id,))
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
                   evaluation_prompt, scenario_json, expects_bargaining, difficulty
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
            "difficulty": row["difficulty"],
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
                   s.difficulty,
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
                "difficulty": row["difficulty"],
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
                   s.difficulty,
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
                    "difficulty": session["difficulty"],
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


def get_student_dashboard(user_id: int) -> Dict[str, object]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT e.session_id, e.score, e.score_label, e.commentary,
                   e.action_items_json, e.knowledge_points_json, e.bargaining_win_rate,
                   e.created_at,
                   s.chapter_id, s.section_id, s.difficulty,
                   json_extract(s.scenario_json, '$.scenario_title') AS title
            FROM evaluations e
            JOIN chat_sessions s ON s.id = e.session_id
            WHERE s.user_id = ?
            ORDER BY e.created_at ASC, e.id ASC
            """,
            (user_id,),
        ).fetchall()

    timeline: List[Dict[str, object]] = []
    knowledge_totals: Dict[str, Dict[str, float]] = defaultdict(
        lambda: {"score_sum": 0.0, "score_count": 0, "count": 0}
    )
    knowledge_latest: Dict[str, Dict[str, object]] = {}

    for row in rows:
        knowledge = []
        if row["knowledge_points_json"]:
            try:
                knowledge = json.loads(row["knowledge_points_json"])
            except json.JSONDecodeError:
                knowledge = []

        score = row["score"]
        bargaining = row["bargaining_win_rate"]
        score_for_skill: Optional[float] = None
        if score is not None:
            score_for_skill = float(score)
        elif bargaining is not None:
            score_for_skill = float(bargaining)

        timeline.append(
            {
                "sessionId": row["session_id"],
                "title": row["title"],
                "chapterId": row["chapter_id"],
                "sectionId": row["section_id"],
                "score": row["score"],
                "scoreLabel": row["score_label"],
                "bargainingWinRate": bargaining,
                "createdAt": row["created_at"],
                "knowledgePoints": knowledge,
                "difficulty": row["difficulty"],
            }
        )

        for kp in knowledge:
            stats = knowledge_totals[kp]
            stats["count"] += 1
            if score_for_skill is not None:
                stats["score_sum"] += score_for_skill
                stats["score_count"] += 1

            latest = knowledge_latest.get(kp)
            if not latest or row["created_at"] >= latest.get("created_at", ""):
                knowledge_latest[kp] = {
                    "latest_score": score_for_skill,
                    "created_at": row["created_at"],
                }

    knowledge_radar: List[Dict[str, object]] = []
    for kp, stats in knowledge_totals.items():
        average = None
        if stats["score_count"]:
            average = stats["score_sum"] / stats["score_count"]
        knowledge_radar.append(
            {
                "label": kp,
                "averageScore": average,
                "count": stats["count"],
            }
        )

    knowledge_radar.sort(key=lambda item: (-item["count"], item["label"]))

    recent_knowledge: List[Dict[str, object]] = []
    for kp, latest in knowledge_latest.items():
        stats = knowledge_totals[kp]
        entry = {
            "label": kp,
            "count": stats["count"],
            "latestScore": latest.get("latest_score"),
        }
        if stats["score_count"]:
            entry["averageScore"] = stats["score_sum"] / stats["score_count"]
        recent_knowledge.append(entry)

    recent_knowledge.sort(key=lambda item: (-item["count"], item["label"]))

    return {
        "timeline": timeline,
        "knowledgeRadar": knowledge_radar[:10],
        "recentKnowledge": recent_knowledge[:12],
    }


def get_class_analytics() -> Dict[str, object]:
    with get_connection() as conn:
        trend_rows = conn.execute(
            """
            SELECT s.chapter_id, s.section_id,
                   json_extract(s.scenario_json, '$.scenario_title') AS title,
                   strftime('%Y-%W', e.created_at) AS week,
                   AVG(e.score) AS avg_score,
                   AVG(e.bargaining_win_rate) AS avg_bargaining,
                   COUNT(*) AS sample_size
            FROM evaluations e
            JOIN chat_sessions s ON s.id = e.session_id
            GROUP BY s.chapter_id, s.section_id, week
            ORDER BY week DESC, s.chapter_id, s.section_id
            LIMIT 60
            """
        ).fetchall()

        knowledge_rows = conn.execute(
            """
            SELECT kp.value AS knowledge_point, e.score, e.bargaining_win_rate
            FROM evaluations e
            JOIN json_each(e.knowledge_points_json) AS kp
            WHERE kp.value IS NOT NULL AND kp.value != ''
            """
        ).fetchall()

        action_rows = conn.execute(
            """
            SELECT kp.value AS action_item
            FROM evaluations e
            JOIN json_each(e.action_items_json) AS kp
            WHERE kp.value IS NOT NULL AND kp.value != ''
            """
        ).fetchall()

    weekly_trends: List[Dict[str, object]] = []
    for row in trend_rows:
        week_label = row["week"] or ""
        if week_label and "-" in week_label:
            year, week_num = week_label.split("-", 1)
            week_label = f"{year}年第{week_num}周"
        average_score = row["avg_score"] if row["avg_score"] is not None else row["avg_bargaining"]
        weekly_trends.append(
            {
                "chapterId": row["chapter_id"],
                "sectionId": row["section_id"],
                "sectionTitle": row["title"],
                "week": row["week"],
                "weekLabel": week_label,
                "averageScore": average_score,
                "sampleSize": row["sample_size"],
            }
        )

    knowledge_stats: Dict[str, Dict[str, float]] = defaultdict(
        lambda: {"count": 0, "score_sum": 0.0, "score_count": 0}
    )
    for row in knowledge_rows:
        kp = row["knowledge_point"]
        stats = knowledge_stats[kp]
        stats["count"] += 1
        value = row["score"] if row["score"] is not None else row["bargaining_win_rate"]
        if value is not None:
            stats["score_sum"] += float(value)
            stats["score_count"] += 1

    knowledge_weakness = []
    for kp, stats in knowledge_stats.items():
        entry = {
            "label": kp,
            "knowledgePoint": kp,
            "count": stats["count"],
        }
        if stats["score_count"]:
            entry["averageScore"] = stats["score_sum"] / stats["score_count"]
        knowledge_weakness.append(entry)

    knowledge_weakness.sort(key=lambda item: (-item["count"], item["label"]))

    action_counts: Dict[str, int] = defaultdict(int)
    for row in action_rows:
        action_counts[row["action_item"]] += 1

    action_hotspots = [
        {"label": label, "actionItem": label, "count": count}
        for label, count in action_counts.items()
    ]
    action_hotspots.sort(key=lambda item: (-item["count"], item["label"]))

    return {
        "weeklyTrends": weekly_trends[:20],
        "knowledgeWeakness": knowledge_weakness[:15],
        "actionHotspots": action_hotspots[:15],
    }


def delete_session(session_id: str) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
        conn.commit()

