"""谈判场景相关的数据模型。"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

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

    @classmethod
    def from_dict(cls, payload: Dict[str, object]) -> "Scenario":
        """从多来源数据中恢复场景，并自动做基础清洗。"""
        return cls(
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

    def to_dict(self) -> Dict[str, object]:
        return {
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
