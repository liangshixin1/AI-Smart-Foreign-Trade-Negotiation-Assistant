from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from app.modules.assessment import models as assessment_models  # noqa: E402,F401
from app.modules.auth import models as auth_models  # noqa: E402,F401
from app.modules.classrooms import models as classroom_models  # noqa: E402,F401
from app.modules.curriculum import models as curriculum_models  # noqa: E402,F401
from app.modules.knowledge_graph import models as knowledge_graph_models  # noqa: E402,F401
from app.modules.progress import models as progress_models  # noqa: E402,F401
from app.modules.training import models as training_models  # noqa: E402,F401
