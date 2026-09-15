# [导读] 所属业务: 登录与角色授权。
# [导读] 业务名词: Principal 是已校验的当前访问者; AuthSession 是登录令牌对应的服务端会话。
# [导读] 用途: 定义该业务的请求、响应和结构化校验模型。
# [导读] 为什么: 用字段类型、枚举和校验器限定接口契约; 数据库模型与公开响应不同, 新增字段时要检
# [导读] 查是否泄漏内部信息。
# [导读] 结构: LoginRequest、RefreshRequest、UserSummary、TokenPairResponse、MeResponse。
# [导读] 提醒: 角色通过只说明可使用这一类接口; 学生归属和教师班级范围仍需在业务查询中核对。
from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=320)
    password: str = Field(min_length=8, max_length=256)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=32, max_length=512)


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    student_no: str | None
    display_name: str
    roles: list[str]


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserSummary


class MeResponse(BaseModel):
    user: UserSummary
