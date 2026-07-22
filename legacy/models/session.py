"""会话模型，统一访问数据库字段。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Optional

from utils.normalizers import normalize_text


def _safe_bool(value: object) -> bool:
    return bool(int(value)) if isinstance(value, (int, float)) else bool(value)


@dataclass
class Session:
    """封装聊天会话的核心字段。"""

    id: str
    user_id: int
    chapter_id: Optional[str]
    section_id: Optional[str]
    scenario: dict
    system_prompt: str
    evaluation_prompt: str
    expects_bargaining: bool
    difficulty: Optional[str] = None

    @classmethod
    def from_record(cls, record: Mapping[str, object]) -> "Session":
        return cls(
            id=str(record.get("id")),
            user_id=int(record.get("user_id")),
            chapter_id=record.get("chapter_id"),
            section_id=record.get("section_id"),
            scenario=record.get("scenario") or {},
            system_prompt=str(record.get("system_prompt") or ""),
            evaluation_prompt=str(record.get("evaluation_prompt") or ""),
            expects_bargaining=_safe_bool(record.get("expects_bargaining")),
            difficulty=normalize_text(record.get("difficulty")) or None,
        )

    def to_dict(self) -> dict:
        """转换为便于序列化的结构。"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "chapter_id": self.chapter_id,
            "section_id": self.section_id,
            "scenario": self.scenario,
            "system_prompt": self.system_prompt,
            "evaluation_prompt": self.evaluation_prompt,
            "expects_bargaining": self.expects_bargaining,
            "difficulty": self.difficulty,
        }
