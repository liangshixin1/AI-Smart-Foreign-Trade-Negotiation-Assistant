# [导读] 所属业务: 一次训练从创建到提交的生命周期。
# [导读] 业务名词: Attempt 是一次训练记录; Scenario 是该次训练的场景; Submission 是正式提交时冻
# [导读] 结的内容快照。
# [导读] 用途与原因: 按学生身份读取其拥有的训练, 统一未找到与无权访问处理; 防止客户端替换训练编
# [导读] 号读取他人记录。
# [导读] 结构: owned_attempt。
# [导读] 提醒: 重练创建新 Attempt, 重试评价沿用原提交; 场景 private 部分是对手底牌, 不得放入学生
# [导读] 响应。
import uuid

from app.core.errors import AppError
from app.modules.auth.models import User
from app.modules.training.models import Attempt
from app.modules.training.repository import TrainingRepository


# [导读] 把 student.id 加入训练查询, 以防用户仅凭另一个 attempt_id 越权读取记录。
def owned_attempt(repository: TrainingRepository, student: User, attempt_id: uuid.UUID) -> Attempt:
    attempt = repository.attempt_for_student(student.id, attempt_id)
    if attempt is None:
        raise AppError(
            code="training.attempt_not_found",
            message="训练记录不存在或无权访问。",
            status_code=404,
        )
    return attempt
