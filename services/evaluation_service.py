"""学习表现评估相关的业务逻辑。"""

from __future__ import annotations

import os
import json
import threading
from typing import Dict, Iterable, List, Optional, Tuple

import logging
import database
from services import embedding_service, graph_service, rag_matcher, reranker_service
from services.document_composer import build_transcript
from services.llm_service import complete_chat
from utils.validators import extract_json_block

LOGGER = logging.getLogger(__name__)

try:
    import numpy as np  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    np = None

_EVAL_RECALL_INDEX: Dict[str, object] = {"model": None, "items": [], "vectors": None, "texts": [], "loaded": False}
_EVAL_RECALL_LOCK = threading.Lock()


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


def _parse_score(raw: str) -> Optional[int]:
    """Best-effort parse score from model output."""
    if not raw:
        return None
    text = raw.strip()
    # Strip markdown fences
    text = text.replace("```json", "").replace("```", "").strip()
    # First, try strict JSON
    try:
        data = json.loads(text)
        if isinstance(data, dict) and "score" in data:
            val = data.get("score")
            if isinstance(val, (int, float)):
                num = int(round(float(val)))
                if 0 <= num <= 100:
                    return num
    except Exception:
        pass
    # Next, try extract JSON block via existing helper
    parsed = extract_json_block(text) or {}
    if isinstance(parsed, dict) and "score" in parsed:
        val = parsed.get("score")
        if isinstance(val, (int, float)):
            num = int(round(float(val)))
            if 0 <= num <= 100:
                return num
    # Finally, regex number fallback
    import re

    match = re.search(r"(-?\d+)", text)
    if match:
        num = int(match.group(1))
        num = max(0, min(100, num))
        return num
    return None


def prepare_evaluation_context(session_id: str, session: Dict[str, object]) -> Dict[str, object]:
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
    return {
        "scenario": scenario,
        "scenarioKnowledge": scenario_knowledge,
        "evaluationPrompt": evaluation_prompt,
        "baseMessages": base_messages,
        "transcript": transcript,
        "lastUser": last_user,
        "lastAi": last_ai,
        "contextText": context_text,
    }


def compute_score(context: Dict[str, object], score_key: Optional[str]) -> Tuple[Dict[str, object], Optional[str]]:
    """Compute score channel only."""
    if not score_key:
        return {}, None
    transcript = context.get("transcript") or ""
    base_messages = context.get("baseMessages") or []
    score_messages = [
        {**base_messages[0], "content": f"{base_messages[0]['content']}\n\n[Policy]\n- 你是严格的评分器，只能返回单个 JSON 对象。\n- 禁止返回 Markdown 代码块、前缀、解释或寒暄。\n- 只允许返回 score 一个字段，取值 0-100 的数字。"},
        {
            "role": "user",
            "content": (
                f"{transcript}\n\n"
                "[Scoring Only]\n"
                "- 仅计算整体得分 (0-100)。\n"
                '- 仅以 JSON 返回：{"score": 分数}。\n'
                "- 不要使用 ```json ``` 代码块或额外文本，不要添加其他字段。"
            ),
        },
    ]
    raw_score = None
    score_data: Dict[str, object] = {}
    try:
        raw_score = complete_chat(
            score_key,
            score_messages,
            temperature=0.35,
            response_format={"type": "json_object"},
        )
        parsed_score = _parse_score(raw_score)
        if parsed_score is not None:
            score_data = {"score": parsed_score}
        else:
            score_data = extract_json_block(raw_score) or {}
    except Exception:
        LOGGER.exception("Score channel failed")
    return score_data, raw_score


