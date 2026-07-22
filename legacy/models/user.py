"""用户领域模型，方便在服务层传递结构化数据。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Optional


def _safe_int(value: object) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


@dataclass
class User:
    """封装数据库中的用户记录，便于访问常用字段。"""

    id: int
    username: str
    role: str
    display_name: Optional[str] = None

    @classmethod
    def from_record(cls, record: Mapping[str, object]) -> "User":
        return cls(
            id=_safe_int(record.get("id")),
            username=str(record.get("username") or ""),
            role=str(record.get("role") or ""),
            display_name=record.get("display_name")
            or record.get("displayName")
            or record.get("name"),
        )

    def to_public_dict(self) -> dict:
        """转换为可直接返回给前端的结构。"""
        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "displayName": self.display_name,
        }
