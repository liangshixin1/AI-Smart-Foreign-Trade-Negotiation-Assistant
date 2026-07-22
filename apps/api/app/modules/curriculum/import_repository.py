from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.curriculum.content_schemas import PromptFile, RubricFile, TrainingTemplateFile
from app.modules.curriculum.models import PromptTemplate, Rubric, TrainingTemplate


class ContentImportRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

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