def compute_detail(context: Dict[str, object], detail_key: Optional[str]) -> Tuple[Dict[str, object], Optional[str]]:
    if not detail_key:
        return {}, None
    evaluation_prompt = context.get("evaluationPrompt") or ""
    transcript = context.get("transcript") or ""
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
    raw_detail = None
    detail_data: Dict[str, object] = {}
    try:
        raw_detail = complete_chat(
            detail_key,
            detail_messages,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        detail_data = extract_json_block(raw_detail) or {}
    except Exception:
        LOGGER.exception("Detail channel failed")
    return detail_data, raw_detail


def build_evaluation_result(
    ctx: Dict[str, object],
    session: Dict[str, object],
    score_data: Dict[str, object],
    detail_data: Dict[str, object],
    raw_score_response: Optional[str],
    raw_detail_response: Optional[str],
) -> Dict[str, object]:
    scenario = ctx.get("scenario") or {}
    scenario_knowledge = ctx.get("scenarioKnowledge") or []
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

    context_text = ctx.get("contextText") or ""

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
        linked, score_link, best_name = rag_matcher.link_knowledge(candidate, return_score=True)
        match_debug.append(
            {
                "raw": candidate,
                "bestCandidate": best_name or "",
                "score": float(score_link or 0.0),
                "matched": linked or "",
            }
        )
        if linked and linked not in grounded_names:
            grounded_names.append(linked)
    # 若无法对齐到真实图谱（常见于“幻觉/误把词汇项当知识点”），优先回退到场景知识点，避免把 raw 文本直接渲染成知识点 pill。
    if not grounded_names:
        grounded_names = _normalize_names(scenario_knowledge or [])
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
    return {
        "score": score,
        "scoreLabel": score_label,
        "commentary": (detail_data.get("commentary") or detail_data.get("comment") or ""),
        "actionItems": action_items,
        "knowledgePoints": knowledge_points,
        "knowledgePointsGrouped": matched.get("grouped", {}),
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

    # 不再按关卡/场景收窄候选，统一使用全量知识点集合
    # 同时过滤掉“词汇网”节点（lex_role），避免把 lex_item 当作知识点返回到 evaluation-knowledge。
    filtered_candidates = [c for c in (all_candidates or []) if not c.get("lex_role")]
    scoped_candidates = sorted(filtered_candidates, key=lambda n: n.get("name", ""))[:400]

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

        eval_embed_model = _evaluation_embedding_model_name()
        eval_reranker_model = _evaluation_reranker_model_name()

        model = embedding_service.get_model(model_name=eval_embed_model)
        candidate_vecs = []
        if model and candidate_texts:
            try:
                candidate_vecs = embedding_service.embed_texts(candidate_texts, model_name=eval_embed_model)
            except Exception:
                candidate_vecs = []

        reranker = reranker_service.get_model(model_name=eval_reranker_model)

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
            best_type = "KnowledgePoint"
            if model and candidate_vecs:
                try:
                    q_vecs = embedding_service.embed_texts([query], model_name=eval_embed_model)
                    q_vec = q_vecs[0] if q_vecs else []
                except Exception:
                    q_vec = []
                if q_vec and candidate_vecs:
                    embed_scores: List[float] = []
                    for vec in candidate_vecs:
                        embed_scores.append(_cosine_dense(q_vec, vec))

                    if reranker is not None:
                        top_k = min(24, len(embed_scores))
                        top_idx = sorted(range(len(embed_scores)), key=lambda i: embed_scores[i], reverse=True)[:top_k]
                        top_docs = [candidate_texts[i] for i in top_idx]
                        rerank_scores = reranker_service.rerank(query, top_docs, model_name=eval_reranker_model)
                        if rerank_scores and len(rerank_scores) == len(top_idx):
                            best_local = max(range(len(rerank_scores)), key=lambda i: rerank_scores[i])
                            best_global_idx = top_idx[best_local]
                            best_name = card_names[best_global_idx] if best_global_idx < len(card_names) else ""
                            score_best = float(embed_scores[best_global_idx])
                            best_type = (cards[best_global_idx].get("nodeType") or "KnowledgePoint") if best_global_idx < len(cards) else "KnowledgePoint"
                        else:
                            reranker = None

                    if not best_name:
                        best_global_idx = max(range(len(embed_scores)), key=lambda i: embed_scores[i])
                        best_name = card_names[best_global_idx] if best_global_idx < len(card_names) else ""
                        score_best = float(embed_scores[best_global_idx])
                        best_type = (cards[best_global_idx].get("nodeType") or "KnowledgePoint") if best_global_idx < len(cards) else "KnowledgePoint"
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

    ctx = prepare_evaluation_context(session_id, session)

    raw_score_response: Optional[str]
    score_data, raw_score_response = compute_score(ctx, score_key)

    raw_detail_response: Optional[str]
    detail_data, raw_detail_response = compute_detail(ctx, detail_key)

    result = build_evaluation_result(
        ctx,
        session,
        score_data,
        detail_data,
        raw_score_response,
        raw_detail_response,
    )

    database.save_evaluation(session_id, result)
    if session.get("assignment_id"):
        database.mark_assignment_completed_by_session(session_id)
    return result


def _evaluation_embedding_model_name() -> str:
    return os.getenv("EVALUATION_EMBEDDING_MODEL_NAME") or "BAAI/bge-m3"


def _evaluation_reranker_model_name() -> str:
    return os.getenv("EVALUATION_RERANKER_MODEL_NAME") or os.getenv("RERANKER_MODEL_NAME") or "BAAI/bge-reranker-v2-m3"


def recall_knowledge_points_from_context(
    ctx: Dict[str, object],
    *,
    limit: int = 8,
    rerank_top_k: int = 24,
    min_score: float = 0.35,
) -> List[Dict[str, object]]:
    """Fast, local knowledge-point recall from transcript/context (no LLM needed).

    - Uses in-memory embeddings (BGE-M3 by default) + optional reranker.
    - Filters out lexical-network nodes via `lex_role`.
    """

    if limit <= 0:
        return []

    scenario = ctx.get("scenario") or {}
    scenario_text = scenario.get("scenario_summary") or scenario.get("description") or scenario.get("scenario_title") or ""
    query = "\n".join(
        filter(
            None,
            [
                (ctx.get("lastUser") or "").strip(),
                (ctx.get("lastAi") or "").strip(),
                (ctx.get("contextText") or "").strip(),
                (ctx.get("transcript") or "").strip(),
                (scenario_text or "").strip(),
            ],
        )
    ).strip()
    if not query:
        return []

    model_name = _evaluation_embedding_model_name()
    reranker_name = _evaluation_reranker_model_name()

    def _node_to_payload(node: Dict[str, object], score: float) -> Dict[str, object]:
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

    # Build/refresh cached candidate vectors once per process per model.
    with _EVAL_RECALL_LOCK:
        cache_model = _EVAL_RECALL_INDEX.get("model")
        loaded = bool(_EVAL_RECALL_INDEX.get("loaded"))
        if (not loaded) or (cache_model != model_name):
            try:
                all_candidates = graph_service.list_knowledge_points()
            except Exception:
                all_candidates = []

            filtered = [c for c in (all_candidates or []) if not c.get("lex_role")]
            # Keep it bounded for speed; recall is best-effort and runs every user turn.
            filtered = sorted(filtered, key=lambda n: n.get("name", ""))[:800]

            texts: List[str] = []
            for node in filtered:
                parts = [
                    node.get("name") or "",
                    node.get("summary") or "",
                    node.get("bodyHtml") or "",
                    node.get("category") or "",
                    node.get("topic") or "",
                ]
                texts.append(" ".join([p for p in parts if p])[:900])

            vectors = []
            if texts:
                vectors = embedding_service.embed_texts(texts, model_name=model_name)

            dense = None
            if vectors and np is not None:
                dense = np.array(vectors, dtype=np.float32)
                dense = np.nan_to_num(dense, nan=0.0, posinf=0.0, neginf=0.0)

            _EVAL_RECALL_INDEX["model"] = model_name
            _EVAL_RECALL_INDEX["items"] = filtered
            _EVAL_RECALL_INDEX["texts"] = texts
            _EVAL_RECALL_INDEX["vectors"] = dense
            _EVAL_RECALL_INDEX["loaded"] = True

    items: List[Dict[str, object]] = _EVAL_RECALL_INDEX.get("items") or []
    texts = _EVAL_RECALL_INDEX.get("texts") or []
    matrix = _EVAL_RECALL_INDEX.get("vectors")
    if not items or not texts or matrix is None or np is None:
        return []

    q_vecs = embedding_service.embed_texts([query], model_name=model_name)
    if not q_vecs:
        return []
    q = np.array(q_vecs[0], dtype=np.float32)
    q = np.nan_to_num(q, nan=0.0, posinf=0.0, neginf=0.0)
    if q.size == 0:
        return []

    try:
        with np.errstate(all="ignore"):
            scores = np.dot(matrix, q)  # normalized embeddings => cosine
        scores = np.nan_to_num(scores, nan=0.0, posinf=0.0, neginf=0.0)
    except Exception:
        return []

    if scores.size == 0:
        return []

    # Candidate shortlist by embedding score.
    shortlist_k = min(max(rerank_top_k, limit), int(scores.size))
    top_idx = np.argsort(-scores)[:shortlist_k].tolist()

    # Optional rerank within shortlist.
    rerank_model = reranker_service.get_model(model_name=reranker_name)
    order_idx = top_idx
    if rerank_model is not None:
        top_docs = [texts[int(i)] for i in top_idx]
        rerank_scores = reranker_service.rerank(query, top_docs, model_name=reranker_name)
        if rerank_scores and len(rerank_scores) == len(top_idx):
            order_idx = [top_idx[i] for i in sorted(range(len(top_idx)), key=lambda j: rerank_scores[j], reverse=True)]

    results: List[Dict[str, object]] = []
    seen: set[str] = set()
    for idx in order_idx:
        idx_int = int(idx)
        score = float(scores[idx_int]) if idx_int < len(scores) else 0.0
        if score < float(min_score):
            continue
        node = items[idx_int] if idx_int < len(items) else None
        if not node:
            continue
        name = (node.get("name") or "").strip()
        if not name or name in seen:
            continue
        seen.add(name)
        results.append(_node_to_payload(node, score))
        if len(results) >= limit:
            break
    return results
