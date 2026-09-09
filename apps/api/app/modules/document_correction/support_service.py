from __future__ import annotations

from typing import Any

from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.knowledge_graph.base import GraphStore
from app.modules.document_correction.annotation_service import AnnotationService
from app.modules.document_correction.grading_rules import targets
from app.modules.document_correction.profile_service import error
from app.modules.document_correction.schemas import StrictModel
from app.modules.knowledge_graph.consumption_service import KnowledgeGraphConsumptionService
from app.modules.knowledge_graph.models import KnowledgeScaffoldInteraction
from app.modules.training.models import Attempt


class HintInput(StrictModel):
    target_ref: str = Field(max_length=120)
    level: int = Field(ge=1, le=3)
    event_type: str = "revealed"


def hint(db: Session, graph_store: GraphStore, attempt: Attempt, data: HintInput) -> dict[str, Any]:
    session = AnnotationService(db).session(attempt.id)
    by_ref = targets(session.document_snapshot)
    if data.target_ref != "overview" and data.target_ref not in by_ref:
        raise error("target_invalid", "未找到所选字段。", 422)
    if data.event_type not in {"revealed", "used"}:
        raise error("hint_event_invalid", "提示事件无效。", 422)
    group = "主体、金额、装运安排、单据和期限关系"
    if data.target_ref in {"mt700-43p", "mt700-43t", "mt700-44c"}:
        group = "5-2确认的装运安排和收证起算日期"
    text = f"请核对{group}。"
    if data.level == 2:
        text = "把43P与43T分别核对；再比较44C、31D和48，装运日、有效期与交单期应相互协调。"
    if data.level == 3:
        issue = next(
            (i for i in session.answer_snapshot["issues"] if i["target_ref"] == data.target_ref),
            None,
        )
        text = (
            "当前字段存在需要复核的风险，请对照相应合同事实拟定修改。"
            if issue
            else "请重新核对当前字段及其合同依据；仅有疑问不等于必然存在不符点。"
        )
    graph_version = attempt.content_bindings.get("knowledge_graph_version", "unavailable")
    recommendations = []
    try:
        graph = KnowledgeGraphConsumptionService(db, graph_store).graph_for_attempt(attempt)
        graph_version = graph.graph_version
        # Only published graph candidates are exposed. Never fabricate node IDs.
        recommendations = [
            {"id": str(n["stable_key"]), "title": str(n.get("title", n.get("name", "")))}
            for n in graph.nodes
            if any(
                term in str(n.get("title", n.get("name", "")))
                for term in ["信用证", "交单", "转船", "单证"]
            )
        ][:5]
    except Exception:
        # Optional graph availability cannot interrupt editing or local dictionary support.
        recommendations = []
    key = f"lc:{attempt.id}:{data.target_ref}:{data.level}:{data.event_type}"
    existing = db.scalar(
        select(KnowledgeScaffoldInteraction).where(
            KnowledgeScaffoldInteraction.student_id == attempt.student_id,
            KnowledgeScaffoldInteraction.client_event_id == key,
        )
    )
    snapshot = {
        "text": text,
        "target_ref": data.target_ref,
        "level": data.level,
        "answer_revealed": False,
    }
    if not existing:
        db.add(
            KnowledgeScaffoldInteraction(
                attempt_id=attempt.id,
                student_id=attempt.student_id,
                graph_version=graph_version,
                scaffold_node_key="lc-field-method-v1",
                event_type=data.event_type,
                level=str(data.level),
                client_event_id=key,
                scaffold_snapshot=snapshot,
            )
        )
        db.commit()
    return {**snapshot, "graph_version": graph_version, "recommendations": recommendations}
