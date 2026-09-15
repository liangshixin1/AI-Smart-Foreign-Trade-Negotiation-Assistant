# [导读] 所属业务: 信用证结构化审改。
# [导读] 业务名词: 信用证是银行按约定单据付款的承诺; MT700 是本项目采用的信用证报文样式; 批注是
# [导读] 学生提出的改证意见。
# [导读] 用途与原因: 以纯本地规则规范化拟改值并计算定位、修改、依据得分和误报扣分; 相同快照输入
# [导读] 可重复得到相同结果。
# [导读] 结构: targets、number、normalize、complete、same、grade。
# [导读] 提醒: 原证与标准答案以快照保存; 学生只改批注。成绩由版本化本地规则计算, 模型仅生成额外
# [导读] 讲评。
from __future__ import annotations

import re
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from app.modules.document_correction.schemas import Document


def targets(document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    result = {}
    for section in Document.model_validate(document).sections:
        for field in section.fields:
            if field.items:
                for item in field.items:
                    result[item.item_id] = item.model_dump()
            else:
                result[field.field_id] = field.model_dump()
    return result


# [导读] 只接受约定的普通十进制格式, 先验证再转换 Decimal; 防止科学计数法等未支持形式混入答案。
def number(value: Any, integer: bool = False) -> Decimal:
    raw = str(value).strip()
    if not re.fullmatch(r"(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?", raw):
        raise ValueError("请输入普通十进制数，最多两位小数")
    result = Decimal(raw.replace(",", ""))
    if integer and result != result.to_integral_value():
        raise ValueError("请输入整数")
    return result


# [导读] 按字段业务类型规范化日期、金额、主体等输入; 金额用 Decimal, 避免浮点误差或格式差异影响
# [导读] 评分。
def normalize(kind: str, value: Any) -> Any:
    if kind == "currency_amount":
        if set(value) != {"currency", "amount"} or value["currency"] not in {
            "USD",
            "EUR",
            "CNY",
            "SGD",
        }:
            raise ValueError("请选择币种并填写金额")
        return (value["currency"], number(value["amount"]))
    if kind == "date":
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("日期格式应为YYYY-MM-DD")
        return date.fromisoformat(value)
    if kind == "integer_days":
        return number(value, True)
    if kind == "party":
        if set(value) != {"name", "address"} or not all(
            isinstance(v, str) and v.strip() for v in value.values()
        ):
            raise ValueError("请填写公司名称与地址")
        return tuple(" ".join(value[k].split()).casefold() for k in ["name", "address"])
    if kind == "goods_description":
        keys = [
            "product",
            "quantity",
            "unit",
            "unit_price",
            "incoterm",
            "place",
            "incoterms_version",
        ]
        if set(value) != set(keys):
            raise ValueError("请完整填写货物分项")
        return tuple(
            number(value[k], k == "quantity")
            if k in {"quantity", "unit_price"}
            else str(value[k]).strip().casefold()
            for k in keys
        )
    if kind == "field_relation":
        if (
            set(value) != {"expiry_date", "period_days", "expiry_place"}
            or not str(value["expiry_place"]).strip()
        ):
            raise ValueError("请填写有效期、地点和交单天数")
        days = number(value["period_days"], True)
        if days < 1 or days > 365:
            raise ValueError("交单期应为1至365天")
        return (
            normalize("date", value["expiry_date"]),
            days,
            value["expiry_place"].strip().casefold(),
        )
    if kind == "enum":
        if value not in {"ALLOWED", "NOT ALLOWED", "CONDITIONAL", "IRREVOCABLE", "REVOCABLE"}:
            raise ValueError("请选择有效选项")
        return value
    if kind == "clause_list":
        if set(value) != {"action", "template", "parameter"} or value["action"] not in {
            "retain",
            "delete",
            "replace",
        }:
            raise ValueError("请选择保留、删除或替换")
        if value["action"] == "replace":
            if (
                value["template"]
                not in {"commercial_invoice", "packing_list", "bill_of_lading", "insurance"}
                or not str(value["parameter"]).strip()
            ):
                raise ValueError("替换需要选择模板并填写参数")
            return (value["action"], value["template"], value["parameter"].strip())
        return value["action"]
    if not isinstance(value, str) or not value.strip() or len(value) > 3000:
        raise ValueError("请填写拟改内容")
    return " ".join(value.split()).casefold()


# [导读] 检查已标记项目的类型、依据和拟改值是否完整; 这是格式检查, 不泄露标准答案或判断得分。
def complete(annotation: dict[str, Any], target: dict[str, Any], fact_ids: set[str]) -> list[str]:
    errors = []
    if annotation.get("issue_category") not in {
        "contract_mismatch",
        "unperformable",
        "ambiguous",
        "other",
    }:
        errors.append("请选择问题类型")
    if annotation.get("evidence_ref") not in fact_ids:
        errors.append("请选择合同或场景依据")
    try:
        normalize(target["value_type"], annotation.get("proposed_value"))
    except (ValueError, TypeError, KeyError, AttributeError):
        errors.append("拟改内容不完整或格式不合法")
    return errors


# [导读] 将两边按相同字段规则规范化再比较, 减少大小写和无意义空格导致的误判。
def same(kind: str, actual: Any, expected: Any) -> bool:
    try:
        return bool(normalize(kind, actual) == normalize(kind, expected))
    except (ValueError, TypeError, KeyError, AttributeError):
        return False


# [导读] 按固定答案逐项算定位、拟改与依据分, 再扣误报分; 通过还需无重大漏点、无损害正确重大字段
# [导读] 且填写完整。
def grade(
    document: dict[str, Any],
    answers: dict[str, Any],
    annotations: list[dict[str, Any]],
    case: dict[str, Any],
) -> dict[str, Any]:
    by_ref = targets(document)
    marked = {a["target_ref"]: a for a in annotations}
    facts = {f["fact_id"]: f["value"] for f in case["facts"]}
    issues = []
    critical_misses = []
    total = Decimal(0)
    for issue in answers["issues"]:
        ref = issue["target_ref"]
        item = marked.get(ref)
        located = item is not None
        corrected = item is not None and same(
            by_ref[ref]["value_type"], item["proposed_value"], issue["expected"]
        )
        if corrected and item is not None and by_ref[ref]["value_type"] == "field_relation":
            expiry, days, _ = normalize("field_relation", item["proposed_value"])
            latest = date.fromisoformat(facts["shipment.receipt_date"]) + timedelta(
                days=facts["shipment.days_after_receipt"]
            )
            corrected = expiry >= latest + timedelta(days=int(days))
        evidence = (
            item is not None
            and item["evidence_ref"] == issue["source_fact_ref"]
            and item["issue_category"] == issue["category"]
        )
        parts = {
            "location": Decimal("0.3") * issue["weight"] if located else Decimal(0),
            "correction": Decimal("0.5") * issue["weight"] if corrected else Decimal(0),
            "evidence": Decimal("0.2") * issue["weight"] if evidence else Decimal(0),
        }
        score = sum(parts.values())
        total += score
        if issue["critical"] and not located:
            critical_misses.append(ref)
        issues.append(
            {
                "target_ref": ref,
                "located": located,
                "corrected": bool(corrected),
                "evidence_correct": bool(evidence),
                "standard_value": issue["expected"],
                "original_value": by_ref[ref]["value"],
                "student_value": item["proposed_value"] if item else None,
                "source_fact_ref": issue["source_fact_ref"],
                "critical": issue["critical"],
                "weight": issue["weight"],
                "score": float(score),
                "parts": {k: float(v) for k, v in parts.items()},
                "source_type": "document_annotation" if item else "document_field",
                "source_id": item["annotation_id"] if item else ref,
            }
        )
    issue_refs = {i["target_ref"] for i in answers["issues"]}
    false_positives = []
    damaged = []
    for ref, item in marked.items():
        if ref in issue_refs:
            continue
        damage = ref in answers["protected_correct_refs"] and not same(
            by_ref[ref]["value_type"], item["proposed_value"], by_ref[ref]["value"]
        )
        if damage:
            damaged.append(ref)
        false_positives.append({"target_ref": ref, "penalty": 8 if damage else 3})
    penalty = min(15, sum(i["penalty"] for i in false_positives))
    score = max(Decimal(0), total - penalty)
    incomplete = {ref: complete(item, by_ref[ref], set(facts)) for ref, item in marked.items()}
    incomplete = {ref: errs for ref, errs in incomplete.items() if errs}
    passed = score >= 80 and not critical_misses and not damaged and not incomplete
    return {
        "score": float(score),
        "passed": bool(passed),
        "gross_score": float(total),
        "penalty": penalty,
        "critical_misses": critical_misses,
        "damaged_correct_fields": damaged,
        "false_positives": false_positives,
        "issue_results": issues,
        "incomplete": incomplete,
        "rules_version": answers["rules_version"],
        "grading_source": "deterministic",
        "summary": "通过审证训练。"
        if passed
        else (
            "总分达到80分，但仍遗漏重大不符点，本次未通过。"
            if score >= 80 and critical_misses
            else "本次未通过，请对照复盘后重练。"
        ),
    }
