# [导读] 所属业务: 教师班级管理、学情统计与训练回放。
# [导读] 业务名词: 学情是学生学习和训练的证据汇总; Replay 是历史训练回放; Enrollment 用来证明学
# [导读] 生属于哪个班级。
# [导读] 用途: 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。
# [导读] 为什么: 接口层尽量只做请求转接和响应组装, 使业务规则能在服务层复用; 调整参数时需同步前
# [导读] 端 API 与 schemas。
# [导读] 结构: classrooms、overview、_active_within_7_days、students、student_progress、
# [导读] attempt_repla
# [导读] y、create_student、update_student。
# [导读] 提醒: 教师身份不是查看全部学生的权限; 查询应保留班级归属、成员有效状态及相应课程范围。
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.integrations.knowledge_graph.base import GraphStore
from app.modules.assessment.models import Evaluation
from app.modules.auth.dependencies import Principal, require_roles
from app.modules.classrooms.models import Classroom, Enrollment
from app.modules.teacher_analytics.competency import competency_summaries
from app.modules.teacher_analytics.roster_service import RosterService
from app.modules.teacher_analytics.schemas import (
    AttemptReplay,
    ClassroomItem,
    ClassroomOverview,
    ImportResult,
    ImportStudentsRequest,
    StudentCreate,
    StudentDetail,
    StudentItem,
    StudentUpdate,
)
from app.modules.teacher_analytics.service import TeacherAnalyticsService
from app.modules.training.models import Attempt

router = APIRouter(prefix="/api/v1/teacher", tags=["teacher"])
Teacher = Annotated[Principal, Depends(require_roles("teacher"))]
Db = Annotated[Session, Depends(get_db)]


# [导读] 承接 GET /classrooms; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相信客
# [导读] 户端传入的用户编号。
@router.get("/classrooms", response_model=list[ClassroomItem])
def classrooms(principal: Teacher, db: Db) -> list[ClassroomItem]:
    rows = db.execute(
        select(Classroom, func.count(Enrollment.id))
        .outerjoin(
            Enrollment, (Enrollment.classroom_id == Classroom.id) & (Enrollment.status == "active")
        )
        .where(Classroom.owner_teacher_id == principal.user.id)
        .group_by(Classroom.id)
    ).all()
    return [ClassroomItem(id=item.id, name=item.name, student_count=count) for item, count in rows]


# [导读] 承接 GET
# [导读] /classrooms/{classroom_id}/overview; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核
# [导读] 对, 不能相信客户端传入的用户编号。
@router.get("/classrooms/{classroom_id}/overview", response_model=ClassroomOverview)
def overview(classroom_id: uuid.UUID, principal: Teacher, db: Db) -> ClassroomOverview:
    service = TeacherAnalyticsService(db, principal.user.id)
    classroom = service.classroom(classroom_id)
    students = service.students(classroom_id)
    ids = [item.id for item in students]
    completed = (
        db.scalar(
            select(func.count(Attempt.id)).where(
                Attempt.student_id.in_(ids),
                Attempt.status == "completed",
                Attempt.course_version_id == classroom.course_version_id,
            )
        )
        if ids
        else 0
    )
    average = (
        db.scalar(
            select(func.avg(Evaluation.overall_score))
            .join(Attempt, Attempt.id == Evaluation.attempt_id)
            .where(Attempt.student_id.in_(ids))
            .where(Attempt.course_version_id == classroom.course_version_id)
        )
        if ids
        else None
    )
    return ClassroomOverview(
        student_count=len(students),
        active_students_7d=sum(_active_within_7_days(item.last_active_at) for item in students),
        completed_attempts=completed or 0,
        average_score=round(float(average), 1) if average is not None else None,
        attention_count=sum(bool(item.risk_reasons) for item in students),
        weak_dimensions=[
            item
            for item in competency_summaries(
                db,
                student_ids=ids,
                course_version_id=classroom.course_version_id,
                include_trend=False,
            )
            if item.needs_attention
        ][:5],
    )


