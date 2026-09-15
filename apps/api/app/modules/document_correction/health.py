# [导读] 所属业务: 信用证结构化审改。
# [导读] 业务名词: 信用证是银行按约定单据付款的承诺; MT700 是本项目采用的信用证报文样式; 批注是
# [导读] 学生提出的改证意见。
# [导读] 用途与原因: 核对审改功能开关、数据库迁移和版本化资料是否就绪; 用于区分功能未启用与运行
# [导读] 环境缺失。
# [导读] 结构: readiness。
# [导读] 提醒: 原证与标准答案以快照保存; 学生只改批注。成绩由版本化本地规则计算, 模型仅生成额外
# [导读] 讲评。
from __future__ import annotations

from typing import Any

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.modules.document_correction.profile_service import load_assets


def readiness(db: Session, enabled: bool) -> dict[str, Any]:
    tables = set(inspect(db.get_bind()).get_table_names())
    required = {
        "document_correction_sessions",
        "document_annotations",
        "document_operations",
        "document_correction_results",
    }
    heads = (
        list(db.scalars(text("SELECT version_num FROM alembic_version")))
        if "alembic_version" in tables
        else []
    )
    profile_ready = False
    try:
        load_assets()
        profile_ready = True
    except Exception:
        pass
    ready = required <= tables and "20260908_0018" in heads and profile_ready
    return {
        "enabled": enabled,
        "database_heads": heads,
        "missing_tables": sorted(required - tables),
        "profile_ready": profile_ready,
        "ready": ready,
        "message": "信用证审改环境已就绪。"
        if ready
        else "环境未就绪：请备份数据库、升级至0018并检查已审校的内容profile。",
    }
