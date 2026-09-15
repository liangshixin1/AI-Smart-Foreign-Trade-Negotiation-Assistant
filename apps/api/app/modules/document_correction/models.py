# [导读] 所属业务: 信用证结构化审改。
# [导读] 业务名词: 信用证是银行按约定单据付款的承诺; MT700 是本项目采用的信用证报文样式; 批注是
# [导读] 学生提出的改证意见。
# [导读] 用途: 定义该业务的数据库实体、关联和约束。
# [导读] 为什么: 唯一约束、外键与状态字段共同表达持久化规则; 修改模型需要新增数据库迁移, 不能只
# [导读] 改类定义。
# [导读] 结构: CorrectionSession、Annotation、Operation、CorrectionResult。
# [导读] 提醒: 原证与标准答案以快照保存; 学生只改批注。成绩由版本化本地规则计算, 模型仅生成额外
# [导读] 讲评。
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import utc_now


class CorrectionSession(Base):
    __tablename__ = "document_correction_sessions"
    attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id"), primary_key=True)
    bindings: Mapped[dict[str, Any]] = mapped_column(JSON)
    case_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    document_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    answer_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    case_hash: Mapped[str] = mapped_column(String(64))
    document_hash: Mapped[str] = mapped_column(String(64))
    answer_hash: Mapped[str] = mapped_column(String(64))
    revision: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(24), default="draft")
    submitted_revision: Mapped[int | None] = mapped_column(Integer)
    feedback: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class Annotation(Base):
    __tablename__ = "document_annotations"
    __table_args__ = (UniqueConstraint("attempt_id", "target_ref"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id"), index=True)
    target_ref: Mapped[str] = mapped_column(String(120))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    revision: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class Operation(Base):
    __tablename__ = "document_operations"
    __table_args__ = (UniqueConstraint("attempt_id", "client_operation_id"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id"), index=True)
    client_operation_id: Mapped[str] = mapped_column(String(120))
    request_hash: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    response: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class CorrectionResult(Base):
    __tablename__ = "document_correction_results"
    attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id"), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    annotation_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
