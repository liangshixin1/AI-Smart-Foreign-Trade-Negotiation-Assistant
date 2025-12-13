"""学习表现评估相关的业务逻辑。"""

from __future__ import annotations

import os
from typing import Dict, Iterable, List, Optional, Set

import logging
import database
from services import embedding_service, graph_service, rag_matcher
from services.document_composer import build_transcript
from services.llm_service import complete_chat
from utils.validators import extract_json_block

LOGGER = logging.getLogger(__name__)


def _score_to_label(score: Optional[object]) -> Optional[str]:
    """Map numeric score to a short label locally."""
    try:
        val = float(score) if score is not None else None
    except Exception:
        return None
    if val is None:
        return None
    if val >= 90:
        return "Excellent"
    if val >= 75:
        return "Good"
    if val >= 60:
        return "Adequate"
    return "Needs Improvement"


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
    context_text: Optional[str] = None,
    section_id: Optional[str] = None,
    chapter_id: Optional[str] = None,
    scenario_hint: Optional[Dict[str, object]] = None,
) -> Dict[str, object]:
    """Map model-suggested names to existing graph nodes; return grouped + flat list."""

    def _placeholder_payload() -> Dict[str, object]:
        return {
            "label": "暂未匹配到知识点",
            "name": "暂未匹配到知识点",
            "summary": "",
            "category": "KnowledgePoint",
            "matchScore": 0.0,
        }

    normalized = _normalize_names(names)
    if not normalized:
        placeholder = _placeholder_payload()
        empty = {"KnowledgePoint": [placeholder], "Skill": [], "Terminology": []}
        return {"grouped": empty, "flat": [placeholder]}

    try:
        all_candidates = graph_service.list_knowledge_points()
    except Exception:
        minimal = [
            {"label": name, "name": name, "summary": "", "category": "KnowledgePoint", "matchScore": 1.0}
            for name in normalized[:limit]
        ]
        grouped = {"KnowledgePoint": minimal, "Skill": [], "Terminology": []}
        return {"grouped": grouped, "flat": minimal}

    # 候选集优先使用当前关卡/章节/场景范围，减少向量计算规模
    scoped_names: Set[str] = set()
    if section_id:
        try:
            practice_recs = graph_service.get_practice_knowledge_recommendations(section_id)
            scoped_names.update(practice_recs.get("existing", []))
            scoped_names.update(practice_recs.get("recommended", []))
        except Exception:
            pass
    if scenario_hint:
        scoped_names.update(_normalize_names(scenario_hint.get("knowledge_points") or []))
    if chapter_id:
        # 章级别暂用 practice 预设 + 全局，避免额外查询
        pass
    scoped_candidates = (
        [node for node in all_candidates if (node.get("name") or "") in scoped_names]
        if scoped_names
        else all_candidates
    )
    # 限制向量候选数量，按名称排序保持稳定
    scoped_candidates = sorted(scoped_candidates, key=lambda n: n.get("name", ""))[:400]

    name_to_node: Dict[str, Dict[str, object]] = {}
    lower_index: Dict[str, str] = {}
    for node in scoped_candidates:
        nm = (node.get("name") or "").strip()
        if not nm:
            continue
        name_to_node[nm] = node
        lower_index[nm.lower()] = nm

    matched: Dict[str, List[Dict[str, object]]] = {"KnowledgePoint": [], "Skill": [], "Terminology": []}
    unmatched: List[str] = []

    def _node_to_payload(node: Dict[str, object], score: float = 1.0) -> Dict[str, object]:
        category = node.get("category") or node.get("nodeType") or "KnowledgePoint"
        return {
            "label": node.get("name") or "",
            "name": node.get("name") or "",
            "summary": node.get("summary") or "",
            "category": category,
            "nodeType": node.get("nodeType") or category,
            "knowledgeId": node.get("knowledgeId"),
            "graphNodeId": node.get("nodeId"),
            "topic": node.get("topic"),
            "lessonCount": node.get("lessonCount"),
            "practiceCount": node.get("practiceCount"),
            "matchScore": float(score) if score is not None else 0.0,
        }

    for target in normalized:
        key = target.lower()
        existing_name = lower_index.get(key)
        if existing_name:
            node = name_to_node.get(existing_name, {})
            node_type = node.get("nodeType") or "KnowledgePoint"
            payload = _node_to_payload(node, 1.0)
            matched.setdefault(node_type, [])
            if not any(item.get("name") == payload["name"] for item in matched[node_type]):
                matched[node_type].append(payload)
        else:
            unmatched.append(target)

    # 轻量模糊匹配（仅少量未命中才启用，避免性能开销）
    if use_rag and unmatched:
        fuzzy_candidates = scoped_candidates
        if scoped_names and len(unmatched) and scoped_candidates != all_candidates:
            # 初筛未命中时扩大候选范围，避免因范围过窄遗漏真实节点
            fuzzy_candidates = sorted(all_candidates, key=lambda n: n.get("name", ""))[:400]
        cards = []
        candidate_texts: List[str] = []
        card_names: List[str] = []
        for node in fuzzy_candidates:
            text_parts = [
                node.get("name") or "",
                node.get("summary") or "",
                node.get("bodyHtml") or "",
            ]
            cards.append(
                {
                    "name": node.get("name"),
                    "nodeType": node.get("nodeType") or "KnowledgePoint",
                }
            )
            card_names.append(node.get("name") or "")
            candidate_texts.append(" ".join(text_parts)[:600])

        model = embedding_service.get_model()
        candidate_vecs = []
        if model and candidate_texts:
            try:
                candidate_vecs = embedding_service.embed_texts(candidate_texts)
            except Exception:
                candidate_vecs = []

        def _cosine_dense(a: List[float], b: List[float]) -> float:
            if not a or not b or len(a) != len(b):
                return 0.0
            dot = sum(x * y for x, y in zip(a, b))
            na = sum(x * x for x in a) ** 0.5
            nb = sum(y * y for y in b) ** 0.5
            return dot / (na * nb) if na and nb else 0.0

        for target in unmatched:
            query = " ".join(
                filter(None, [target, context_text or ""])
            )[:600]
            score_best = 0.0
            best_name = ""
            if model and candidate_vecs:
                try:
                    q_vec = embedding_service.embed_texts([query])[0]
                except Exception:
                    q_vec = []
                if q_vec:
                    for name, vec, card in zip(card_names, candidate_vecs, cards):
                        score = _cosine_dense(q_vec, vec)
                        if score > score_best:
                            score_best = score
                            best_name = name
                            best_type = card.get("nodeType") or "KnowledgePoint"
            else:
                best, score, _ = rag_matcher.match(query, cards)
                best_name = (best or {}).get("name") or ""
                score_best = score or 0.0
                best_type = (best or {}).get("nodeType") or "KnowledgePoint"

            if best_name and score_best >= 0.35:
                matched.setdefault(best_type, [])
                payload = _node_to_payload(name_to_node.get(best_name, {}), score_best)
                if not any(item.get("name") == payload["name"] for item in matched[best_type]):
                    matched[best_type].append(payload)
            # 若未找到高于阈值的匹配，则忽略该名称，避免保留大模型原始输出

    # 限制总量，优先保留已有精确匹配
    for key, items in matched.items():
        matched[key] = items[:limit]

    flat: List[Dict[str, object]] = []
    for key, items in matched.items():
        flat.extend(items)

    if not flat:
        placeholder = _placeholder_payload()
        matched = {"KnowledgePoint": [placeholder], "Skill": [], "Terminology": []}
        flat = [placeholder]

    return {"grouped": matched, "flat": flat}


