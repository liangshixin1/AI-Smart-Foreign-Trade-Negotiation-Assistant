# [导读] 用途: 定义 SQLAlchemy 模型共用的声明基类。
# [导读] 为什么: 共用一份 metadata 使迁移工具能汇总所有已导入的数据表定义。
# [导读] 结构: Base。
# [导读] 提醒: 新增模型还需检查迁移环境是否导入, 只有 Python 类存在不代表数据库已建表。
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from app.modules.assessment import models as assessment_models  # noqa: E402,F401
from app.modules.auth import models as auth_models  # noqa: E402,F401
from app.modules.classrooms import models as classroom_models  # noqa: E402,F401
from app.modules.curriculum import models as curriculum_models  # noqa: E402,F401
from app.modules.document_correction import models as document_models  # noqa: E402,F401
from app.modules.knowledge_graph import models as knowledge_graph_models  # noqa: E402,F401
from app.modules.progress import models as progress_models  # noqa: E402,F401
from app.modules.simulation import models as simulation_models  # noqa: E402,F401
from app.modules.training import models as training_models  # noqa: E402,F401
