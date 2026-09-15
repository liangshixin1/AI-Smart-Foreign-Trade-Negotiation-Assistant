# [导读] 业务名词: 图谱连接阶段、现象、知识和策略; Scaffold 是本次训练固定支持库, PI 十阶段是项
# [导读] 目采用的贸易流程分类。
# [导读] 用途: 回归验证PI 十阶段迁移、稳定编号与旧版本证据保留。
# [导读] 为什么: 用可重复输入固定业务边界, 既检查成功结果, 也防止重试、权限或无效输入破坏已有行
# [导读] 为。
# [导读] 结构: 本文件有 4 个测试函数; 按各用例的准备、操作、断言顺序阅读, 公共夹具见
# [导读] tests/conftest.py。
# [导读] 提醒: 测试中的用户、令牌、案例和模型输出是测试数据; 通过这些用例不等于已验证真实外部模
# [导读] 型或线上环境。
from __future__ import annotations

from collections import Counter
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker
from test_auth import auth_header, login
from test_knowledge_graph_v3 import TEMPLATE, _publish_v3

from app.modules.auth.models import User
from app.modules.curriculum.models import Chapter, TrainingUnit
from app.modules.knowledge_graph.consumption_service import KnowledgeGraphConsumptionService
from app.modules.knowledge_graph.models import (
    KnowledgeContentAsset,
    KnowledgeGraphAuditEvent,
    KnowledgeGraphPhenomenonSnapshot,
    KnowledgeGraphPublication,
    KnowledgeGraphStageSnapshot,
    KnowledgeLearningActivity,
    KnowledgeLearningContent,
    KnowledgeNodeDisplayOverride,
)
from app.modules.knowledge_graph.pi_migration import migrate_pi_stages
from app.modules.knowledge_graph.pi_stages import (
    CLAIM_PHENOMENA,
    PI_STAGES,
    normalize_pi_source,
    pi_scenarios,
    validate_pi_baseline,
)
from app.modules.knowledge_graph.repository import KnowledgeGraphRepository
from app.modules.knowledge_graph.review_service import KnowledgeReviewService
from app.modules.knowledge_graph.v3_compiler import load_translation_payload
from app.modules.knowledge_graph.xlsx_parser import parse_expert_workbook_v3
from app.modules.training.models import Attempt


def test_split_preserves_source_facts_and_recalculates_membership() -> None:
    source = parse_expert_workbook_v3(TEMPLATE.read_bytes())
    original = deepcopy(source)
    translations = load_translation_payload()
    before_translations = deepcopy(translations)
    data, overlay = normalize_pi_source(source, translations)
    assert source == original
    assert translations == before_translations
    assert validate_pi_baseline(source) == []
    assert [row["Stage name"] for row in data.sheets["01_L1_Stages"]] == [s[1] for s in PI_STAGES]
    assert [row["name_zh"] for row in overlay["stages"]] == [s[0] for s in PI_STAGES]
    phenomena = data.sheets["02_L2_Phenomena"]
    assert {r["Phenomenon ID"] for r in phenomena if r["Stage ID"] == "S10"} == CLAIM_PHENOMENA
    assert Counter(r["Stage ID"] for r in phenomena)["S9"] == 4
    for sheet, field in (("02_L2_Phenomena", "Phenomenon ID"), ("03_L3_Knowledge", "Knowledge ID")):
        assert {r[field] for r in data.sheets[sheet]} == {r[field] for r in original.sheets[sheet]}
    assert {(r["Phenomenon ID"], r["Knowledge ID"]) for r in data.sheets["04_Edges"]} == {
        (r["Phenomenon ID"], r["Knowledge ID"]) for r in original.sheets["04_Edges"]
    }
    p_stage = {r["Phenomenon ID"]: r["Stage ID"] for r in phenomena}
    for row in data.sheets["03_L3_Knowledge"]:
        stages = {
            p_stage[e["Phenomenon ID"]]
            for e in data.sheets["04_Edges"]
            if e["Knowledge ID"] == row["Knowledge ID"]
        }
        assert row["Stages served"] == len(stages)
    assert all(s["stage_id"] == "S10" for s in pi_scenarios()[-3:])
    source.sheets["01_L1_Stages"][0]["Stage ID"] = "S100"
    assert validate_pi_baseline(source)