def evaluate_session(session_id: str, session: Dict[str, object]) -> Dict[str, object]:
    score_key = os.getenv("DEEPSEEK_CRITIC_SCORE_KEY") or os.getenv("DEEPSEEK_CRITIC_KEY")
    detail_key = os.getenv("DEEPSEEK_CRITIC_DETAIL_KEY") or os.getenv("DEEPSEEK_CRITIC_KEY")
    if not score_key and not detail_key:
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
    last_user = next((row["content"] for row in reversed(history_rows) if row["role"] == "user"), "")
    last_ai = next((row["content"] for row in reversed(history_rows) if row["role"] == "assistant"), "")
    transcript = build_transcript(transcript_history, scenario)
    evaluation_prompt = session.get("evaluation_prompt", "")
    scenario_mode = (scenario or {}).get("mode") or ""
    if scenario_mode == "email":
        evaluation_prompt = f"{evaluation_prompt}\n\n[Email Mode Focus]\n- 请优先评估邮件格式规范（Subject/Salutation/Closing/Signature）。\n- 检查正文逻辑、礼貌度与条款完整性。\n- 简明指出格式缺失或不当之处。"

    base_messages = [
        {"role": "system", "content": str(evaluation_prompt)},
        {"role": "user", "content": transcript},
    ]

    # 1) 分数通道：只返回 score/score_label
    raw_score_response: Optional[str] = None
    score_data: Dict[str, object] = {}
    if score_key:
        score_messages = [
            {**base_messages[0], "content": f"{base_messages[0]['content']}\n\n[Policy]\n- 你是严格的评分器，只能返回单个 JSON 对象。\n- 禁止返回 Markdown 代码块、前缀、解释或寒暄。\n- 只允许返回 score 一个字段，取值 0-100 的数字。"},
            {
                "role": "user",
                "content": (
                    f"{transcript}\n\n"
                    "[Scoring Only]\n"
                    "- 仅计算整体得分 (0-100)。\n"
                    '- 仅以 JSON 返回：{"score": 75}。\n'
                    "- 不要使用 ```json ``` 代码块或额外文本，不要添加其他字段。"
                ),
            },
        ]
        try:
            raw_score = complete_chat(score_key, score_messages, temperature=0.05)
            raw_score_response = raw_score
            clean_score = raw_score.replace("```json", "").replace("```", "").strip()
            score_data = extract_json_block(clean_score) or {}
        except Exception:
            LOGGER.exception("Score channel failed")

    # 2) 详情通道：评语/行动项/知识点/胜率，不返回分数
    raw_detail_response: Optional[str] = None
    detail_data: Dict[str, object] = {}
    if detail_key:
        detail_prompt = (
            f"{evaluation_prompt}\n\n"
            "[Detail Only]\n"
            "- 请输出评语、行动项、knowledge_points、bargaining_win_rate（如有）。\n"
            "- knowledge_points 的 name/label 必须使用中文图谱名称，可附 summary，避免自定义 category。\n"
            "- 不要返回 score 或 score_label。\n"
            "- 输出 JSON。"
        )
        detail_messages = [
            {"role": "system", "content": detail_prompt},
            {"role": "user", "content": transcript},
        ]
        try:
            raw_detail = complete_chat(detail_key, detail_messages, temperature=0.2)
            raw_detail_response = raw_detail
            detail_data = extract_json_block(raw_detail) or {}
        except Exception:
            LOGGER.exception("Detail channel failed")

    if not score_data and not detail_data:
        return {
            "score": None,
            "scoreLabel": None,
            "commentary": "評估暫時無法提供，請稍後再試。",
            "actionItems": [],
            "knowledgePoints": scenario_knowledge,
            "bargainingWinRate": None,
        }

    score = score_data.get("score")
    score_label = score_data.get("score_label") or score_data.get("scoreLabel")
    action_items = detail_data.get("action_items", []) or []
    knowledge_points_raw = detail_data.get("knowledge_points", []) or scenario_knowledge
    if not isinstance(action_items, list):
        action_items = [action_items]
    if not isinstance(knowledge_points_raw, list):
        knowledge_points_raw = [knowledge_points_raw] if knowledge_points_raw else []
    bargaining_win_rate = detail_data.get("bargaining_win_rate") if session.get("expects_bargaining") else None
    if score is None and detail_data:
        score = detail_data.get("score")
    if score_label is None and detail_data:
        score_label = detail_data.get("score_label") or detail_data.get("scoreLabel")
    # 本地生成等级，避免依赖模型
    if score_label is None:
        score_label = _score_to_label(score)
    highlights = detail_data.get("highlights") or []
    risks = detail_data.get("risks") or detail_data.get("warnings") or []
    suggestions = detail_data.get("suggestions") or detail_data.get("tips") or detail_data.get("action_items") or []
    if not isinstance(highlights, list):
        highlights = [highlights] if highlights else []
    if not isinstance(risks, list):
        risks = [risks] if risks else []
    if not isinstance(suggestions, list):
        suggestions = [suggestions] if suggestions else []

    # 将模型返回的知识点映射到真实图谱节点，并按类型分组
    scenario_text = scenario.get("scenario_summary") or scenario.get("description") or scenario.get("scenario_title") or ""
    context_text = "\n".join(
        filter(
            None,
            [
                f"user: {last_user}" if last_user else "",
                f"assistant: {last_ai}" if last_ai else "",
                scenario_text,
            ],
        )
    )

    # 使用向量索引将模型返回的知识点名称映射到真实图谱节点名称，过滤掉幻觉
    raw_candidates = knowledge_points_raw or scenario_knowledge or []
    LOGGER.info("LLM knowledge_points (raw): %s", raw_candidates)
    grounded_names: List[str] = []
    match_debug: List[Dict[str, object]] = []
    for kp in raw_candidates:
        if isinstance(kp, dict):
            candidate = kp.get("name") or kp.get("label") or kp.get("title") or ""
        else:
            candidate = str(kp) if kp is not None else ""
        linked, score, best_name = rag_matcher.link_knowledge(candidate, return_score=True)
        match_debug.append(
            {
                "raw": candidate,
                "bestCandidate": best_name or "",
                "score": float(score or 0.0),
                "matched": linked or "",
            }
        )
        if linked and linked not in grounded_names:
            grounded_names.append(linked)
    if not grounded_names and raw_candidates:
        grounded_names = _normalize_names(raw_candidates)
    if match_debug:
        LOGGER.info("Knowledge grounding results: %s", match_debug)

    matched = _match_to_existing_knowledge(
        grounded_names,
        limit=8,
        use_rag=True,
        context_text=context_text,
        section_id=session.get("section_id"),
        chapter_id=session.get("chapter_id"),
        scenario_hint=scenario,
    )
    knowledge_points = matched.get("flat", [])
    # 注入 lessonId 便于前端跳转/图谱高亮
    for kp in knowledge_points:
        lessons = scenario.get("lessons") or []
        if not kp.get("lessonId") and lessons:
            kp["lessonId"] = lessons[0].get("id") if isinstance(lessons[0], dict) else lessons[0]

    result = {
        "score": score,
        "scoreLabel": score_label,
        "commentary": (detail_data.get("commentary") or detail_data.get("comment") or ""),
        "actionItems": action_items,
        "knowledgePoints": knowledge_points,
        "knowledgePointsGrouped": matched.get("grouped", {}),  # 便于前端分栏展示
        "bargainingWinRate": bargaining_win_rate,
        "highlights": highlights,
        "risks": risks,
        "suggestions": suggestions,
        "debug": {
            "rawScore": raw_score_response,
            "rawDetail": raw_detail_response,
            "parsedScore": score_data,
            "parsedDetail": detail_data,
        },
    }

    database.save_evaluation(session_id, result)
    if session.get("assignment_id"):
        database.mark_assignment_completed_by_session(session_id)
    return result
