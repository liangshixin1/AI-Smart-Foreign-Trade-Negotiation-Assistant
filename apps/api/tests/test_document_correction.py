# [导读] 业务名词: 信用证是银行按约定单据付款的承诺; 批注是学生提出的改证意见, 通关由本地版本化
# [导读] 规则判定。
# [导读] 用途: 回归验证信用证批注、版本冲突、确定性评分和只读回放。
# [导读] 为什么: 用可重复输入固定业务边界, 既检查成功结果, 也防止重试、权限或无效输入破坏已有行
# [导读] 为。
# [导读] 结构: 本文件有 6 个测试函数; 按各用例的准备、操作、断言顺序阅读, 公共夹具见
# [导读] tests/conftest.py。
# [导读] 提醒: 测试中的用户、令牌、案例和模型输出是测试数据; 通过这些用例不等于已验证真实外部模
# [导读] 型或线上环境。
from __future__ import annotations

import copy
import uuid

import pytest
from conftest import TEST_PASSWORD
from sqlalchemy import select

from app.modules.curriculum.models import TrainingUnit
from app.modules.document_correction.grading_rules import grade, normalize
from app.modules.document_correction.profile_service import load_assets
from app.modules.progress.models import ProgressRecord
from app.modules.training.models import Attempt


@pytest.fixture
def lc(client, curriculum_enrollment, session_factory, users):
    client.app.state.settings.document_correction_enabled = True
    with session_factory() as db:
        unit = db.scalar(select(TrainingUnit).where(TrainingUnit.unit_key == "chapter-5-section-2"))
        a = Attempt(
            student_id=users["student"].id,
            unit_id=unit.id,
            course_version_id=unit.chapter.course_version_id,
            status="completed",
            difficulty="standard",
            content_bindings={},
        )
        db.add(a)
        db.flush()
        db.add(
            ProgressRecord(
                student_id=users["student"].id,
                course_version_id=a.course_version_id,
                unit_id=unit.id,
                completed_attempt_id=a.id,
                latest_score=90,
                best_score=90,
            )
        )
        db.commit()
    login = client.post(
        "/api/v1/auth/login", json={"identifier": "student@example.test", "password": TEST_PASSWORD}
    )
    headers = {
        "Authorization": "Bearer " + login.json()["access_token"],
        "Idempotency-Key": str(uuid.uuid4()),
    }
    response = client.post(
        "/api/v1/attempts", headers=headers, json={"unit_id": "chapter-6-section-1"}
    )
    assert response.status_code == 201, response.text
    aid = response.json()["id"]
    assert response.json()["workspace_kind"] == "lc_correction"
    assert response.json()["messages"] == []
    return client, headers, aid


def answer_annotations():
    _, _, _, answers = load_assets()
    return [
        {
            "annotation_id": str(uuid.uuid4()),
            "target_ref": i["target_ref"],
            "issue_category": i["category"],
            "proposed_value": i["expected"],
            "evidence_ref": i["source_fact_ref"],
        }
        for i in answers["issues"]
    ]


def test_perfect_and_critical_misses():
    _, case, doc, answers = load_assets()
    annotations = answer_annotations()
    assert grade(doc, answers, annotations, case)["score"] == 100
    for i in answers["issues"]:
        remaining = [a for a in annotations if a["target_ref"] != i["target_ref"]]
        result = grade(doc, answers, remaining, case)
        if i["critical"]:
            assert result["score"] >= 80
            assert not result["passed"]


def test_decimal_and_dirty_formats():
    assert normalize("currency_amount", {"currency": "USD", "amount": "228,000.0"}) == normalize(
        "currency_amount", {"currency": "USD", "amount": "228000.00"}
    )
    for value in ["2.28e5", "NaN", "22,80,00", "228000.001", True]:
        with pytest.raises(ValueError):
            normalize("currency_amount", {"currency": "USD", "amount": value})
    with pytest.raises(ValueError):
        normalize("date", "2027-02-29")


def test_no_free_text_credit_and_false_positives():
    _, case, doc, answers = load_assets()
    annotations = answer_annotations()
    for a in annotations:
        a["proposed_value"] = None
        a["optional_note"] = "Excellent risk analysis and perfectly worded amendment"
    result = grade(doc, answers, annotations, case)
    assert result["score"] == 50
    assert not result["passed"]
    annotations = answer_annotations()
    annotations.append(
        {
            "annotation_id": "wrong",
            "target_ref": "mt700-50",
            "proposed_value": {"name": "Wrong", "address": "Wrong"},
            "issue_category": "other",
            "evidence_ref": "applicant.name",
        }
    )
    result = grade(doc, answers, annotations, case)
    assert result["score"] == 92 and not result["passed"]


