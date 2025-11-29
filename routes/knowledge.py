"""知识点讲解与推荐接口。"""

from __future__ import annotations

import os
import re
from typing import Dict, List

from flask import Blueprint, Response, jsonify, request, stream_with_context

import database
from services import graph_service, llm_service
from services.graph_service import GraphUnavailableError
from services.auth_service import require_role
from services.lesson_graph_service import build_lesson_subgraph
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
  except GraphUnavailableError:
    lesson_text = context or ""
    prereq_map = {}

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
    payload = build_lesson_subgraph(lesson_id)
    return jsonify(payload)
  except GraphUnavailableError:
    return jsonify({"error": "Graph unavailable"}), 503


@bp.get("/api/graph/lesson-network")
@require_role()
def lesson_network():
  lesson_id = request.args.get("lessonId", "").strip()
  limit = int(request.args.get("limit") or 800)
  if not lesson_id:
    return jsonify({"error": "lessonId is required"}), 400
  try:
    detail = graph_service.get_lesson_detail(lesson_id)
    lesson_record = get_theory_lesson(lesson_id, include_unpublished=False)
    html = lesson_record.get("contentHtml") if lesson_record else ""
    detected = graph_service.detect_knowledge_points_in_text(html)
    highlight = set()
    for kp in detail.get("knowledgePoints") or []:
      name = (kp.get("name") or "").strip()
      if name:
        highlight.add(name)
    for kp in detected:
      name = (kp.get("name") or "").strip()
      if name:
        highlight.add(name)
    snapshot = graph_service.fetch_graph_snapshot(limit=limit)
    nodes_raw = snapshot.get("nodes") or []
    edges_raw = snapshot.get("edges") or []

    allowed_labels = {
      "Stage",
      "Topic",
      "KnowledgeCategory",
      "KnowledgePoint",
      "Skill",
      "Terminology",
      "Practice",
      "ProcessStep",
    }

    def _node_id(node: dict) -> str:
      for key in ("id", "key", "name", "title"):
        val = node.get(key)
        if val:
          return str(val)
      return ""

    def _node_label(node: dict) -> str:
      lbl = node.get("label") or node.get("nodeType")
      if lbl:
        return lbl
      lbls = node.get("labels") or []
      if isinstance(lbls, list):
        for candidate in lbls:
          if candidate in allowed_labels:
            return candidate
      return ""

    # 过滤节点类型
    filtered_nodes = []
    id_to_node = {}
    for n in nodes_raw:
      label = _node_label(n)
      nid = _node_id(n)
      if not nid or label not in allowed_labels:
        continue
      node_copy = dict(n)
      node_copy["nodeType"] = label  # 保存类型
      node_copy["id"] = nid  # 确保有id
      display = n.get("title") or n.get("name") or n.get("id") or n.get("key") or label
      node_copy["label"] = display  # 用于前端展示
      node_copy["name"] = display
      id_to_node[nid] = node_copy
      filtered_nodes.append(node_copy)

    # 过滤边到有效节点
    filtered_edges = []
    for e in edges_raw:
      src = str(e.get("source") or e.get("from") or "")
      tgt = str(e.get("target") or e.get("to") or "")
      if src in id_to_node and tgt in id_to_node:
        edge_copy = dict(e)
        edge_copy["source"] = src
        edge_copy["target"] = tgt
        filtered_edges.append(edge_copy)

    # 高亮 id
    highlight_ids = set()
    for nid in highlight:
      if nid in id_to_node:
        highlight_ids.add(nid)
      else:
        # 尝试按 name/title 匹配
        for candidate_id, node in id_to_node.items():
          if (node.get("name") or node.get("title") or "") == nid:
            highlight_ids.add(candidate_id)

    # 扩大上下文（与高亮点相连的节点，最多 2 层）；若无高亮，保留全部 Stage 以便全局视角
    kept = set(highlight_ids)
    if not kept:
      stage_ids = [nid for nid, n in id_to_node.items() if n.get("nodeType") == "Stage"]
      kept.update(stage_ids)
    for _ in range(2):
      new_nodes = set()
      for e in filtered_edges:
        s = e.get("source")
        t = e.get("target")
        if s in kept or t in kept:
          new_nodes.add(s)
          new_nodes.add(t)
      kept.update(new_nodes)

    # 如果依然只有少量节点，增加前 N 个 Stage 作为背景
    if len(kept) < 10:
      stage_ids = [nid for nid, n in id_to_node.items() if n.get("nodeType") == "Stage"]
      kept.update(stage_ids[:10])

    nodes_final = [id_to_node[nid] for nid in kept if nid in id_to_node]
    edges_final = [e for e in filtered_edges if e.get("source") in kept and e.get("target") in kept]

    payload = {
      "nodes": nodes_final,
      "edges": edges_final,
      "highlights": list(highlight_ids),
    }
    return jsonify(payload)
  except GraphUnavailableError:
    return jsonify({"error": "Graph unavailable"}), 503
