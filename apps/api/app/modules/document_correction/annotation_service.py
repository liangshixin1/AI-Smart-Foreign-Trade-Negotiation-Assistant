# [导读] 所属业务: 信用证结构化审改。
# [导读] 业务名词: 信用证是银行按约定单据付款的承诺; MT700 是本项目采用的信用证报文样式; 批注是
# [导读] 学生提出的改证意见。
# [导读] 用途与原因: 按字段管理改证批注与操作日志; 利用期望版本及操作摘要, 分别防止并发覆盖和重
# [导读] 复请求产生不同结果。
# [导读] 结构: AnnotationService。
# [导读] 提醒: 原证与标准答案以快照保存; 学生只改批注。成绩由版本化本地规则计算, 模型仅生成额外
# [导读] 讲评。
from __future__ import annotations

import uuid
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.modules.document_correction.grading_rules import complete, targets
from app.modules.document_correction.models import (
    Annotation,
    CorrectionResult,
    CorrectionSession,
    Operation,
)
from app.modules.document_correction.profile_service import error, require_tables
from app.modules.document_correction.schemas import AnnotationInput, Document, RevisionInput
from app.modules.training.hashing import stable_hash


class AnnotationService:
    def __init__(self, db: Session, enabled: bool = True) -> None:
        self.db = db
        self.enabled = enabled

    def session(self, attempt_id: uuid.UUID) -> CorrectionSession:
        require_tables(self.db)
        item = self.db.get(CorrectionSession, attempt_id)
        if item is None:
            raise error("session_missing", "该训练属于旧版文本审阅。", 404)
        return item

    def annotations(self, attempt_id: uuid.UUID) -> list[dict[str, Any]]:
        return [
            {
                **a.payload,
                "annotation_id": str(a.id),
                "target_ref": a.target_ref,
                "revision": a.revision,
                "created_at": a.created_at.isoformat(),
            }
            for a in self.db.scalars(
                select(Annotation)
                .where(Annotation.attempt_id == attempt_id)
                .order_by(Annotation.created_at)
            )
        ]

    # [导读] 从快照构造响应; 只有教师分支附带答案规则和操作记录, 学生响应不能包含这些字段。
    def present(self, attempt_id: uuid.UUID, teacher: bool = False) -> dict[str, Any]:
        item = self.session(attempt_id)
        try:
            document = Document.model_validate(item.document_snapshot).model_dump()
        except ValidationError as exc:
            raise error(
                "schema_unsupported", "单证格式暂无法载入，请重试或联系教师。", 503
            ) from exc
        result = self.db.get(CorrectionResult, attempt_id)
        payload: dict[str, Any] = {
            "schema_version": "lc.correction.session.v1",
            "attempt_id": str(attempt_id),
            "profile": item.bindings,
            "briefing": {"fact_groups": item.case_snapshot["facts"]},
            "document": document,
            "annotations": self.annotations(attempt_id),
            "revision": item.revision,
            "submission_status": item.status,
            "read_only": teacher or not self.enabled or item.status != "draft",
            "result": result.payload if result else None,
            "feedback": item.feedback,
            "hashes": {
                "document": item.document_hash,
                "case": item.case_hash,
                "annotations": result.annotation_hash if result else None,
            },
        }
        if teacher:
            payload["answer_rules"] = item.answer_snapshot
            payload["hashes"]["answers"] = item.answer_hash
            payload["operations"] = [
                {
                    "operation_id": op.client_operation_id,
                    "payload": op.payload,
                    "created_at": op.created_at.isoformat(),
                }
                for op in self.db.scalars(
                    select(Operation)
                    .where(Operation.attempt_id == attempt_id)
                    .order_by(Operation.created_at)
                )
            ]
        return payload

    # [导读] 只验证学生已经标记的项目是否填全, 不能据此提示未找到的标准不符点。
    def completeness(self, attempt_id: uuid.UUID) -> dict[str, Any]:
        item = self.session(attempt_id)
        by_ref = targets(item.document_snapshot)
        facts = {f["fact_id"] for f in item.case_snapshot["facts"]}
        errors = {
            a["target_ref"]: complete(a, by_ref[a["target_ref"]], facts)
            for a in self.annotations(attempt_id)
        }
        return {
            "errors": {ref: value for ref, value in errors.items() if value},
            "revision": item.revision,
        }

    # [导读] 相同操作编号先比较摘要; 新操作用 expected_revision 条件更新抢占版本, 再将批注与操作
    # [导读] 回执一起提交。
    def mutate(
        self,
        attempt_id: uuid.UUID,
        ref: str,
        data: AnnotationInput | RevisionInput,
        delete: bool = False,
    ) -> dict[str, Any]:
        item = self.session(attempt_id)
        payload = {"target_ref": ref, "delete": delete, **data.model_dump()}
        digest = stable_hash(payload)
        existing = self.db.scalar(
            select(Operation).where(
                Operation.attempt_id == attempt_id,
                Operation.client_operation_id == data.client_operation_id,
            )
        )
        if existing:
            if existing.request_hash != digest:
                raise error("idempotency_conflict", "同一操作编号对应了不同内容，请重新保存。")
            return existing.response
        if not self.enabled or item.status != "draft":
            raise error("read_only", "该审改单已冻结或功能已关闭，只能回放。")
        if ref not in targets(item.document_snapshot):
            raise error("target_invalid", "未找到这个字段或条款。", 422)
        changed = self.db.execute(
            update(CorrectionSession)
            .where(
                CorrectionSession.attempt_id == attempt_id,
                CorrectionSession.revision == data.expected_revision,
                CorrectionSession.status == "draft",
            )
            .values(revision=data.expected_revision + 1)
        )
        if getattr(changed, "rowcount", 0) != 1:
            self.db.rollback()
            raise error(
                "revision_conflict",
                "版本冲突：请读取最新审改单，选择保留当前草稿或采用服务器版本。",
            )
        annotation = self.db.scalar(
            select(Annotation).where(
                Annotation.attempt_id == attempt_id, Annotation.target_ref == ref
            )
        )
        if delete:
            if annotation:
                self.db.delete(annotation)
        else:
            value = data.model_dump(exclude={"expected_revision", "client_operation_id"})
            value["client_operation_id"] = data.client_operation_id
            if annotation is None:
                annotation = Annotation(
                    attempt_id=attempt_id,
                    target_ref=ref,
                    payload=value,
                    revision=data.expected_revision + 1,
                )
                self.db.add(annotation)
            else:
                annotation.payload = value
                annotation.revision = data.expected_revision + 1
        self.db.flush()
        response = {
            "revision": data.expected_revision + 1,
            "annotations": self.annotations(attempt_id),
        }
        self.db.add(
            Operation(
                attempt_id=attempt_id,
                client_operation_id=data.client_operation_id,
                request_hash=digest,
                payload=payload,
                response=response,
            )
        )
        self.db.commit()
        return response
