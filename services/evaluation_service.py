"""学习表现评估相关的业务逻辑。"""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Set

import database
from services import graph_service, rag_matcher
from services.document_composer import build_transcript
from services.llm_service import complete_chat
from utils.validators import MissingKeyError, extract_json_block, require_key


def _normalize_names(candidates: Iterable[object]) -> List[str]:
    normalized: List[str] = []
    for item in candidates or []:
        if item is None:
            continue
        if isinstance(item, dict):
            name = item.get("name") or item.get("title") or item.get("label") or item.get("id")
        else:
            name = str(item)
        name = (name or "").strip()
        if name and name not in normalized:
            normalized.append(name)
    return normalized


def _match_to_existing_knowledge(
    names: Iterable[object],
    *,
    limit: int = 8,
    use_rag: bool = False,
) -> Dict[str, List[str]]:
    """Map model-suggested names to existing graph nodes; group by nodeType."""

    normalized = _normalize_names(names)
    if not normalized:
        return {"KnowledgePoint": [], "Skill": [], "Terminology": []}

    try:
        candidates = graph_service.list_knowledge_points()
    except Exception:
        return {"KnowledgePoint": normalized[:limit], "Skill": [], "Terminology": []}

    name_to_node: Dict[str, Dict[str, object]] = {}
    lower_index: Dict[str, str] = {}
    for node in candidates:
        nm = (node.get("name") or "").strip()
        if not nm:
            continue
        name_to_node[nm] = node
        lower_index[nm.lower()] = nm

    matched: Dict[str, List[str]] = {"KnowledgePoint": [], "Skill": [], "Terminology": []}
    unmatched: List[str] = []

    for target in normalized:
        key = target.lower()
        existing_name = lower_index.get(key)
        if existing_name:
            node = name_to_node.get(existing_name, {})
            node_type = node.get("nodeType") or "KnowledgePoint"
            matched.setdefault(node_type, []).append(existing_name)
        else:
            unmatched.append(target)

    # 轻量模糊匹配（仅少量未命中才启用，避免性能开销）
    if use_rag and unmatched:
        cards = []
        for node in candidates:
            cards.append(
                {
                    "name": node.get("name"),
                    "summary": node.get("summary"),
                    "bodyHtml": node.get("bodyHtml"),
                    "content": node.get("bodyHtml") or node.get("summary") or "",
                    "nodeType": node.get("nodeType") or "KnowledgePoint",
                }
            )
        for target in unmatched:
            best, score, _ = rag_matcher.match(target, cards)
            if best and score >= 0.35:
                node_type = best.get("nodeType") or "KnowledgePoint"
                name = best.get("name")
                if name:
                    matched.setdefault(node_type, [])
                    if name not in matched[node_type]:
                        matched[node_type].append(name)

    # 限制总量，优先保留已有精确匹配
    for key, items in matched.items():
        matched[key] = items[:limit]

    return matched


def evaluate_session(session_id: str, session: Dict[str, object]) -> Dict[str, object]:
    try:
        critic_key = require_key("DEEPSEEK_CRITIC_KEY")
    except MissingKeyError:
        scenario = session.get("scenario", {}) if session else {}
        return {
            "score": None,
            "scoreLabel": None,
            "commentary": "未配置批判評估 API Key。",
            "actionItems": [],
            "knowledgePoints": scenario.get("knowledge_points", []) or [],
            "bargainingWinRate": None,
        }

    scenario = session.get("scenario", {})
    scenario_knowledge = scenario.get("knowledge_points", []) or []
    history_rows = database.get_messages(session_id)
    transcript_history = [
        {"role": row["role"], "content": row["content"]} for row in history_rows
    ]
    transcript = build_transcript(transcript_history, scenario)
    evaluation_prompt = session.get("evaluation_prompt", "")

    messages = [
        {"role": "system", "content": str(evaluation_prompt)},
        {
            "role": "user",
            "content": transcript,
        },
    ]

    try:
        raw = complete_chat(critic_key, messages, temperature=0.2)
        data = extract_json_block(raw)
    except Exception:  # pragma: no cover - 容忍评估失败
        return {
            "score": None,
            "scoreLabel": None,
            "commentary": "評估暫時無法提供，請稍後再試。",
            "actionItems": [],
            "knowledgePoints": scenario_knowledge,
            "bargainingWinRate": None,
        }

    score = data.get("score")
    score_label = data.get("score_label")
    action_items = data.get("action_items", []) or []
    knowledge_points_raw = data.get("knowledge_points", []) or scenario_knowledge
    if not isinstance(action_items, list):
        action_items = [action_items]
    if not isinstance(knowledge_points_raw, list):
        knowledge_points_raw = [knowledge_points_raw] if knowledge_points_raw else []
    bargaining_win_rate = data.get("bargaining_win_rate") if session.get("expects_bargaining") else None

    # 将模型返回的知识点映射到真实图谱节点，并按类型分组
    matched = _match_to_existing_knowledge(knowledge_points_raw, limit=8, use_rag=False)
    knowledge_points = (
        matched.get("KnowledgePoint", [])
        + matched.get("Skill", [])
        + matched.get("Terminology", [])
    )

    result = {
        "score": score,
        "scoreLabel": score_label,
        "commentary": data.get("commentary", ""),
        "actionItems": action_items,
        "knowledgePoints": knowledge_points,
        "knowledgePointsGrouped": matched,  # 便于前端分栏展示
        "bargainingWinRate": bargaining_win_rate,
    }

    database.save_evaluation(session_id, result)
    if session.get("assignment_id"):
        database.mark_assignment_completed_by_session(session_id)
    return result
