# [导读] 所属业务: 可追溯的课程完成进度。
# [导读] 业务名词: ProgressRecord 是某学生在某课程版本、某小节的通关记录, 关联完成它的训练。
# [导读] 用途: 定义该业务的数据库实体、关联和约束。
# [导读] 为什么: 唯一约束、外键与状态字段共同表达持久化规则; 修改模型需要新增数据库迁移, 不能只
# [导读] 改类定义。
# [导读] 结构: ProgressRecord。
# [导读] 提醒: 看到学习内容、完成对话和课程通关是不同事件; 不要把浏览次数直接算成课程完成。
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import utc_now


class ProgressRecord(Base):
    __tablename__ = "progress_records"
    __table_args__ = (UniqueConstraint("student_id", "course_version_id", "unit_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    course_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("course_versions.id"))
    unit_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("training_units.id"), index=True)
    completed_attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attempts.id"))
    latest_score: Mapped[float] = mapped_column(Float)
    best_score: Mapped[float] = mapped_column(Float)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