def test_save_submit_idempotency_freeze_and_replay(lc):
    client, h, aid = lc
    base = f"/api/v1/attempts/{aid}/document-correction"
    session = client.get(base, headers=h).json()
    private = [
        "expected_value",
        "answer_snapshot",
        "is_error",
        "issue_id",
        "score_weight",
        "critical",
        "error_manifest",
        "matcher",
        "teacher_note",
    ]
    import json

    assert all('"' + key + '"' not in json.dumps(session) for key in private)
    for rev, annotation in enumerate(answer_annotations()):
        value = {k: v for k, v in annotation.items() if k not in {"annotation_id", "target_ref"}}
        value.update(expected_revision=rev, client_operation_id=str(uuid.uuid4()))
        url = base + "/annotations/" + annotation["target_ref"]
        saved = client.put(url, headers=h, json=value)
        assert saved.status_code == 200, saved.text
        assert client.put(url, headers=h, json=value).json() == saved.json()
        conflict = copy.deepcopy(value)
        conflict["optional_note"] = "different"
        assert client.put(url, headers=h, json=conflict).status_code == 409
    stale = {**value, "expected_revision": 0, "client_operation_id": str(uuid.uuid4())}
    assert client.put(url, headers=h, json=stale).status_code == 409
    assert client.get(base).status_code == 401
    assert client.post(base + "/check-completeness", headers=h).json()["errors"] == {}
    submitted = client.post(
        f"/api/v1/attempts/{aid}/submit", headers=h, json={"expected_revision": 8}
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["evaluation"]["overall_score"] == 100
    assert submitted.json()["status"] == "completed"
    assert (
        client.post(
            f"/api/v1/attempts/{aid}/submit", headers=h, json={"expected_revision": 8}
        ).json()
        == submitted.json()
    )
    assert (
        client.put(
            url,
            headers=h,
            json={**value, "expected_revision": 8, "client_operation_id": str(uuid.uuid4())},
        ).status_code
        == 409
    )
    session = client.get(base, headers=h).json()
    assert session["read_only"] and session["result"]["passed"]
    assert len(session["result"]["issue_results"]) == 8
    retry = client.post(
        f"/api/v1/attempts/{aid}/retry", headers={**h, "Idempotency-Key": str(uuid.uuid4())}
    )
    assert retry.status_code == 201, retry.text
    assert retry.json()["retry_of_attempt_id"] == aid


def test_disabled_reads_and_chat_rejected(lc):
    client, h, aid = lc
    assert (
        client.post(
            f"/api/v1/attempts/{aid}/messages",
            headers=h,
            json={"content": "hello", "client_message_id": "message-0001"},
        ).status_code
        == 409
    )
    assert (
        client.post(
            f"/api/v1/attempts/{aid}/messages/stream",
            headers=h,
            json={"content": "hello", "client_message_id": "message-0002"},
        ).status_code
        == 409
    )
    client.app.state.settings.document_correction_enabled = False
    assert client.get(f"/api/v1/attempts/{aid}/document-correction", headers=h).json()["read_only"]
    response = client.post(
        "/api/v1/attempts",
        headers={**h, "Idempotency-Key": str(uuid.uuid4())},
        json={"unit_id": "chapter-6-section-1"},
    )
    assert response.status_code == 409


def test_local_prerequisite_bypass_opens_only_lc(client, curriculum_enrollment):
    del curriculum_enrollment
    client.app.state.settings.document_correction_enabled = True
    client.app.state.settings.document_correction_skip_prerequisite = True
    login = client.post(
        "/api/v1/auth/login", json={"identifier": "student@example.test", "password": TEST_PASSWORD}
    )
    headers = {"Authorization": "Bearer " + login.json()["access_token"]}
    unit = client.get("/api/v1/units/chapter-6-section-1", headers=headers)
    assert unit.status_code == 200
    assert unit.json()["status"] == "available"
    other = client.get("/api/v1/units/chapter-1-section-1", headers=headers)
    assert other.status_code == 200
    assert other.json()["status"] == "locked"
    created = client.post(
        "/api/v1/attempts",
        headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"unit_id": "chapter-6-section-1", "difficulty": "standard"},
    )
    assert created.status_code == 201, created.text
    assert created.json()["workspace_kind"] == "lc_correction"
