import uuid

from app.core.errors import AppError
from app.modules.auth.models import User
from app.modules.training.models import Attempt
from app.modules.training.repository import TrainingRepository


def owned_attempt(repository: TrainingRepository, student: User, attempt_id: uuid.UUID) -> Attempt:
    attempt = repository.attempt_for_student(student.id, attempt_id)
    if attempt is None:
        raise AppError(
            code="training.attempt_not_found",
            message="训练记录不存在或无权访问。",
            status_code=404,
        )
    return attempt
