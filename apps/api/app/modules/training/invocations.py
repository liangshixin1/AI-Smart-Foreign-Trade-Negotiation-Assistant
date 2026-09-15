# [导读] 所属业务: 一次训练从创建到提交的生命周期。
# [导读] 业务名词: Attempt 是一次训练记录; Scenario 是该次训练的场景; Submission 是正式提交时冻
# [导读] 结的内容快照。
# [导读] 用途与原因: 为普通与流式模型调用保存开始、完成、失败和用量记录; 模型出错也能追踪调用及
# [导读] 所用提示词版本。
# [导读] 结构: invoke_and_record、stream_and_record。
# [导读] 提醒: 重练创建新 Attempt, 重试评价沿用原提交; 场景 private 部分是对手底牌, 不得放入学生
# [导读] 响应。
from __future__ import annotations

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.integrations.llm.base import (
    LLMProvider,
    LLMProviderError,
    LLMRequest,
    LLMResponse,
    LLMStreamChunk,
)
from app.modules.training.models import LLMInvocation


# [导读] 先提交调用开始记录, 再调用外部模型; 成功或失败分别落库, 因此外层事务不能假定此调用完全
# [导读] 可回滚。
def invoke_and_record(db: Session, provider: LLMProvider, request: LLMRequest) -> LLMResponse:
    invocation = LLMInvocation(
        attempt_id=uuid.UUID(request.metadata["attempt_id"]),
        purpose=request.purpose,
        correlation_id=request.correlation_id,
        provider="pending",
        model_name="pending",
        prompt_template_id=request.prompt_template_id,
        prompt_version=request.prompt_version,
        status="started",
        usage={},
    )
    db.add(invocation)
    db.commit()
    try:
        response = provider.complete(request)
    except LLMProviderError as exc:
        invocation.status = "failed"
        invocation.error_category = exc.category
        invocation.finished_at = datetime.now(UTC)
        db.commit()
        raise
    invocation.provider = response.provider
    invocation.model_name = response.model
    invocation.status = "completed"
    invocation.usage = response.usage.model_dump()
    invocation.finished_at = datetime.now(UTC)
    db.commit()
    return response


# [导读] 边迭代边累计供应商与用量信息, 正常结束后才标完成; yield 暂停执行, 不能把返回迭代器当作
# [导读] 调用已完成。
def stream_and_record(
    db: Session, provider: LLMProvider, request: LLMRequest
) -> Iterator[LLMStreamChunk]:
    invocation = LLMInvocation(
        attempt_id=uuid.UUID(request.metadata["attempt_id"]),
        purpose=request.purpose,
        correlation_id=request.correlation_id,
        provider="pending",
        model_name="pending",
        prompt_template_id=request.prompt_template_id,
        prompt_version=request.prompt_version,
        status="started",
        usage={},
    )
    db.add(invocation)
    db.commit()
    try:
        for chunk in provider.stream(request):
            invocation.provider = chunk.provider
            invocation.model_name = chunk.model
            if chunk.usage is not None:
                invocation.usage = chunk.usage.model_dump()
            yield chunk
    except LLMProviderError as exc:
        invocation.status = "failed"
        invocation.error_category = exc.category
        invocation.finished_at = datetime.now(UTC)
        db.commit()
        raise
    invocation.status = "completed"
    invocation.finished_at = datetime.now(UTC)
    db.commit()
