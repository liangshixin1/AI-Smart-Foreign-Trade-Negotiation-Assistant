# [导读] 所属业务: 信用证结构化审改。
# [导读] 业务名词: 信用证是银行按约定单据付款的承诺; MT700 是本项目采用的信用证报文样式; 批注是
# [导读] 学生提出的改证意见。
# [导读] 用途与原因: 加载并校验审改资料及所需表结构; 拒绝缺失或不匹配的配置, 避免使用不完整标准
# [导读] 答案评分。
# [导读] 结构: error、load_assets、require_tables、is_published。
# [导读] 提醒: 原证与标准答案以快照保存; 学生只改批注。成绩由版本化本地规则计算, 模型仅生成额外
# [导读] 讲评。
from __future__ import annotations

import json
from typing import Any

from pydantic import ValidationError
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.resources import resource_root
from app.modules.document_correction.schemas import Document

ROOT = resource_root() / "content/document-correction"
UNIT_KEY = "chapter-6-section-1"
UNIT_VERSION = "2.2.2"


def error(code: str, message: str, status: int = 409) -> AppError:
    return AppError(code="document." + code, message=message, status_code=status)


def load_assets() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    try:

        def read(path: str) -> dict[str, Any]:
            return dict(json.loads((ROOT / path).read_text()))

        profile = read("profiles/lc-correction-chapter-6-section-1-v1.json")
        case = read("cases/chapter-6-section-1-case-v1.json")
        document = Document.model_validate(read("templates/mt700-review-v1.json")).model_dump()
        answers = read("variants/standard-a.json")
    except (OSError, ValueError, ValidationError) as exc:
        raise error("schema_unsupported", "单证格式暂无法载入，请联系教师。", 503) from exc
    if (
        case["review_status"] != "approved"
        or case["pending_review"]
        or any(f["status"] != "approved" for f in case["facts"])
    ):
        raise error("case_pending_review", "合同事实尚未完成教学审校，暂不能创建训练。", 503)
    if len(answers["issues"]) != 8 or sum(i["weight"] for i in answers["issues"]) != 100:
        raise error("profile_invalid", "评分内容未就绪，请联系教师。", 503)
    return profile, case, document, answers


def require_tables(db: Session) -> None:
    names = set(inspect(db.get_bind()).get_table_names())
    if (
        not {
            "document_correction_sessions",
            "document_annotations",
            "document_correction_results",
            "document_operations",
        }
        <= names
    ):
        raise error("migration_required", "环境未就绪：请技术员备份数据库并升级至0018。", 503)


def is_published(unit_key: str, version: str) -> bool:
    return unit_key == UNIT_KEY and version == UNIT_VERSION
