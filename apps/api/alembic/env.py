# [导读] 用途: 为 Alembic 配置离线 SQL 生成与在线数据库迁移环境。
# [导读] 为什么: 导入业务模型以收集完整 metadata, 自动比对才知道有哪些表与约束。
# [导读] 结构: 先设置配置和模型元数据, 再根据离线或在线模式选择迁移函数。
# [导读] 提醒: 在线迁移读取实际数据库配置; 新增模型应检查此处是否纳入, 不要把未导入的表误判为应
# [导读] 删除。
from __future__ import annotations

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
from app.core.config import get_settings
from app.db.base import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", get_settings().database_url)
target_metadata = Base.metadata


# [导读] 根据选定模式配置迁移上下文并限定事务边界; 确认连接目标后再让迁移链执行。
def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# [导读] 根据选定模式配置迁移上下文并限定事务边界; 确认连接目标后再让迁移链执行。
def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
