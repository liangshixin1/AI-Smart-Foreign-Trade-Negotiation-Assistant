# [导读] 所属业务: 版本化课程与小节。
# [导读] 业务名词: TrainingUnit 是课程小节; Rubric 是评价维度及权重; PromptTemplate 是发给模型的
# [导读] 指令模板。
# [导读] 用途: 封装该业务使用的查询和持久化操作。
# [导读] 为什么: 把 SQL 查询集中便于核对过滤范围; 保持用户、课程版本及状态条件, flush 不代表
# [导读] commit, 事务归属要沿调用方确认。
# [导读] 结构: CurriculumRepository。
# [导读] 提醒: 旧训练绑定旧课程版本; 更新课程时应创建新版本, 不要直接改写历史训练的版本关联。
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.classrooms.models import Classroom, Enrollment
from app.modules.curriculum.models import Chapter, CourseVersion, TrainingUnit


class CurriculumRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def current_course(self, student_id: uuid.UUID) -> CourseVersion | None:
        statement = (
            select(CourseVersion)
            .join(Classroom, Classroom.course_version_id == CourseVersion.id)
            .join(Enrollment, Enrollment.classroom_id == Classroom.id)
            .where(
                Enrollment.student_id == student_id,
                Enrollment.status == "active",
                Classroom.status == "active",
                CourseVersion.status == "published",
            )
            .options(
                selectinload(CourseVersion.course),
                selectinload(CourseVersion.chapters)
                .selectinload(Chapter.units)
                .selectinload(TrainingUnit.rubric),
            )
        )
        return self.db.scalar(statement)

    def unit_for_student(self, student_id: uuid.UUID, unit_key: str) -> TrainingUnit | None:
        statement = (
            select(TrainingUnit)
            .join(Chapter, TrainingUnit.chapter_id == Chapter.id)
            .join(CourseVersion, Chapter.course_version_id == CourseVersion.id)
            .join(Classroom, Classroom.course_version_id == CourseVersion.id)
            .join(Enrollment, Enrollment.classroom_id == Classroom.id)
            .where(
                Enrollment.student_id == student_id,
                Enrollment.status == "active",
                Classroom.status == "active",
                TrainingUnit.unit_key == unit_key,
                TrainingUnit.status == "published",
            )
            .options(selectinload(TrainingUnit.rubric))
        )
        return self.db.scalar(statement)

    def unit_statuses(
        self, student_id: uuid.UUID, course_version_id: uuid.UUID
    ) -> tuple[dict[uuid.UUID, uuid.UUID], dict[uuid.UUID, tuple[str, uuid.UUID]]]:
        from app.modules.curriculum.continuity import projected_statuses

        return projected_statuses(self.db, student_id, course_version_id)
