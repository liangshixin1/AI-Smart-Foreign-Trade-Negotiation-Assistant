# [导读] 所属业务: 信用证结构化审改。
# [导读] 业务名词: 信用证是银行按约定单据付款的承诺; MT700 是本项目采用的信用证报文样式; 批注是
# [导读] 学生提出的改证意见。
# [导读] 用途: 定义该业务的请求、响应和结构化校验模型。
# [导读] 为什么: 用字段类型、枚举和校验器限定接口契约; 数据库模型与公开响应不同, 新增字段时要检
# [导读] 查是否泄漏内部信息。
# [导读] 结构: StrictModel、Clause、DocumentField、DocumentSection、Document、AnnotationInput、
# [导读] Revisio
# [导读] nInput、SubmitInput。
# [导读] 提醒: 原证与标准答案以快照保存; 学生只改批注。成绩由版本化本地规则计算, 模型仅生成额外
# [导读] 讲评。
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


ValueType = Literal[
    "text",
    "multiline_text",
    "party",
    "currency_amount",
    "date",
    "integer_days",
    "enum",
    "goods_description",
    "clause_list",
    "field_relation",
]


class Clause(StrictModel):
    item_id: str
    text: str
    value_type: ValueType
    value: Any
    inputs: list[str]


class DocumentField(StrictModel):
    field_id: str
    tag: str
    label: str
    value_type: ValueType
    value: Any
    display_value: str
    items: list[Clause]
    inputs: list[str]


class DocumentSection(StrictModel):
    section_id: str
    title: str
    fields: list[DocumentField]


class Document(StrictModel):
    schema_version: Literal["lc.document.v1"]
    document_type: Literal["mt700_review_copy"]
    document_number: str
    title: str
    watermark: str
    sections: list[DocumentSection]


class AnnotationInput(StrictModel):
    expected_revision: int = Field(ge=0)
    client_operation_id: str = Field(min_length=8, max_length=120)
    issue_category: Literal["", "contract_mismatch", "unperformable", "ambiguous", "other"] = ""
    proposed_value: Any = None
    evidence_ref: str = Field(default="", max_length=120)
    optional_note: str = Field(default="", max_length=2000)


class RevisionInput(StrictModel):
    expected_revision: int = Field(ge=0)
    client_operation_id: str = Field(min_length=8, max_length=120)


class SubmitInput(StrictModel):
    expected_revision: int = Field(ge=0)


class Feedback(StrictModel):
    summary: str = Field(min_length=1, max_length=800)
    strengths: list[str] = Field(max_length=5)
    improvements: list[str] = Field(max_length=5)
    next_actions: list[str] = Field(max_length=5)
    knowledge_recommendations: list[str] = Field(max_length=8)
