from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import hash_password
from app.modules.auth.models import Role, User, UserRole
from app.modules.classrooms.models import Classroom, Enrollment
from app.modules.teacher_analytics.schemas import StudentCreate, StudentItem, StudentUpdate
from app.modules.teacher_analytics.student_metrics import student_item


class RosterService:
    def __init__(self, db: Session, teacher_id: uuid.UUID) -> None:
        self.db = db
        self.teacher_id = teacher_id

    def create(self, classroom_id: uuid.UUID, data: StudentCreate) -> StudentItem:
        classroom = self._classroom(classroom_id)
        self._ensure_available([data])
        user = self._add(classroom_id, data, self._student_role())
        self.db.commit()
        return student_item(self.db, user, classroom.course_version_id)

    def import_all(self, classroom_id: uuid.UUID, rows: list[StudentCreate]) -> list[StudentItem]:
        classroom = self._classroom(classroom_id)
        self._ensure_available(rows)
        role = self._student_role()
        users = [self._add(classroom_id, row, role) for row in rows]
        self.db.commit()
        return [student_item(self.db, user, classroom.course_version_id) for user in users]

    def update(
        self, classroom_id: uuid.UUID, student_id: uuid.UUID, data: StudentUpdate
    ) -> StudentItem:
        user = self._enrolled_student(classroom_id, student_id)
        if data.display_name is not None:
            user.display_name = data.display_name
        if data.email is not None:
            email = str(data.email).lower()
            duplicate = self.db.scalar(
                select(User.id).where(func.lower(User.email) == email, User.id != user.id)
            )
            if duplicate is not None:
                raise AppError(
                    code="teacher.student_conflict",
                    message="邮箱已被其他账号使用。",
                    status_code=409,
                )
            user.email = email
        if data.status is not None:
            user.status = data.status
        if data.new_password is not None:
            user.password_hash = hash_password(data.new_password)
        self.db.commit()
        classroom = self._classroom(classroom_id)
        return student_item(self.db, user, classroom.course_version_id)

    def remove(self, classroom_id: uuid.UUID, student_id: uuid.UUID) -> None:
        self._enrolled_student(classroom_id, student_id)
        enrollment = self.db.scalar(
            select(Enrollment).where(
                Enrollment.classroom_id == classroom_id, Enrollment.student_id == student_id
            )
        )
        if enrollment:
            enrollment.status = "removed"
            enrollment.left_at = datetime.now(UTC)
        self.db.commit()

    def _ensure_available(self, rows: list[StudentCreate]) -> None:
        emails = [str(row.email).lower() for row in rows]
        student_nos = [row.student_no for row in rows]
        if len(set(emails)) != len(emails) or len(set(student_nos)) != len(student_nos):
            raise AppError(
                code="teacher.import_duplicate",
                message="导入表内存在重复邮箱或学号，本次未导入任何学生。",
                status_code=409,
            )
        duplicate = self.db.scalar(
            select(User.id).where(
                (func.lower(User.email).in_(emails)) | (User.student_no.in_(student_nos))
            )
        )
        if duplicate is not None:
            raise AppError(
                code="teacher.student_conflict",
                message="邮箱或学号已存在，本次未导入任何学生。",
                status_code=409,
            )

    def _student_role(self) -> Role:
        role = self.db.scalar(select(Role).where(Role.code == "student"))
        if role is None:
            raise RuntimeError("Student role is missing")
        return role

    def _add(self, classroom_id: uuid.UUID, data: StudentCreate, role: Role) -> User:
        user = User(
            email=str(data.email).lower(),
            student_no=data.student_no,
            display_name=data.display_name,
            password_hash=hash_password(data.initial_password),
        )
        self.db.add(user)
        self.db.flush()
        self.db.add_all(
            [
                UserRole(user_id=user.id, role_id=role.id),
                Enrollment(classroom_id=classroom_id, student_id=user.id),
            ]
        )
        return user

    def _classroom(self, classroom_id: uuid.UUID) -> Classroom:
        classroom = self.db.scalar(
            select(Classroom).where(
                Classroom.id == classroom_id,
                Classroom.owner_teacher_id == self.teacher_id,
                Classroom.status == "active",
            )
        )
        if classroom is None:
            raise AppError(
                code="teacher.classroom_not_found",
                message="班级不存在或无权访问。",
                status_code=404,
            )
        return classroom

    def _enrolled_student(self, classroom_id: uuid.UUID, student_id: uuid.UUID) -> User:
        self._classroom(classroom_id)
        user = self.db.scalar(
            select(User)
            .join(Enrollment, Enrollment.student_id == User.id)
            .where(
                User.id == student_id,
                Enrollment.classroom_id == classroom_id,
                Enrollment.status == "active",
            )
        )
        if user is None:
            raise AppError(
                code="teacher.student_not_found", message="学生不在该班级。", status_code=404
            )
        return user
