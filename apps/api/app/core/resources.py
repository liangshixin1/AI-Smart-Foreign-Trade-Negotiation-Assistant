"""Resolve immutable bundled teaching assets without depending on the working directory."""

import sys
from pathlib import Path


def resource_root() -> Path:
    frozen = getattr(sys, "_MEIPASS", None)
    return Path(frozen) if frozen else Path(__file__).resolve().parents[4]


def content_root() -> Path:
    return resource_root() / "content"
