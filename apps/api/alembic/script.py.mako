## [导读] 用途：生成新数据库迁移文件的 Mako 模板。
## [导读] 为什么：统一修订编号、父版本以及 upgrade/downgrade 结构，使迁移链可连续追踪。
## [导读] 提醒：这里用 Mako 模板注释，不写入生成后的迁移正文；生成后仍需人工检查数据迁移逻辑。
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
