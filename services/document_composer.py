"""开场白与逐字稿辅助。

单一固定案例下，所有单据/合同内容由 David Lim 在英文对话中内联呈现（与已锁定成交条款自洽），
不再注入旧的「带陷阱的审单文档」（那些会与 CIF/L/C/40 天 等锁定事实冲突）。
"""

from __future__ import annotations

from typing import Dict, List, Optional

from utils.language import contains_cjk, is_probably_english
from utils.normalizers import normalize_text


def _compose_default_opening(scenario: Dict[str, object]) -> str:
    ai_role = normalize_text(scenario.get("ai_role")) or "your negotiation partner"
    ai_company = scenario.get("ai_company") or {}
    ai_company_name = normalize_text(ai_company.get("name")) or "our company"
    if contains_cjk(ai_role):
        ai_role = "your negotiation partner"
    if contains_cjk(ai_company_name):
        ai_company_name = "our company"

    greeting = f"Hello, this is {ai_role} from {ai_company_name}. I will keep this brief."

    student_role = normalize_text(scenario.get("student_role")) or ""
    student_company = scenario.get("student_company") or {}
    student_company_name = normalize_text(student_company.get("name")) or ""
    if contains_cjk(student_role):
        student_role = ""
    if contains_cjk(student_company_name):
        student_company_name = ""

    counterpart_fragments: List[str] = []
    if student_role:
        counterpart_fragments.append(student_role)
    if student_company_name:
        counterpart_fragments.append(f"at {student_company_name}")
    counterpart_line = ""
    if counterpart_fragments:
        counterpart_line = "Thank you for joining me as " + " ".join(counterpart_fragments) + "."

    product = scenario.get("product") or {}
    product_name = normalize_text(product.get("name")) or "the current plan"
    if contains_cjk(product_name):
        product_name = "the current plan"

    focus_line = f"I'll start with {product_name} and any priorities you want to address."
    closing_line = "Ready to proceed in English whenever you are ready."

    parts = [greeting, counterpart_line, focus_line, closing_line]
    return " ".join(part.strip() for part in parts if part)


def generate_opening_message(section_id: Optional[str], scenario: Dict[str, object]) -> str:
    """优先使用关卡固定场景里的 opening_message（David Lim 的英文开场）。"""
    for key in ("openingMessage", "opening_message", "opening", "conversation_opening"):
        value = scenario.get(key)
        if isinstance(value, str):
            stripped = value.strip()
            if stripped and is_probably_english(stripped):
                return stripped

    fallback = _compose_default_opening(scenario)
    return fallback or "Hello, this is your negotiation partner. Let's begin our discussion in English."


def compose_review_document(section_id: Optional[str], scenario: Dict[str, object]) -> str:
    """如关卡固定场景带有 document_snapshot 则返回，否则为空（聊天模式下单据多由对话呈现）。"""
    snapshot = scenario.get("document_snapshot")
    if isinstance(snapshot, str):
        return snapshot.strip()
    return ""


def build_transcript(history: List[Dict[str, str]], scenario: Dict[str, object]) -> str:
    lines: List[str] = []
    lines.append(f"場景標題: {scenario.get('scenario_title', '')}")
    lines.append(f"場景摘要: {scenario.get('scenario_summary', '')}")
    lines.append(f"學生任務: {scenario.get('student_task', '')}")
    lines.append(f"學生角色: {scenario.get('student_role', '')}")
    lines.append(f"AI 角色: {scenario.get('ai_role', '')}")
    lines.append(f"產品資訊: {scenario.get('product', {})}")
    lines.append(f"市場與物流: {scenario.get('market_landscape', '')}；{scenario.get('logistics', '')}")
    lines.append("對話逐字稿：")

    ai_name = "AI"
    ai_company = scenario.get("ai_company", {}) or {}
    if isinstance(ai_company, dict):
        ai_company_name = ai_company.get("name")
        if isinstance(ai_company_name, str) and ai_company_name:
            ai_name = ai_company_name

    for message in history:
        role = message.get("role")
        content = message.get("content", "")
        if role == "user":
            speaker = "學生"
        elif role == "assistant":
            speaker = ai_name
        else:
            speaker = role or "系統"
        lines.append(f"{speaker}: {content}")
    return "\n".join(lines)
