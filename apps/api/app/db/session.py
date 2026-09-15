# [导读] 用途: 创建数据库引擎、会话工厂和每请求使用的 Session。
# [导读] 为什么: 请求各自持有会话便于释放连接; 禁用自动 flush, 让写入时机由业务代码明确控制。
# [导读] 结构: build_engine、build_session_factory、get_db。
# [导读] 提醒: get_db 只管理会话生命周期, 不会替业务自动 commit; flush 是发送 SQL, 不等于提交。
# [导读] 同步 Session 不宜跨线程或并发任务共享。
from __future__ import annotations

from collections.abc import Generator

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings


# [导读] SQLite 需允许请求线程使用连接; 连接池借出前探活, 但这不能替代事务失败后的回滚。
def build_engine(settings: Settings) -> Engine:
    connect_args = (
        {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
    )
    return create_engine(settings.database_url, pool_pre_ping=True, connect_args=connect_args)


# [导读] 关闭自动 flush 并保留提交后对象字段, 减少隐式 SQL; 业务服务仍需主动安排提交边界。
def build_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


# [导读] 每次请求创建并最终关闭独立会话; yield 后的清理由上下文管理器完成, 未提交写入不会自动成
# [导读] 为业务成功。
def get_db(request: Request) -> Generator[Session, None, None]:
    factory: sessionmaker[Session] = request.app.state.session_factory
    with factory() as session:
        yield session
