"""语言检测与文本过滤工具，确保对话输出符合英文要求。"""
from __future__ import annotations

from typing import Optional


def contains_cjk(text: Optional[str]) -> bool:
    """快速判断文本中是否包含中日韩字符。"""
    if not isinstance(text, str):
        return False
    for char in text:
        codepoint = ord(char)
        if 0x3400 <= codepoint <= 0x4DBF:
            return True
        if 0x4E00 <= codepoint <= 0x9FFF:
            return True
        if 0x20000 <= codepoint <= 0x2A6DF:
            return True
    return False


def is_probably_english(text: Optional[str]) -> bool:
    """判断文本是否主要为英文，简单排除包含 CJK 字符的情况。"""
    if not isinstance(text, str):
        return False
    stripped = text.strip()
    if not stripped:
        return False
    return not contains_cjk(stripped)