def _active_within_7_days(value: datetime | None) -> bool:
    if value is None:
        return False
    normalized = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    return normalized >= datetime.now(UTC) - timedelta(days=7)


# [导读] 承接 GET
# [导读] /classrooms/{classroom_id}/students; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核
# [导读] 对, 不能相信客户端传入的用户编号。
@router.get("/classrooms/{classroom_id}/students", response_model=list[StudentItem])
def students(classroom_id: uuid.UUID, principal: Teacher, db: Db) -> list[StudentItem]:
    return TeacherAnalyticsService(db, principal.user.id).students(classroom_id)


# [导读] 承接 GET /students/{student_id}/progress; 身份来自依赖注入, 业务归属限制仍由下方查询或
# [导读] 服务核对, 不能相信客户端传入的用户编号。
@router.get("/students/{student_id}/progress", response_model=StudentDetail)
def student_progress(student_id: uuid.UUID, principal: Teacher, db: Db) -> StudentDetail:
    return TeacherAnalyticsService(db, principal.user.id).student_detail(student_id)


# [导读] 承接 GET /attempts/{attempt_id}; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对,
# [导读] 不能相信客户端传入的用户编号。
@router.get("/attempts/{attempt_id}", response_model=AttemptReplay)
def attempt_replay(
    attempt_id: uuid.UUID, request: Request, principal: Teacher, db: Db
) -> AttemptReplay:
    graph_store = cast(GraphStore, request.app.state.graph_store)
    return TeacherAnalyticsService(db, principal.user.id, graph_store).attempt_replay(attempt_id)


# [导读] 承接 POST
# [导读] /classrooms/{classroom_id}/students; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核
# [导读] 对, 不能相信客户端传入的用户编号。
@router.post("/classrooms/{classroom_id}/students", response_model=StudentItem, status_code=201)
def create_student(
    classroom_id: uuid.UUID, data: StudentCreate, principal: Teacher, db: Db
) -> StudentItem:
    return RosterService(db, principal.user.id).create(classroom_id, data)


# [导读] 承接 PATCH /classrooms/{classroom_id}/students/{student_id}; 身份来自依赖注入, 业务归属
# [导读] 限制仍由下方查询或服务核对
# [导读] , 不能相信客户端传入的用户编号。
@router.patch("/classrooms/{classroom_id}/students/{student_id}", response_model=StudentItem)
def update_student(
    classroom_id: uuid.UUID, student_id: uuid.UUID, data: StudentUpdate, principal: Teacher, db: Db
) -> StudentItem:
    return RosterService(db, principal.user.id).update(classroom_id, student_id, data)


# [导读] 承接 DELETE /classrooms/{classroom_id}/students/{student_id}; 身份来自依赖注入, 业务归
# [导读] 属限制仍由下方查询或服务核
# [导读] 对, 不能相信客户端传入的用户编号。
@router.delete("/classrooms/{classroom_id}/students/{student_id}", status_code=204)
def remove_student(
    classroom_id: uuid.UUID, student_id: uuid.UUID, principal: Teacher, db: Db
) -> Response:
    RosterService(db, principal.user.id).remove(classroom_id, student_id)
    return Response(status_code=204)


# [导读] 承接 POST /classrooms/{classroom_id}/students/import; 身份来自依赖注入, 业务归属限制仍
# [导读] 由下方查询或服务核对, 不能相信客户
# [导读] 端传入的用户编号。
@router.post("/classrooms/{classroom_id}/students/import", response_model=ImportResult)
def import_students(
    classroom_id: uuid.UUID, data: ImportStudentsRequest, principal: Teacher, db: Db
) -> ImportResult:
    students = RosterService(db, principal.user.id).import_all(classroom_id, data.rows)
    return ImportResult(created=len(students), enrolled=len(students))
