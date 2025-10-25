"""谈判场景相关的数据模型。"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Union

from utils.normalizers import normalize_company, normalize_product, normalize_text, normalize_text_list


@dataclass
class Scenario:
    """对话场景的结构化表示，方便在服务层复用。"""

    title: str = ""
    summary: str = ""
    student_role: str = ""
    student_company: Dict[str, str] = field(default_factory=dict)
    ai_role: str = ""
    ai_company: Dict[str, str] = field(default_factory=dict)
    ai_rules: List[str] = field(default_factory=list)
    product: Dict[str, object] = field(default_factory=dict)
    market_landscape: str = ""
    timeline: str = ""
    logistics: str = ""
    risks: List[str] = field(default_factory=list)
    negotiation_targets: List[str] = field(default_factory=list)
    communication_tone: str = ""
    checklist: List[str] = field(default_factory=list)
    knowledge_points: List[str] = field(default_factory=list)
    opening_message: str = ""
    custom_variables: Dict[str, object] = field(default_factory=dict)
    extra_fields: Dict[str, object] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, payload: Dict[str, object]) -> "Scenario":
        """从多来源数据中恢复场景，并自动做基础清洗。"""
        instance = cls(
            title=normalize_text(payload.get("scenario_title") or payload.get("title")),
            summary=normalize_text(payload.get("scenario_summary") or payload.get("summary")),
            student_role=normalize_text(payload.get("student_role")),
            student_company=normalize_company(payload.get("student_company")),
            ai_role=normalize_text(payload.get("ai_role")),
            ai_company=normalize_company(payload.get("ai_company")),
            ai_rules=normalize_text_list(payload.get("ai_rules")),
            product=normalize_product(payload.get("product")),
            market_landscape=normalize_text(payload.get("market_landscape")),
            timeline=normalize_text(payload.get("timeline")),
            logistics=normalize_text(payload.get("logistics")),
            risks=normalize_text_list(payload.get("risks")),
            negotiation_targets=normalize_text_list(payload.get("negotiation_targets")),
            communication_tone=normalize_text(payload.get("communication_tone")),
            checklist=normalize_text_list(payload.get("checklist")),
            knowledge_points=normalize_text_list(payload.get("knowledge_points")),
            opening_message=normalize_text(payload.get("opening_message")),
        )

        def _normalize_json_value(value: object) -> Union[str, int, float, bool, None, Dict[str, object], List[object]]:
            if value is None:
                return None
            if isinstance(value, (str, int, float, bool)):
                return value
            if isinstance(value, dict):
                normalized_dict: Dict[str, object] = {}
                for key, sub_value in value.items():
                    if not isinstance(key, str):
                        key = str(key)
                    normalized_dict[key] = _normalize_json_value(sub_value)
                return normalized_dict
            if isinstance(value, (list, tuple, set)):
                return [_normalize_json_value(item) for item in value]
            # Fallback to string representation for unsupported types to keep JSON 安全
            return normalize_text(str(value))

        base_keys = {
            "scenario_title",
            "title",
            "scenario_summary",
            "summary",
            "student_role",
            "studentRole",
            "student_company",
            "studentCompany",
            "ai_role",
            "aiRole",
            "ai_company",
            "aiCompany",
            "ai_rules",
            "aiRules",
            "product",
            "market_landscape",
            "marketLandscape",
            "timeline",
            "logistics",
            "risks",
            "negotiation_targets",
            "negotiationTargets",
            "communication_tone",
            "communicationTone",
            "checklist",
            "knowledge_points",
            "knowledgePoints",
            "opening_message",
            "openingMessage",
        }

        custom_variables: Dict[str, object] = {}
        for alias in ("custom_variables", "customVariables"):
            raw_custom = payload.get(alias)
            if isinstance(raw_custom, dict):
                custom_variables = _normalize_json_value(raw_custom) or {}
                break

        instance.custom_variables = custom_variables if isinstance(custom_variables, dict) else {}

        extras: Dict[str, object] = {}
        for key, value in payload.items():
            if not isinstance(key, str):
                continue
            normalized_key = key.strip()
            if not normalized_key:
                continue
            if normalized_key in base_keys:
                continue
            if normalized_key in ("custom_variables", "customVariables"):
                continue
            extras[normalized_key] = _normalize_json_value(value)

        instance.extra_fields = extras
        return instance

    def to_dict(self) -> Dict[str, object]:
        payload = {
            "scenario_title": self.title,
            "scenario_summary": self.summary,
            "student_role": self.student_role,
            "student_company": self.student_company,
            "ai_role": self.ai_role,
            "ai_company": self.ai_company,
            "ai_rules": self.ai_rules,
            "product": self.product,
            "market_landscape": self.market_landscape,
            "timeline": self.timeline,
            "logistics": self.logistics,
            "risks": self.risks,
            "negotiation_targets": self.negotiation_targets,
            "communication_tone": self.communication_tone,
            "checklist": self.checklist,
            "knowledge_points": self.knowledge_points,
            "opening_message": self.opening_message,
        }

        if self.custom_variables:
            payload["custom_variables"] = copy.deepcopy(self.custom_variables)
        if self.extra_fields:
            for key, value in self.extra_fields.items():
                if key not in payload:
                    payload[key] = copy.deepcopy(value)
        return payload

    def ensure_chinese_role(self, trade_role: str) -> None:
        """补齐学生角色中的中国身份描述，符合教学要求。"""
        normalized = self.student_role.strip() if self.student_role else ""
        if "中国" not in normalized:
            normalized = f"中国{normalized}" if normalized else "中国外贸业务代表"

        if trade_role == "seller":
            if not any(keyword in normalized for keyword in ("卖", "出口", "供货", "供应")):
                normalized = f"中国卖家代表（{normalized}）"
        else:
            if not any(keyword in normalized for keyword in ("买", "采购", "进口")):
                normalized = f"中国买家代表（{normalized}）"
        self.student_role = normalized

    def knowledge_points_hint(self) -> str:
        """拼接知识点提示，供生成打分标准使用。"""
        return "、".join(self.knowledge_points) or "Negotiation strategy, Cross-cultural communication"
