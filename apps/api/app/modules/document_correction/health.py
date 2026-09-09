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
