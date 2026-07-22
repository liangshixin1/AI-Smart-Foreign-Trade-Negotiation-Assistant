from __future__ import annotations

from app.core.errors import AppError
from app.modules.auth.models import User
from app.modules.curriculum.models import TrainingUnit
from app.modules.curriculum.repository import CurriculumRepository
from app.modules.curriculum.schemas import (
    ChapterMapItem,
    CourseMapResponse,
    RubricDimensionResponse,
    UnitDetailResponse,
    UnitMapItem,
)


class CurriculumService:
    def __init__(self, repository: CurriculumRepository) -> None:
        self.repository = repository

    def get_map(self, student: User) -> CourseMapResponse:
        version = self.repository.current_course(student.id)
        if version is None:
            raise AppError(
                code="curriculum.current_course_not_found",
                message="当前账号尚未加入有效课程班级。",
                status_code=404,
            )
        completed, latest_attempts = self.repository.unit_statuses(student.id, version.id)
        completed_keys = {
            unit.unit_key
            for chapter in version.chapters
            for unit in chapter.units
            if unit.id in completed
        }

        def status_for_unit(unit: TrainingUnit) -> str:
            unit_id = unit.id
            if unit_id in completed:
                return "completed"
            latest = latest_attempts.get(unit_id)
            attempt_status = latest[0] if latest else None
            if attempt_status in {"submitted", "evaluating"}:
                return "pending_evaluation"
            if attempt_status == "evaluation_failed":
                return "evaluation_failed"
            if attempt_status == "in_progress":
                return "in_progress"
            if any(item not in completed_keys for item in unit.prerequisite_unit_ids):
                return "locked"
            return "available"

        chapters = [
            ChapterMapItem(
                id=chapter.chapter_key,
                title=chapter.title,
                sort_order=chapter.sort_order,
                units=[
                    UnitMapItem(
                        id=unit.unit_key,
                        title=unit.title,
                        description=unit.description,
                        training_mode=unit.training_mode,
                        estimated_minutes=unit.estimated_minutes,
                        status=status_for_unit(unit),
                        sort_order=unit.sort_order,
                        active_attempt_id=(
                            completed[unit.id]
                            if unit.id in completed
                            else (
                                latest_attempts[unit.id][1] if unit.id in latest_attempts else None
                            )
                        ),
                    )
                    for unit in sorted(chapter.units, key=lambda item: item.sort_order)
                ],
            )
            for chapter in sorted(version.chapters, key=lambda item: item.sort_order)
        ]
        return CourseMapResponse(
            course_id=version.course.code,
            course_title=version.course.title,
            course_version=version.version,
            completed_units=len(completed),
            total_units=sum(len(chapter.units) for chapter in chapters),
            chapters=chapters,
        )

    def get_unit(self, student: User, unit_key: str) -> UnitDetailResponse:
        unit = self.repository.unit_for_student(student.id, unit_key)
        if unit is None:
            raise AppError(
                code="curriculum.unit_not_found",
                message="小节不存在或当前账号无权访问。",
                status_code=404,
            )
        version = unit.chapter.course_version
        completed, latest_attempts = self.repository.unit_statuses(student.id, version.id)
        completed_keys = {
            item.unit_key
            for chapter in version.chapters
            for item in chapter.units
            if item.id in completed
        }
        latest = latest_attempts.get(unit.id)
        if unit.id in completed:
            status = "completed"
        elif latest and latest[0] in {
            "in_progress",
            "submitted",
            "evaluating",
            "evaluation_failed",
        }:
            status = latest[0]
        elif any(item not in completed_keys for item in unit.prerequisite_unit_ids):
            status = "locked"
        else:
            status = "available"
        return UnitDetailResponse(
            id=unit.unit_key,
            title=unit.title,
            description=unit.description,
            learning_objectives=unit.learning_objectives,
            training_mode=unit.training_mode,
            prerequisite_unit_ids=unit.prerequisite_unit_ids,
            estimated_minutes=unit.estimated_minutes,
            difficulty_options=unit.difficulty_options,
            knowledge_tags=unit.knowledge_tags,
            rubric_dimensions=[
                RubricDimensionResponse.model_validate(item) for item in unit.rubric.dimensions
            ],
            status=status,
        )
