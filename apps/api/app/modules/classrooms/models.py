# [导读] 所属业务: 班级与学生加入关系。
# [导读] 业务名词: Classroom 是教师负责的班级; Enrollment 是学生与班级的关联记录。
# [导读] 用途: 定义该业务的数据库实体、关联和约束。
# [导读] 为什么: 唯一约束、外键与状态字段共同表达持久化规则; 修改模型需要新增数据库迁移, 不能只
# [导读] 改类定义。
# [导读] 结构: Classroom、Enrollment。
# [导读] 提醒: 学生账号与班级成员关系分开保存, 移出班级不等于删除学生及历史训练。
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import utc_now


class Classroom(Base):
    __tablename__ = "classrooms"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160))
    course_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("course_versions.id"))
    owner_teacher_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("classroom_id", "student_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    classroom_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classrooms.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(32), default="active")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
