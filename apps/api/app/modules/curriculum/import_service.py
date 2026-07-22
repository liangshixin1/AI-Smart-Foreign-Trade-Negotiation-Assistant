from __future__ import annotations

import hashlib
import re
from pathlib import Path

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.curriculum.content_schemas import (
    ChapterFile,
    CourseFile,
    PromptFile,
    RubricFile,
    TrainingTemplateFile,
)
from app.modules.curriculum.import_repository import ContentImportRepository
from app.modules.curriculum.models import (
    Chapter,
    Course,
    CourseVersion,
    TrainingUnit,
)

VARIABLE_PATTERN = re.compile(r"{{\s*([a-zA-Z0-9_]+)\s*}}")


def _read_yaml(path: Path) -> object:
    with path.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


class CurriculumImporter:
    def __init__(self, db: Session, content_root: Path) -> None:
        self.db = db
        self.root = content_root
        self.repository = ContentImportRepository(db)

    def import_slice(self) -> CourseVersion:
        course_file = CourseFile.model_validate(_read_yaml(self.root / "curriculum/course.yaml"))
        chapter_files = [
            ChapterFile.model_validate(_read_yaml(self.root / "curriculum" / relative_path))
            for relative_path in course_file.chapter_files
        ]
        templates = self._load_templates()
        prompts = self._load_prompts()
        rubrics = self._load_rubrics()
        self._validate_references(chapter_files, templates, prompts, rubrics)
        manifest_hash = self._manifest_hash()

        course = self.db.scalar(select(Course).where(Course.code == course_file.id))
        if course is None:
            course = Course(code=course_file.id, title=course_file.title)
            self.db.add(course)
            self.db.flush()
        existing = self.db.scalar(
            select(CourseVersion).where(
                CourseVersion.course_id == course.id,
                CourseVersion.version == course_file.version,
            )
        )
        if existing is not None:
            if existing.manifest_hash != manifest_hash:
                raise AppError(
                    code="curriculum.immutable_version_conflict",
                    message="同名已发布课程版本的内容哈希不同。",
                    status_code=409,
                )
            return existing

        template_models = {item.id: self.repository.upsert_template(item) for item in templates}
        prompt_models = {item.id: self.repository.upsert_prompt(item) for item in prompts}
        rubric_models = {item.id: self.repository.upsert_rubric(item) for item in rubrics}
        version = CourseVersion(
            course=course,
            version=course_file.version,
            status=course_file.publication_status,
            source_hash=course_file.source_sha256,
            manifest_hash=manifest_hash,
        )
        self.db.add(version)
        for chapter_file in chapter_files:
            chapter = Chapter(
                course_version=version,
                chapter_key=chapter_file.id,
                title=chapter_file.title,
                sort_order=chapter_file.sort_order,
            )
            self.db.add(chapter)
            for unit in chapter_file.units:
                self.db.add(
                    TrainingUnit(
                        chapter=chapter,
                        unit_key=unit.id,
                        title=unit.title,
                        description=unit.description,
                        learning_objectives=unit.learning_objectives,
                        training_mode=unit.training_mode,
                        prerequisite_unit_ids=unit.prerequisite_unit_ids,
                        estimated_minutes=unit.estimated_minutes,
                        difficulty_options=unit.difficulty_options,
                        knowledge_tags=unit.knowledge_tags,
                        sort_order=unit.sort_order,
                        version=unit.version,
                        status=unit.publication_status,
                        template_id=template_models[unit.template_id].id,
                        rubric=rubric_models[unit.rubric_id],
                        scenario_prompt_id=prompt_models[unit.scenario_prompt_id].id,
                        conversation_prompt_id=prompt_models[unit.conversation_prompt_id].id,
                        round_evaluation_prompt_id=prompt_models[
                            unit.round_evaluation_prompt_id
                        ].id,
                        evaluation_prompt_id=prompt_models[unit.evaluation_prompt_id].id,
                    )
                )
        self.db.commit()
        return version

    def _load_templates(self) -> list[TrainingTemplateFile]:
        return [
            TrainingTemplateFile.model_validate(_read_yaml(path))
            for path in sorted((self.root / "training-templates").glob("*.yaml"))
        ]

    def _load_prompts(self) -> list[PromptFile]:
        prompts = [
            PromptFile.model_validate(_read_yaml(path))
            for path in sorted((self.root / "prompts").glob("*/*.yaml"))
        ]
        for prompt in prompts:
            if set(VARIABLE_PATTERN.findall(prompt.template)) != set(prompt.input_variables):
                raise ValueError(f"Prompt variable mismatch: {prompt.id}")
        return prompts

    def _load_rubrics(self) -> list[RubricFile]:
        return [
            RubricFile.model_validate(_read_yaml(path))
            for path in sorted((self.root / "rubrics").glob("*.yaml"))
        ]

    def _validate_references(
        self,
        chapters: list[ChapterFile],
        templates: list[TrainingTemplateFile],
        prompts: list[PromptFile],
        rubrics: list[RubricFile],
    ) -> None:
        template_ids = {item.id for item in templates}
        prompt_ids = {item.id for item in prompts}
        rubric_ids = {item.id for item in rubrics}
        unit_ids = {unit.id for chapter in chapters for unit in chapter.units}
        for chapter in chapters:
            for unit in chapter.units:
                required = {
                    unit.scenario_prompt_id,
                    unit.conversation_prompt_id,
                    unit.round_evaluation_prompt_id,
                    unit.evaluation_prompt_id,
                }
                if unit.template_id not in template_ids or unit.rubric_id not in rubric_ids:
                    raise ValueError(f"Missing template or rubric for {unit.id}")
                if not required <= prompt_ids or not set(unit.prerequisite_unit_ids) <= unit_ids:
                    raise ValueError(f"Missing prompt or prerequisite for {unit.id}")

    def _manifest_hash(self) -> str:
        digest = hashlib.sha256()
        for path in sorted(self.root.rglob("*.yaml")):
            digest.update(path.relative_to(self.root).as_posix().encode())
            digest.update(path.read_bytes())
        return digest.hexdigest()
