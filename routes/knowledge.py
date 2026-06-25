"""知识点讲解与推荐接口。"""

from __future__ import annotations

import os
import re
from typing import Dict, List
from datetime import datetime

from flask import Blueprint, Response, jsonify, request, stream_with_context

import database
from services import graph_service, llm_service
from services.graph_service import GraphUnavailableError
from services.auth_service import require_role
from services.lesson_graph_service import build_lesson_network_view, build_lesson_subgraph
from database import get_theory_lesson

bp = Blueprint("knowledge", __name__)


def _get_lesson_text(lesson_id: str) -> str:
  lesson = database.get_theory_lesson(lesson_id, include_unpublished=False)
  if not lesson:
    return ""
  html = lesson.get("contentHtml") or ""
  return re.sub(r"<[^>]+>", " ", html)


@bp.post("/api/knowledge/explain")
@require_role()
def explain_knowledge():
  payload = request.get_json() or {}
  name = (payload.get("name") or "").strip()
  lesson_id = payload.get("lessonId")
  context = payload.get("context") or ""
  if not name:
    return jsonify({"error": "缺少知识点名称"}), 400

  try:
    lesson_text = context or _get_lesson_text(lesson_id)
    prereq_map = graph_service.get_knowledge_prerequisite_map()
    knowledge_detail = graph_service.get_knowledge_point(name)
  except GraphUnavailableError:
    lesson_text = context or ""
    prereq_map = {}
    knowledge_detail = {}
  except graph_service.GraphEntityNotFoundError:
    knowledge_detail = {}

  system_prompt = (
    "你是一名拥有20年经验的外贸谈判专家兼导师，现在作为一本互动式电子教材的智能助手。"
    "你的唯一使命是用最易懂的方式，帮助学生理解教材中的任何知识点。\n"
    "严格遵守：\n"
    "1. 人格化与鼓励性：语言亲切、耐心、充满鼓励。\n"
    "2. 针对性：只围绕当前知识点解释，可结合相关知识点，否则不要扩展。\n"
    "3. 费曼式讲解法，符合维果斯基的脚手架理论，包括以下步骤，但不要像八股文那样按部就班——坚决不要“第一步”、‘第二步’、‘第三步’，应该是自然而然地，需要像一个真人讲解：\n"
    "   - 第一步：下定义：用一句话大白话解释这个知识点是什么。\n"
    "   - 第二步：举例子：给一个真实的外贸谈判场景例子，说明怎么用。\n"
    "   - 第三步：说原因：解释为什么要这样做，指出商业逻辑或常见误区。\n"
    "4. 语言风格：口语化，避免复杂术语；如必须使用术语，用括号标注白话解释。\n"
    "5. 不要打招呼，不要向用户提问或提出请求，只输出讲解内容。\n"
  )

  user_prompt = f"知识点：{name}\n"
  if prereq_map.get(name):
    user_prompt += f"相关前置：{', '.join(prereq_map.get(name, []))}\n"
  if knowledge_detail.get("bloom_level"):
    user_prompt += f"认知层级：{knowledge_detail.get('bloom_level')}\n"
  if knowledge_detail.get("culture_tags"):
    user_prompt += f"跨文化标签：{', '.join(knowledge_detail.get('culture_tags', []))}\n"
  if knowledge_detail.get("civic_tags"):
    user_prompt += f"思政映射：{', '.join(knowledge_detail.get('civic_tags', []))}\n"
  if knowledge_detail.get("teaching_objective"):
    user_prompt += f"教学目标：{knowledge_detail.get('teaching_objective')}\n"
  if lesson_text:
    user_prompt += f"课文上下文：{lesson_text[:2000]}\n"

  api_key = os.getenv("DEEPSEEK_LECTURE_API_KEY") or os.getenv("DEEPSEEK_API_KEY")
  if not api_key:
    return jsonify({"error": "缺少大模型 API key"}), 500

  def _generate():
    try:
      for chunk in llm_service.stream_chat(
        api_key,
        [
          {"role": "system", "content": system_prompt},
          {"role": "user", "content": user_prompt},
        ],
        temperature=0.4,
      ):
        yield chunk
    except Exception as exc:  # pragma: no cover
      yield f"[ERROR]{str(exc)}"

  return Response(stream_with_context(_generate()), mimetype="text/plain")


@bp.get("/api/knowledge/practice-recs")
@require_role()
def recommend_practices():
  name = (request.args.get("name") or "").strip()
  limit = int(request.args.get("limit") or 5)
  if not name:
    return jsonify({"practices": []})
  try:
    practices = graph_service.get_practices_for_kp(name, limit=limit)
  except GraphUnavailableError:
    practices = []
  return jsonify({"practices": practices})


@bp.get("/api/graph/lesson-subgraph")
@require_role()
def lesson_subgraph():
  lesson_id = request.args.get("lessonId", "").strip()
  if not lesson_id:
    return jsonify({"error": "lessonId is required"}), 400
  try:
    cached = graph_service.get_cached_lesson_graph_payload(lesson_id) or {}
    payload = cached.get("subgraph")
    if not payload:
      payload = build_lesson_subgraph(lesson_id)
      # 缓存缺失时仅用图谱数据，不触发检测
      try:
        graph_service.cache_lesson_graph_payload(
          lesson_id,
          {
            "lessonId": lesson_id,
            "subgraph": payload,
            "network": cached.get("network"),
            "knowledgePoints": cached.get("knowledgePoints"),
            "updatedAt": datetime.utcnow().isoformat() + "Z",
          },
        )
      except Exception:
        pass
    return jsonify(payload)
  except GraphUnavailableError:
    return jsonify({"error": "Graph unavailable"}), 503
  except graph_service.GraphEntityNotFoundError:
    return jsonify({"nodes": [], "edges": [], "highlights": []})


@bp.get("/api/graph/lesson-network")
@require_role()
def lesson_network():
  lesson_id = request.args.get("lessonId", "").strip()
  limit = int(request.args.get("limit") or 800)
  if not lesson_id:
    return jsonify({"error": "lessonId is required"}), 400
  try:
    cached = graph_service.get_cached_lesson_graph_payload(lesson_id) or {}
    if cached.get("network"):
      return jsonify(cached["network"])

    detail = graph_service.get_lesson_detail(lesson_id)
    highlight = { (kp.get("name") or "").strip() for kp in detail.get("knowledgePoints") or [] if kp.get("name") }
    snapshot = graph_service.fetch_graph_snapshot(limit=limit)
    payload = build_lesson_network_view(
      lesson_id,
      snapshot=snapshot,
      highlight_names=highlight,
      limit=limit,
    )
    try:
      graph_service.cache_lesson_graph_payload(
        lesson_id,
        {
          "lessonId": lesson_id,
          "subgraph": cached.get("subgraph"),
          "network": payload,
          "knowledgePoints": list(highlight),
          "updatedAt": datetime.utcnow().isoformat() + "Z",
        },
      )
    except Exception:
      pass
    return jsonify(payload)
  except GraphUnavailableError:
    return jsonify({"error": "Graph unavailable"}), 503
  except graph_service.GraphEntityNotFoundError:
    return jsonify({"nodes": [], "edges": [], "highlights": []})
