"""文本与业务数据清洗工具函数集合。"""

from __future__ import annotations

import re
from typing import Dict, List, Optional


def normalize_text(value: object) -> str:
    """将任意输入转换为去除首尾空格的字符串。"""
    if isinstance(value, str):
        return value.strip()
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        if isinstance(value, float) and value.is_integer():
            value = int(value)
        return str(value).strip()
    return str(value).strip() if value is not None else ""


def normalize_text_list(value: object) -> List[str]:
    """将列表/换行字符串转换为去重后的字符串列表。"""
    if isinstance(value, list):
        result: List[str] = []
        for item in value:
            text = normalize_text(item)
            if text:
                result.append(text)
        return result
    if isinstance(value, str):
        items = [segment.strip() for segment in value.splitlines()]
        return [item for item in items if item]
    return []


def normalize_company(data: object) -> Dict[str, str]:
    """清洗公司相关字段，统一键名。"""
    if not isinstance(data, dict):
        return {}
    return {
        "name": normalize_text(
            data.get("name")
            or data.get("company")
            or data.get("companyName")
            or data.get("display")
        ),
        "profile": normalize_text(
            data.get("profile")
            or data.get("description")
            or data.get("summary")
        ),
    }


def _normalize_price_expectation(data: object) -> Dict[str, str]:
    if not isinstance(data, dict):
        return {}
    return {
        "student_target": normalize_text(
            data.get("student_target")
            or data.get("studentTarget")
            or data.get("target")
            or data.get("student")
        ),
        "ai_bottom_line": normalize_text(
            data.get("ai_bottom_line")
            or data.get("aiBottomLine")
            or data.get("bottomLine")
            or data.get("ai")
        ),
    }


def normalize_product(data: object) -> Dict[str, object]:
    """规范化产品信息字段，便于后续生成业务文档。"""
    if not isinstance(data, dict):
        return {}
    result: Dict[str, object] = {
        "name": normalize_text(data.get("name")),
        "specifications": normalize_text(
            data.get("specifications")
            or data.get("specs")
            or data.get("features")
        ),
        "quantity_requirement": normalize_text(
            data.get("quantity_requirement")
            or data.get("quantityRequirement")
            or data.get("quantity")
        ),
    }
    price_data = data.get("price_expectation") or data.get("priceExpectation")
    price = _normalize_price_expectation(price_data)
    if price:
        result["price_expectation"] = price
    if data.get("highlights"):
        result["highlights"] = normalize_text_list(data.get("highlights"))
    return result


def extract_numeric_value(text: object) -> Optional[float]:
    """从字符串中提取第一个数字，便于计算数量或价格。"""
    if not isinstance(text, str):
        text = normalize_text(text)
    normalized = (text or "").replace(",", "")
    match = re.search(r"(-?\d+(?:\.\d+)?)", normalized)
    if not match:
        return None
    try:
        return float(match.group(1))
    except (TypeError, ValueError):
        return None


def format_currency(value: Optional[float]) -> str:
    """格式化金额显示，缺失时返回 TBD。"""
    if value is None:
        return "TBD"
    return f"USD {value:,.2f}"


def resolve_company_name(data: object, fallback: str) -> str:
    """解析公司名称，为报价单等文档生成准备显示内容。"""
    if isinstance(data, dict):
        name = normalize_text(
            data.get("name")
            or data.get("company")
            or data.get("companyName")
            or data.get("display")
        )
        if name:
            return name
    if isinstance(data, str):
        normalized = normalize_text(data)
        if normalized:
            return normalized
    return fallback
