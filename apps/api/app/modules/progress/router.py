# [导读] 所属业务: 可追溯的课程完成进度。
# [导读] 业务名词: ProgressRecord 是某学生在某课程版本、某小节的通关记录, 关联完成它的训练。
# [导读] 用途: 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。
# [导读] 为什么: 接口层尽量只做请求转接和响应组装, 使业务规则能在服务层复用; 调整参数时需同步前
# [导读] 端 API 与 schemas。
# [导读] 结构: my_progress。
# [导读] 提醒: 看到学习内容、完成对话和课程通关是不同事件; 不要把浏览次数直接算成课程完成。
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import Principal, require_roles
from app.modules.training.repository import TrainingRepository
from app.modules.training.schemas import ProgressItemResponse, ProgressResponse

router = APIRouter(prefix="/api/v1/me", tags=["progress"])


# [导读] 承接 GET /progress; 身份来自依赖注入, 业务归属限制仍由下方查询或服务核对, 不能相信客户
# [导读] 端传入的用户编号。
@router.get("/progress", response_model=ProgressResponse)
def my_progress(
    principal: Annotated[Principal, Depends(require_roles("student"))],
    db: Annotated[Session, Depends(get_db)],
) -> ProgressResponse:
    repository = TrainingRepository(db)
    records = repository.progress(principal.user.id)
    return ProgressResponse(
        completed_units=len(records),
        items=[
            ProgressItemResponse(
                unit_id=repository.unit(item.unit_id).unit_key,
                completed_attempt_id=item.completed_attempt_id,
                latest_score=item.latest_score,
                best_score=item.best_score,
                completed_at=item.completed_at,
            )
            for item in records
        ],
    )
