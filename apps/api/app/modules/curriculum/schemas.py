# [导读] 所属业务: 版本化课程与小节。
# [导读] 业务名词: TrainingUnit 是课程小节; Rubric 是评价维度及权重; PromptTemplate 是发给模型的
# [导读] 指令模板。
# [导读] 用途: 定义该业务的请求、响应和结构化校验模型。
# [导读] 为什么: 用字段类型、枚举和校验器限定接口契约; 数据库模型与公开响应不同, 新增字段时要检
# [导读] 查是否泄漏内部信息。
# [导读] 结构: UnitMapItem、ChapterMapItem、CourseMapResponse、RubricDimensionResponse、
# [导读] UnitDetailRe
# [导读] sponse。
# [导读] 提醒: 旧训练绑定旧课程版本; 更新课程时应创建新版本, 不要直接改写历史训练的版本关联。
from __future__ import annotations

import uuid

from pydantic import BaseModel


class UnitMapItem(BaseModel):
    id: str
    title: str
    description: str
    training_mode: str
    estimated_minutes: int
    status: str
    sort_order: int
    active_attempt_id: uuid.UUID | None = None


class ChapterMapItem(BaseModel):
    id: str
    title: str
    sort_order: int
    units: list[UnitMapItem]


class CourseMapResponse(BaseModel):
    course_id: str
    course_title: str
    course_version: str
    completed_units: int
    total_units: int
    chapters: list[ChapterMapItem]


class RubricDimensionResponse(BaseModel):
    key: str
    label: str
    weight: float


class UnitDetailResponse(BaseModel):
    workspace_kind: str | None = None
    document_correction_enabled: bool = False
    id: str
    title: str
    description: str
    learning_objectives: list[str]
    training_mode: str
    prerequisite_unit_ids: list[str]
    estimated_minutes: int
    difficulty_options: list[str]
    knowledge_tags: list[str]
    rubric_dimensions: list[RubricDimensionResponse]
    status: str
    supported_experience_modes: list[str]
