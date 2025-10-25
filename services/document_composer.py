"""用于生成开场邮件、合同等文档段落的服务。"""

from __future__ import annotations

import uuid
from typing import Callable, Dict, List, Optional, Tuple

from utils.language import contains_cjk, is_probably_english


CJK_OPENING_SECTIONS = {"chapter-0-section-1"}
from utils.normalizers import (
    extract_numeric_value,
    format_currency,
    normalize_text,
    resolve_company_name,
)


def _resolve_party_details(scenario: Dict[str, object]) -> Tuple[str, str, str]:
    ai_company = scenario.get("ai_company") or {}
    student_company = scenario.get("student_company") or {}
    seller_name = resolve_company_name(ai_company, "Seller")
    buyer_name = resolve_company_name(student_company, "Buyer")
    buyer_contact = normalize_text(scenario.get("student_role")) or "Procurement Team"
    return seller_name, buyer_name, buyer_contact


def _resolve_product_context(
    scenario: Dict[str, object]
) -> Tuple[Dict[str, object], str, str, str, Optional[float]]:
    product = scenario.get("product") or {}
    product_name = normalize_text(product.get("name")) or "Product"
    product_specs = normalize_text(product.get("specifications"))
    quantity_text = normalize_text(product.get("quantity_requirement")) or ""
    quantity_value = extract_numeric_value(quantity_text)
    return product, product_name, product_specs, quantity_text, quantity_value


def _compose_quotation_review_opening(scenario: Dict[str, object]) -> str:
    seller_name, buyer_name, buyer_contact = _resolve_party_details(scenario)
    product, product_name, product_specs, quantity_text, quantity_value = _resolve_product_context(
        scenario
    )

    price_expectation = product.get("price_expectation") or {}
    ai_bottom_line = normalize_text(price_expectation.get("ai_bottom_line"))
    student_target = normalize_text(price_expectation.get("student_target"))

    lines = [
        "Quotation Review Summary",
        f"Seller: {seller_name}",
        f"Buyer: {buyer_name}",
        f"Attention: {buyer_contact}",
        "",
        f"Product: {product_name} ({product_specs or 'specifications TBD'})",
        f"Requested Quantity: {quantity_text or 'Awaiting confirmation'}",
        f"Student Target Price: {student_target or 'Not provided'}",
        f"AI Bottom Line: {ai_bottom_line or 'Not provided'}",
        "",
        "Key Observations:",
        "- 请关注是否有额外的付款条款或服务承诺需要强调。",
        "- 根据谈判记录，建议列出学生必须回应的澄清问题。",
    ]
    return "\n".join(lines)


def _compose_proforma_invoice_opening(scenario: Dict[str, object]) -> str:
    seller_name, buyer_name, buyer_contact = _resolve_party_details(scenario)
    product, product_name, product_specs, quantity_text, quantity_value = _resolve_product_context(
        scenario
    )
    adjusted_quantity = None
    if quantity_value is not None:
        adjusted_quantity = max(1, int(round(quantity_value * 1.08)))
        quantity_display = f"{adjusted_quantity:,} units"
    elif quantity_text:
        quantity_display = f"{quantity_text} (minimum uplift applied)"
    else:
        quantity_display = "To be confirmed"

    price_expectation = product.get("price_expectation") or {}
    base_price = extract_numeric_value(price_expectation.get("ai_bottom_line"))
    if base_price is None:
        base_price = extract_numeric_value(price_expectation.get("student_target"))
    adjusted_price = None
    if base_price is not None:
        adjusted_price = round(base_price * 1.12, 2)
    unit_price = format_currency(adjusted_price)

    line_total = "TBD"
    if adjusted_price is not None and adjusted_quantity is not None:
        line_total = format_currency(adjusted_price * adjusted_quantity)

    timeline = normalize_text(scenario.get("timeline"))
    logistics = normalize_text(scenario.get("logistics"))

    lines = [
        "Proforma Invoice Draft",
        f"Seller: {seller_name}",
        f"Buyer: {buyer_name}",
        f"Attention: {buyer_contact}",
        "",
        f"Product: {product_name} ({product_specs or 'specifications TBD'})",
        f"Quantity: {quantity_display}",
        f"Unit Price: {unit_price}",
        f"Proforma Amount: {line_total}",
        "",
        "Commercial Terms:",
        "- Payment: 50% deposit within 3 working days, balance before shipment.",
        "- Incoterm: FOB main China port, buyer to arrange insurance.",
        "- Inspection: Supplier in-house inspection report provided upon request.",
    ]

    if logistics:
        lines.append(
            f"- Logistics Note: Earlier discussion mentioned {logistics}; routing cost variations may apply."
        )

    if timeline:
        lines.append(
            f"- Lead Time: 35 days after deposit confirmation (not aligned with earlier {timeline})."
        )
    else:
        lines.append("- Lead Time: 35 days after deposit confirmation.")

    lines.extend(
        [
            "- Surcharge: USD 520 compliance & certification fee billed separately and non-refundable.",
            "- Validity: Quote stands for 24 hours due to supply volatility.",
            "- Warranty: Limited 30-day coverage on manufacturing defects only; logistics damages excluded.",
            "",
            "Please review the above quotation carefully and advise if any discrepancies require correction.",
        ]
    )

    return "\n".join(lines)


