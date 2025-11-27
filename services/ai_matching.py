"""LLM-powered knowledge point matching (Deepseek)."""

from __future__ import annotations

import json
import os
from typing import Dict, List, Optional, Tuple

from services import llm_service


def _build_prompt(
    selection_text: str,
    candidates: List[Dict[str, object]],
    lesson_context: Optional[Dict[str, object]] = None,
) -> List[Dict[str, str]]:
    compact = []
    for item in candidates:
        compact.append(
            {
                "name": item.get("name", ""),
                "summary": item.get("summary", ""),
                "content": item.get("content") or item.get("bodyHtml") or "",
            }
        )
    context_lines = []
    if lesson_context:
        lesson_title = lesson_context.get("lessonTitle") or ""
        topic_title = lesson_context.get("topicTitle") or ""
        chapter_title = lesson_context.get("chapterTitle") or ""
        joined = " ".join([part for part in [chapter_title, topic_title, lesson_title] if part])
        if joined:
            context_lines.append(f"课程上下文：{joined}")
    instructions = (
        "你是中文教学场景下的知识图谱助手。根据老师选中的中文或英文文本，在候选知识点中找到最匹配的一条。\n"
        "- 只返回一个 knowledge point 的 name；如果没有合理匹配，返回 name 为 \"\"。\n"
        "- 需要给出匹配理由（中文），包括关键对齐点；可简单说明置信度（高/中/低）。\n"
        "- 响应 JSON：{\"name\": \"\", \"reason\": \"置信度+理由\"}\n"
        "- 优先考虑正文(content/bodyHtml/summary)的语义相似，其次标题 name。"
    )
    return [
        {"role": "system", "content": instructions},
        {
            "role": "user",
            "content": json.dumps(
                {
                    "selection": selection_text,
                    "lessonContext": context_lines,
                    "candidates": compact,
                },
                ensure_ascii=False,
            ),
        },
    ]


def match_knowledge_point(
    selection_text: str,
    candidates: List[Dict[str, object]],
    *,
    temperature: float = 0.2,
    lesson_context: Optional[Dict[str, object]] = None,
) -> Tuple[Dict[str, object], float, str]:
    """Return (match_payload, confidence, reason)."""

    api_key = os.getenv("DEEPSEEK_KP_API_KEY") or os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("Deepseek API key not configured (DEEPSEEK_KP_API_KEY or DEEPSEEK_API_KEY)")

    prompt = _build_prompt(selection_text, candidates, lesson_context)
    response = llm_service.complete_chat(api_key, prompt, temperature=temperature)
    try:
        parsed = json.loads(response)
    except Exception:
        parsed = {"name": "", "reason": response.strip()[:200]}

    name = parsed.get("name") if isinstance(parsed, dict) else ""
    reason = parsed.get("reason", "") if isinstance(parsed, dict) else ""
    matched = next((c for c in candidates if c.get("name") == name), None) if name else None
    confidence = 0.75 if matched else 0.0
    return matched or {}, confidence, reason
