# [导读] 业务名词: 信用证是银行按约定单据付款的承诺; 批注是学生提出的改证意见, 通关由本地版本化
# [导读] 规则判定。
# [导读] 用途: 回归验证信用证案例事实、期限和标准答案的一致性。
# [导读] 为什么: 用可重复输入固定业务边界, 既检查成功结果, 也防止重试、权限或无效输入破坏已有行
# [导读] 为。
# [导读] 结构: 本文件有 5 个测试函数; 按各用例的准备、操作、断言顺序阅读, 公共夹具见
# [导读] tests/conftest.py。
# [导读] 提醒: 测试中的用户、令牌、案例和模型输出是测试数据; 通过这些用例不等于已验证真实外部模
# [导读] 型或线上环境。
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location(
    "validate_lc_case", ROOT / "scripts/validate_lc_case.py"
)
assert SPEC is not None and SPEC.loader is not None
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


def load_case() -> dict:
    return json.loads(AUDIT.CASE.read_text())


def test_source_audit_does_not_approve_proposals():
    case = load_case()
    assert AUDIT.validate_case(case, ROOT) == []
    assert AUDIT.validate_case(case, ROOT, require_approved=True) == []
    assert case == load_case()


def test_cannot_approve_by_changing_only_top_level_status():
    case = load_case()
    case.update(review_status="approved", reviewed_by="fixture", reviewed_at="2026-09-08")
    case["facts"][0]["status"] = "pending_review"
    assert "document.case_pending_review" in AUDIT.validate_case(case, ROOT, require_approved=True)


@pytest.mark.parametrize("days", [39, 41, -40])
def test_proposed_date_off_by_one(days):
    case = load_case()
    next(f for f in case["facts"] if f["fact_id"] == "shipment.days_after_receipt")["value"] = days
    assert "document.proposed_shipment_inconsistent" in AUDIT.validate_case(case, ROOT)


def test_source_drift_detected():
    case = load_case()
    case["confirmed_sources"][0]["sha256"] = "0" * 64
    assert "document.source_changed" in AUDIT.validate_case(case, ROOT)


def test_amount_mismatch_detected():
    case = load_case()
    next(f for f in case["facts"] if f["fact_id"] == "amount.total")["value"] = "228001.00"
    assert "document.amount_inconsistent" in AUDIT.validate_case(case, ROOT)
