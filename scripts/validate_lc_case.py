"""Audit the unpublished LC case; never turn proposals into approved facts."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASE = ROOT / "content/document-correction/cases/chapter-6-section-1-case-v1.json"


def validate_case(
    case: dict, root: Path, *, require_approved: bool = False
) -> list[str]:
    errors: list[str] = []
    if case.get("schema_version") != "lc.case.v1":
        errors.append("document.schema_unsupported")
    facts = case.get("facts", [])
    ids = [fact["fact_id"] for fact in facts]
    if len(ids) != len(set(ids)):
        errors.append("document.duplicate_fact_id")
    values = {fact["fact_id"]: fact["value"] for fact in facts}
    try:
        total = Decimal(str(values["goods.quantity"])) * Decimal(
            values["amount.unit_price"]
        )
        if not total.is_finite() or total != Decimal(values["amount.total"]):
            errors.append("document.amount_inconsistent")
    except (KeyError, ValueError, ArithmeticError):
        errors.append("document.amount_invalid")
    sources = {source["path"] for source in case.get("confirmed_sources", [])}
    for fact in facts:
        if not fact.get("source_refs") or not set(fact["source_refs"]) <= sources:
            errors.append("document.fact_source_missing")
    for source in case.get("confirmed_sources", []):
        path = (root / source["path"]).resolve()
        if not path.is_relative_to(root.resolve()) or not path.is_file():
            errors.append("document.source_missing")
        elif hashlib.sha256(path.read_bytes()).hexdigest() != source["sha256"]:
            errors.append("document.source_changed")
    proposals = {
        item["fact_id"]: item["proposed_value"]
        for item in case.get("pending_review", [])
    }
    proposals = {**values, **proposals}
    # Check proposal arithmetic without accepting proposals as grading truth.
    try:
        if "shipment.receipt_date" in proposals:
            latest = date.fromisoformat(proposals["shipment.receipt_date"]) + timedelta(
                days=values["shipment.days_after_receipt"]
            )
            if latest.isoformat() != proposals["shipment.latest_date"]:
                errors.append("document.proposed_shipment_inconsistent")
            expiry = latest + timedelta(days=proposals["presentation.period_days"])
            if expiry.isoformat() != proposals["presentation.expiry_date"]:
                errors.append("document.proposed_expiry_inconsistent")
    except (KeyError, ValueError, TypeError, OverflowError):
        errors.append("document.proposed_dates_invalid")
    if require_approved and (
        case.get("review_status") != "approved"
        or case.get("pending_review")
        or not case.get("reviewed_by")
        or not case.get("reviewed_at")
        or any(fact.get("status") != "approved" for fact in facts)
    ):
        errors.append("document.case_pending_review")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--require-approved", action="store_true")
    args = parser.parse_args()
    case = json.loads(CASE.read_text(encoding="utf-8"))
    errors = validate_case(case, ROOT, require_approved=args.require_approved)
    print(
        json.dumps(
            {
                "case_id": case["case_id"],
                "errors": errors,
                "review_status": case["review_status"],
            },
            ensure_ascii=False,
        )
    )
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