def _compose_final_contract_opening(scenario: Dict[str, object]) -> str:
    seller_name, buyer_name, buyer_contact = _resolve_party_details(scenario)
    product, product_name, product_specs, quantity_text, quantity_value = _resolve_product_context(
        scenario
    )

    contracted_quantity: Optional[int] = None
    if quantity_value is not None:
        contracted_quantity = max(1, int(round(quantity_value * 1.05)))
        quantity_display = f"{contracted_quantity:,} units"
    elif quantity_text:
        quantity_display = f"{quantity_text} (subject to automatic uplift clause)"
    else:
        quantity_display = "To be agreed"

    price_expectation = product.get("price_expectation") or {}
    base_price_value = extract_numeric_value(
        price_expectation.get("ai_bottom_line")
    ) or extract_numeric_value(price_expectation.get("student_target"))
    adjusted_price = None
    if base_price_value is not None:
        adjusted_price = round(base_price_value * 1.09, 2)

    unit_price_display = format_currency(adjusted_price)

    line_total = "TBD"
    if adjusted_price is not None and contracted_quantity is not None:
        line_total = format_currency(adjusted_price * contracted_quantity)

    specs_fragment = f" ({product_specs})" if product_specs else ""
    timeline = normalize_text(scenario.get("timeline"))
    logistics = normalize_text(scenario.get("logistics"))

    lines = [
        "Sales Contract Draft",
        f"Contract ID: SC-{uuid.uuid4().hex[:6].upper()}",
        f"Seller: {seller_name}",
        f"Buyer: {buyer_name}",
        f"Attention: {buyer_contact}",
        "",
        "1. Goods & Specifications:",
        f"   - Product: {product_name}{specs_fragment}",
        f"   - Quantity: {quantity_display}",
        f"   - Unit Price: {unit_price_display}",
        f"   - Contract Amount: {line_total}",
        "",
        "2. Delivery & Logistics:",
    ]

    if logistics:
        lines.append(
            f"   - Term: DAP destination warehouse (supersedes earlier note: {logistics})."
        )
    else:
        lines.append("   - Term: DAP destination warehouse, routing confirmed by seller.")

    if timeline:
        lines.append(
            f"   - Shipment Window: 45 days after deposit receipt, regardless of prior {timeline}."
        )
    else:
        lines.append("   - Shipment Window: 45 days after deposit receipt.")

    lines.extend(
        [
            "   - Insurance: Basic coverage arranged by seller; buyer bears war-risk surcharges.",
            "",
            "3. Payment & Financial Terms:",
            "   - 60% non-refundable deposit by T/T within 3 days of signing.",
            "   - 40% balance released after seller-issued inspection memo (no third-party report).",
            "   - Late payment incurs 0.8% daily penalty compounded.",
            "",
            "4. Additional Clauses:",
            "   - Quality claims must be lodged within 5 days of arrival with video evidence only.",
            "   - Unilateral order cancellation forfeits all deposits and future allocation priority.",
            "   - Governing law: Seller's local jurisdiction; disputes settled via seller-appointed arbitrator.",
            "",
            "Please review the contract draft carefully and confirm acceptance or specify revisions required.",
        ]
    )

    return "\n".join(lines)


DOCUMENT_OPENING_BUILDERS: Dict[str, Callable[[Dict[str, object]], str]] = {
    "chapter-4-section-1": _compose_quotation_review_opening,
    "chapter-4-section-2": _compose_proforma_invoice_opening,
    "chapter-4-section-5": _compose_final_contract_opening,
}


def _compose_default_opening(scenario: Dict[str, object]) -> str:
    ai_role = normalize_text(scenario.get("ai_role")) or "your negotiation partner"
    ai_company = scenario.get("ai_company") or {}
    ai_company_name = normalize_text(ai_company.get("name")) or "our company"
    if contains_cjk(ai_role):
        ai_role = "your negotiation partner"
    if contains_cjk(ai_company_name):
        ai_company_name = "our company"

    greeting = f"Hello, this is {ai_role} from {ai_company_name}."

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
        counterpart_line = (
            "Thank you for joining me "
            + ("as " + " ".join(counterpart_fragments))
            + " to review today's objectives."
        )

    product = scenario.get("product") or {}
    product_name = normalize_text(product.get("name")) or "the current plan"
    if contains_cjk(product_name):
        product_name = "the current plan"

    focus_line = (
        f"I'd like to start by aligning on {product_name} and any priorities you want to address."
    )

    closing_line = "I'm ready to begin our discussion in English whenever you are ready."

    parts = [greeting, counterpart_line, focus_line, closing_line]
    return " ".join(part.strip() for part in parts if part)


def generate_opening_message(section_id: Optional[str], scenario: Dict[str, object]) -> str:
    normalized_id = section_id or ""
    allow_cjk = normalized_id in CJK_OPENING_SECTIONS
    builder: Optional[Callable[[Dict[str, object]], str]] = DOCUMENT_OPENING_BUILDERS.get(
        normalized_id
    )
    if builder:
        candidate = builder(scenario)
        if isinstance(candidate, str):
            stripped = candidate.strip()
            if stripped and (allow_cjk or is_probably_english(stripped)):
                return stripped

    for key in (
        "openingMessage",
        "opening_message",
        "opening",
        "conversation_opening",
    ):
        value = scenario.get(key)
        if isinstance(value, str):
            stripped = value.strip()
            if stripped and (allow_cjk or is_probably_english(stripped)):
                return stripped

    fallback = _compose_default_opening(scenario)
    return fallback or "Hello, this is your negotiation partner. Let's begin our discussion in English."


def build_transcript(history: List[Dict[str, str]], scenario: Dict[str, object]) -> str:
    lines: List[str] = []
    lines.append(f"場景標題: {scenario.get('scenario_title', '')}")
    lines.append(f"場景摘要: {scenario.get('scenario_summary', '')}")
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
