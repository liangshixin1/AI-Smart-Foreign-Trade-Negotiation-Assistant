# [导读] 所属业务: 版本化课程与小节。
# [导读] 业务名词: TrainingUnit 是课程小节; Rubric 是评价维度及权重; PromptTemplate 是发给模型的
# [导读] 指令模板。
# [导读] 用途与原因: 集中查找和写入课程导入实体, 便于导入服务统一安排事务; 不要在单个小节处理中
# [导读] 随意提前提交。
# [导读] 结构: ContentImportRepository。
# [导读] 提醒: 旧训练绑定旧课程版本; 更新课程时应创建新版本, 不要直接改写历史训练的版本关联。
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.curriculum.content_schemas import PromptFile, RubricFile, TrainingTemplateFile
from app.modules.curriculum.models import PromptTemplate, Rubric, TrainingTemplate


class ContentImportRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # [导读] 此处 flush 使新增对象可被后续 SQL 引用, 但尚未持久提交; 需沿调用方确认最终 commit
    # [导读] 或失败回滚。
    def upsert_template(self, item: TrainingTemplateFile) -> TrainingTemplate:
        model = self.db.scalar(
            select(TrainingTemplate).where(
                TrainingTemplate.template_key == item.id,
                TrainingTemplate.version == item.version,
            )
        )
        if model is None:
            model = TrainingTemplate(
                template_key=item.id,
                version=item.version,
                training_mode=item.training_mode,
                input_variables=item.input_variables,
                workspace_contract=item.workspace_contract,
                status=item.publication_status,
            )
            self.db.add(model)
            self.db.flush()
        return model

    # [导读] 此处 flush 使新增对象可被后续 SQL 引用, 但尚未持久提交; 需沿调用方确认最终 commit
    # [导读] 或失败回滚。
    def upsert_prompt(self, item: PromptFile) -> PromptTemplate:
        model = self.db.scalar(
            select(PromptTemplate).where(
                PromptTemplate.prompt_key == item.id,
                PromptTemplate.version == item.version,
            )
        )
        if model is None:
            model = PromptTemplate(
                prompt_key=item.id,
                version=item.version,
                purpose=item.purpose,
                training_modes=item.training_modes,
                input_variables=item.input_variables,
                output_schema=item.output_schema,
                body=item.template,
                change_log=item.change_log,
                status=item.publication_status,
            )
            self.db.add(model)
            self.db.flush()
        return model

    # [导读] 此处 flush 使新增对象可被后续 SQL 引用, 但尚未持久提交; 需沿调用方确认最终 commit
    # [导读] 或失败回滚。
    def upsert_rubric(self, item: RubricFile) -> Rubric:
        model = self.db.scalar(
            select(Rubric).where(
                Rubric.rubric_key == item.id,
                Rubric.version == item.version,
            )
        )
        if model is None:
            model = Rubric(
                rubric_key=item.id,
                version=item.version,
                pass_score=item.pass_score,
                dimensions=[dimension.model_dump() for dimension in item.dimensions],
                hard_fail_rules=item.hard_fail_rules,
                status=item.publication_status,
            )
            self.db.add(model)
            self.db.flush()
        return model
