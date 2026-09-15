# [导读] 所属业务: 信用证结构化审改。
# [导读] 业务名词: 信用证是银行按约定单据付款的承诺; MT700 是本项目采用的信用证报文样式; 批注是
# [导读] 学生提出的改证意见。
# [导读] 用途与原因: 按期望版本冻结审改单, 写入提交、评分、证据与进度; 这些相关记录在同一提交边
# [导读] 界保存, 避免成绩与通关不同步。
# [导读] 结构: submit。
# [导读] 提醒: 原证与标准答案以快照保存; 学生只改批注。成绩由版本化本地规则计算, 模型仅生成额外
# [导读] 讲评。
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.modules.assessment.models import CompetencyEvidence, Evaluation, EvaluationDimension
from app.modules.auth.models import User
from app.modules.document_correction.annotation_service import AnnotationService
from app.modules.document_correction.grading_rules import grade
from app.modules.document_correction.models import CorrectionResult, CorrectionSession
from app.modules.document_correction.profile_service import error
from app.modules.progress.models import ProgressRecord
from app.modules.training.access import owned_attempt
from app.modules.training.hashing import stable_hash
from app.modules.training.models import Submission
from app.modules.training.presenter import present_attempt
from app.modules.training.repository import TrainingRepository
from app.modules.training.schemas import AttemptResponse
from app.modules.training.state import transition


# [导读] 核对归属和版本后冻结批注, 用本地规则算分, 并在同一事务保存成绩、证据和通过时的进度。
def submit(
    db: Session, student: User, attempt_id: uuid.UUID, key: str, revision: int, enabled: bool
) -> AttemptResponse:
    repository = TrainingRepository(db)
    attempt = owned_attempt(repository, student, attempt_id)
    service = AnnotationService(db, enabled)
    session = service.session(attempt_id)
    existing = db.get(CorrectionResult, attempt_id)
    if existing:
        return present_attempt(
            attempt,
            repository.unit(attempt.unit_id),
            repository.evaluation(attempt_id),
            repository=repository,
        )
    if not enabled:
        raise error("read_only", "功能已关闭，当前训练只能回放。")
    if service.completeness(attempt_id)["errors"]:
        raise error("incomplete", "请补全已标记项目的问题类型、依据和拟改内容。", 422)
    changed = db.execute(
        update(CorrectionSession)
        .where(
            CorrectionSession.attempt_id == attempt_id,
            CorrectionSession.revision == revision,
            CorrectionSession.status == "draft",
        )
        .values(status="submitted", submitted_revision=revision)
    )
    if getattr(changed, "rowcount", 0) != 1:
        db.rollback()
        raise error("revision_conflict", "版本冲突或已经提交，请读取最新审改单。")
    annotations = service.annotations(attempt_id)
    digest = stable_hash(annotations)
    result = grade(
        session.document_snapshot, session.answer_snapshot, annotations, session.case_snapshot
    )
    result.update(
        document_hash=session.document_hash,
        annotation_snapshot_hash=digest,
        case_hash=session.case_hash,
        answer_hash=session.answer_hash,
    )
    submission = Submission(
        attempt_id=attempt_id,
        idempotency_key=key,
        conversation_hash=digest,
        frozen_payload={
            "source_type": "document_annotation",
            "annotations": annotations,
            "document": session.document_snapshot,
            "case": session.case_snapshot,
            "answers": session.answer_snapshot,
            "content_bindings": session.bindings,
            "hashes": {
                "document": session.document_hash,
                "annotations": digest,
                "case": session.case_hash,
                "answers": session.answer_hash,
            },
        },
    )
    db.add(submission)
    db.flush()
    db.add(CorrectionResult(attempt_id=attempt_id, payload=result, annotation_hash=digest))
    evaluation = Evaluation(
        attempt_id=attempt_id,
        submission_id=submission.id,
        run_no=1,
        evaluation_status="completed",
        overall_score=result["score"],
        level="passed" if result["passed"] else "not_passed",
        summary=result["summary"],
        strengths=["已保存可追溯的字段审证记录。"],
        improvements=["对照原值、拟改值和合同依据复盘。"],
        next_actions=["未通过时可创建新的重练记录。"],
        knowledge_tags=["信用证审核", "信用证修改"],
        learning_diagnostic={},
        provider="local",
        model_name="deterministic-lc",
        prompt_template_id="lc-answer-rules",
        prompt_version=session.bindings["answer_rules_version"],
    )
    for item in result["issue_results"]:
        dimension = EvaluationDimension(
            dimension_key=item["target_ref"],
            label=item["target_ref"],
            score=item["score"] / item["weight"] * 100,
            weight=item["weight"] / 100,
            comment=(
                f"定位{item['parts']['location']} + 修改{item['parts']['correction']}"
                f" + 依据{item['parts']['evidence']}"
            ),
        )
        dimension.evidence = [
            CompetencyEvidence(
                message_id=None,
                source_type=item["source_type"],
                source_id=item["source_id"],
                quote=str(item["student_value"]),
                reason="版本化确定性规则评分",
            )
        ]
        evaluation.dimensions.append(dimension)
    if result["penalty"]:
        evaluation.dimensions.append(
            EvaluationDimension(
                dimension_key="false_positives",
                label="误报扣分",
                score=-result["penalty"],
                weight=1,
                comment="普通误报3分，损害正确重大字段额外5分，合计封顶15分",
            )
        )
    db.add(evaluation)
    now = datetime.now(UTC)
    if result["passed"]:
        progress = repository.progress_for_unit(
            student.id, attempt.course_version_id, attempt.unit_id
        )
        if progress is None:
            db.add(
                ProgressRecord(
                    student_id=student.id,
                    course_version_id=attempt.course_version_id,
                    unit_id=attempt.unit_id,
                    completed_attempt_id=attempt_id,
                    latest_score=result["score"],
                    best_score=result["score"],
                    completed_at=now,
                )
            )
        else:
            progress.completed_attempt_id = attempt_id
            progress.latest_score = result["score"]
            progress.best_score = max(progress.best_score, result["score"])
            progress.completed_at = now
    attempt.submitted_at = now
    db.add(transition(attempt, "submitted", "document_frozen"))
    db.add(transition(attempt, "evaluating", "deterministic_grading"))
    db.add(transition(attempt, "completed", "deterministic_result_stored"))
    attempt.completed_at = now
    session.feedback = {
        "status": "not_generated",
        "summary": result["summary"],
        "message": "个性化讲评暂未生成；确定性成绩已生效。",
    }
    db.commit()
    db.expire_all()
    return present_attempt(
        attempt, repository.unit(attempt.unit_id), evaluation, repository=repository
    )
