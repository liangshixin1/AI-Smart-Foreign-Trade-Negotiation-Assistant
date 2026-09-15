# [导读] 所属业务: 版本化课程与小节。
# [导读] 业务名词: TrainingUnit 是课程小节; Rubric 是评价维度及权重; PromptTemplate 是发给模型的
# [导读] 指令模板。
# [导读] 用途与原因: 定义课程 YAML 文件的校验结构; 在内容入库前发现字段或引用错误, 减少运行时才
# [导读] 暴露的配置问题。
# [导读] 结构: CourseFile、UnitFile、ChapterFile、TrainingTemplateFile、PromptFile、
# [导读] RubricDimensionFi
# [导读] le、RubricFile。
# [导读] 提醒: 旧训练绑定旧课程版本; 更新课程时应创建新版本, 不要直接改写历史训练的版本关联。
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

PublicationStatus = Literal["draft", "published", "retired"]
TrainingMode = Literal["negotiation", "business_email", "document_review"]


class CourseFile(BaseModel):
    id: str
    title: str
    version: str
    source_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    publication_status: PublicationStatus
    chapter_files: list[str]


class UnitFile(BaseModel):
    id: str
    title: str
    description: str
    learning_objectives: list[str] = Field(min_length=1)
    training_mode: TrainingMode
    prerequisite_unit_ids: list[str]
    estimated_minutes: int = Field(gt=0)
    difficulty_options: list[str] = Field(min_length=1)
    template_id: str
    rubric_id: str
    scenario_prompt_id: str
    conversation_prompt_id: str
    round_evaluation_prompt_id: str
    evaluation_prompt_id: str
    knowledge_tags: list[str] = Field(min_length=1)
    sort_order: int = Field(ge=0)
    version: str
    publication_status: PublicationStatus


class ChapterFile(BaseModel):
    id: str
    title: str
    sort_order: int = Field(ge=0)
    units: list[UnitFile] = Field(min_length=1)


class TrainingTemplateFile(BaseModel):
    id: str
    version: str
    training_mode: TrainingMode
    publication_status: PublicationStatus
    input_variables: list[str]
    workspace_contract: dict[str, object]


class PromptFile(BaseModel):
    id: str
    version: str
    purpose: Literal["scenario", "conversation", "evaluation"]
    training_modes: list[TrainingMode]
    publication_status: PublicationStatus
    input_variables: list[str]
    output_schema: str
    template: str
    change_log: list[dict[str, str]]


class RubricDimensionFile(BaseModel):
    key: str
    label: str
    weight: float = Field(gt=0, le=1)


class RubricFile(BaseModel):
    id: str
    version: str
    publication_status: PublicationStatus
    pass_score: float = Field(ge=0, le=100)
    dimensions: list[RubricDimensionFile] = Field(min_length=1)
    hard_fail_rules: list[str]

    @model_validator(mode="after")
    def weights_sum_to_one(self) -> RubricFile:
        if abs(sum(item.weight for item in self.dimensions) - 1) > 0.000001:
            raise ValueError("Rubric dimension weights must sum to 1.")
        return self