def test_local_migration_history_content_idempotency_and_rollback(
    client: TestClient,
    session_factory: sessionmaker[Session],
    users: dict[str, User],
    curriculum_enrollment: None,
) -> None:
    del curriculum_enrollment
    _publish_v3(client)
    store = client.app.state.graph_store
    with session_factory() as db:
        repo = KnowledgeGraphRepository(db)
        old = repo.active_publication()
        assert old is not None
        old_version, old_payload = old.graph_version, deepcopy(old.graph_payload)
        unit, course_version_id = db.execute(
            select(TrainingUnit, Chapter.course_version_id)
            .join(Chapter)
            .where(TrainingUnit.unit_key == "chapter-8-section-1")
        ).one()
        attempt = Attempt(
            student_id=users["student"].id,
            unit_id=unit.id,
            course_version_id=course_version_id,
            status="in_progress",
            difficulty="standard",
            content_bindings={"knowledge_graph_version": old_version},
        )
        db.add(attempt)
        for key in ("knowledge:K110", "stage:S9"):
            db.add(
                KnowledgeLearningContent(
                    graph_version=old_version,
                    node_key=key,
                    node_type="KnowledgePoint",
                    title="原有教师精讲",
                    summary="保留内容",
                    markdown_body="原文",
                    status="published",
                    updated_by_user_id=users["teacher"].id,
                )
            )
        db.add(
            KnowledgeContentAsset(
                graph_version=old_version,
                node_key="knowledge:K110",
                asset_kind="image",
                filename="original.png",
                content_type="image/png",
                size_bytes=3,
                content=b"png",
                uploaded_by_user_id=users["teacher"].id,
            )
        )
        db.add(
            KnowledgeNodeDisplayOverride(
                graph_version=old_version,
                node_key="stage:S1",
                short_name_zh="旧阶段名",
                updated_by_user_id=users["teacher"].id,
            )
        )
        db.add(
            KnowledgeLearningActivity(
                graph_version=old_version,
                node_key="knowledge:K110",
                node_type="KnowledgePoint",
                event_type="completed",
                source="graph",
                client_event_id="before-pi",
                student_id=users["student"].id,
            )
        )
        db.commit()
        new = migrate_pi_stages(db, store, users["technician"].id)
        assert new.graph_version != old_version
        assert old.graph_payload == old_payload
        assert attempt.content_bindings == {"knowledge_graph_version": old_version}
        assert db.scalar(select(func.count()).select_from(KnowledgeLearningActivity)) == 1
        assert (
            db.scalar(
                select(func.count())
                .select_from(KnowledgeGraphStageSnapshot)
                .where(KnowledgeGraphStageSnapshot.change_set_id == new.change_set_id)
            )
            == 10
        )
        assert (
            db.scalar(
                select(func.count())
                .select_from(KnowledgeGraphPhenomenonSnapshot)
                .where(
                    KnowledgeGraphPhenomenonSnapshot.change_set_id == new.change_set_id,
                    KnowledgeGraphPhenomenonSnapshot.stage_id == "S10",
                )
            )
            == 5
        )
        copied = db.scalars(
            select(KnowledgeLearningContent).where(
                KnowledgeLearningContent.graph_version == new.graph_version
            )
        ).all()
        assert [(r.node_key, r.markdown_body) for r in copied] == [("knowledge:K110", "原文")]
        assert (
            db.scalar(
                select(KnowledgeContentAsset).where(
                    KnowledgeContentAsset.graph_version == new.graph_version
                )
            ).content
            == b"png"
        )
        assert (
            db.scalar(
                select(func.count())
                .select_from(KnowledgeNodeDisplayOverride)
                .where(KnowledgeNodeDisplayOverride.graph_version == new.graph_version)
            )
            == 0
        )
        evidence = db.scalar(
            select(KnowledgeGraphAuditEvent).where(
                KnowledgeGraphAuditEvent.action == "pi.stages_migrated"
            )
        )
        assert evidence and len(evidence.details["skipped"]) == 2
        graph_service = KnowledgeGraphConsumptionService(db, store)
        assert len([n for n in graph_service.student_graph().nodes if n.type == "Stage"]) == 10
        assert (
            len(
                [
                    n
                    for n in graph_service.student_attempt_graph(
                        users["student"].id, attempt.id
                    ).nodes
                    if n.type == "Stage"
                ]
            )
            == 9
        )
        again = migrate_pi_stages(db, store, users["technician"].id)
        assert again.id == new.id
        assert db.scalar(select(func.count()).select_from(KnowledgeGraphPublication)) == 2
        KnowledgeReviewService(repo, store).rollback(new, users["technician"].id)
        assert repo.active_publication().graph_version == old_version
        assert len([n for n in graph_service.student_graph().nodes if n.type == "Stage"]) == 9


def test_default_import_builds_ten_stage_graph(client: TestClient) -> None:
    teacher = auth_header(login(client, "teacher")["access_token"])
    response = client.post(
        "/api/v1/knowledge-graph/imports",
        headers={
            **teacher,
            "X-File-Name": TEMPLATE.name,
        },
        content=TEMPLATE.read_bytes(),
    )
    assert response.status_code == 201, response.text
    assert response.json()["template_version"] == "3.1"
    change = client.get(
        f"/api/v1/knowledge-graph/imports/{response.json()['id']}/change-set", headers=teacher
    ).json()
    assert change["summary"]["stage_count"] == 10
    assert change["summary"]["node_count"] == 346
    assert change["summary"]["relationship_count"] == 568
    assert change["summary"]["teacher_node_count"] == 214


def test_content_copy_failure_restores_previous_graph(
    client: TestClient,
    session_factory: sessionmaker[Session],
    users: dict[str, User],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _publish_v3(client)
    store = client.app.state.graph_store
    with session_factory() as db:
        repo = KnowledgeGraphRepository(db)
        old = repo.active_publication()
        assert old is not None
        old_version = old.graph_version

        def fail_copy(*args: object) -> None:
            raise RuntimeError("simulated content-copy failure")

        monkeypatch.setattr("app.modules.knowledge_graph.pi_migration.carry_pi_content", fail_copy)
        with pytest.raises(RuntimeError, match="simulated content-copy failure"):
            migrate_pi_stages(db, store, users["technician"].id)
        assert repo.active_publication().graph_version == old_version
        assert len(store.read(old_version).nodes) == 345
        assert db.scalar(select(func.count()).select_from(KnowledgeGraphPublication)) == 1
        assert (
            db.scalar(
                select(func.count())
                .select_from(KnowledgeGraphAuditEvent)
                .where(KnowledgeGraphAuditEvent.action == "pi.stages_migrated")
            )
            == 0
        )
