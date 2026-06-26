"""迁移 004：将默认关卡重建为 NovaTech 单一案例的 9 流程 / 20 关卡。

动作（幂等）：
1. 用 levels.CHAPTERS 重新种子（新结构 chapter-0..8，并刷新已存在默认关卡的内容）。
2. 把「将被移除的旧默认章节」（如 chapter-9 / chapter-10）下的 theory_topics 改挂到 chapter-8，
   避免外键级联（ON DELETE CASCADE）删除理论内容。
3. 删除不在新结构内的「默认」小节与章节（teacher 自建的 is_default=0 一律保留）。

仅影响 is_default=1 的系统默认关卡；学生历史会话存有自身场景快照，不受影响。

用法：python migrations/004_rebuild_levels_novatech.py
"""

from __future__ import annotations

import os
import sys
from typing import Dict, Set

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import database  # noqa: E402
from levels import CHAPTERS  # noqa: E402

# 旧结构被移除的章节折叠到的目标章节（理论内容改挂到此）。
FOLD_TARGET_CHAPTER = "chapter-8"


def upgrade() -> Dict[str, int]:
    new_chapter_ids: Set[str] = {chapter.id for chapter in CHAPTERS}
    new_section_ids: Set[str] = {
        section.id for chapter in CHAPTERS for section in chapter.sections
    }

    # 1) 重新种子（插入缺失 + 刷新已存在默认关卡内容）。
    database.seed_default_levels(CHAPTERS)

    stats = {"theory_reassigned": 0, "sections_deleted": 0, "chapters_deleted": 0}

    with database.get_connection() as conn:
        # 找出将被移除的旧默认章节。
        stale_chapter_rows = conn.execute(
            "SELECT id FROM level_chapters WHERE is_default = 1"
        ).fetchall()
        stale_chapter_ids = [
            row["id"] for row in stale_chapter_rows if row["id"] not in new_chapter_ids
        ]

        # 2) 改挂这些章节下的 theory_topics 到折叠目标章节，保住理论内容。
        target_exists = conn.execute(
            "SELECT 1 FROM level_chapters WHERE id = ?", (FOLD_TARGET_CHAPTER,)
        ).fetchone()
        has_theory_topics = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='theory_topics'"
        ).fetchone()
        if stale_chapter_ids and target_exists and has_theory_topics:
            placeholders = ",".join("?" for _ in stale_chapter_ids)
            cur = conn.execute(
                f"UPDATE theory_topics SET chapter_id = ? WHERE chapter_id IN ({placeholders})",
                (FOLD_TARGET_CHAPTER, *stale_chapter_ids),
            )
            stats["theory_reassigned"] = cur.rowcount or 0

        # 3) 删除不在新结构内的默认小节（theory_lessons.section_id / assignments 走 SET NULL，安全）。
        section_rows = conn.execute(
            "SELECT id FROM level_sections WHERE is_default = 1"
        ).fetchall()
        stale_section_ids = [
            row["id"] for row in section_rows if row["id"] not in new_section_ids
        ]
        for section_id in stale_section_ids:
            conn.execute("DELETE FROM level_sections WHERE id = ?", (section_id,))
        stats["sections_deleted"] = len(stale_section_ids)

        # 4) 删除不在新结构内的默认章节（theory 已改挂，级联无可删）。
        for chapter_id in stale_chapter_ids:
            conn.execute("DELETE FROM level_chapters WHERE id = ?", (chapter_id,))
        stats["chapters_deleted"] = len(stale_chapter_ids)

        conn.commit()

    return stats


if __name__ == "__main__":
    database.init_database()
    result = upgrade()
    print("迁移 004 完成：")
    print(f"  理论主题改挂: {result['theory_reassigned']}")
    print(f"  删除旧默认小节: {result['sections_deleted']}")
    print(f"  删除旧默认章节: {result['chapters_deleted']}")
    # 校验结果
    chapters = database.list_level_hierarchy(include_prompts=False)
    total_sections = sum(len(c.get("sections", [])) for c in chapters)
    print(f"  当前章节数: {len(chapters)}，小节数: {total_sections}")
