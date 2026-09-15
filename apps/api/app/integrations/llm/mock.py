# [导读] 用途: 为测试和本地演示生成固定形状的场景、对话与评价响应。
# [导读] 为什么: 可预测输出让测试验证业务状态、解析和持久化, 避免依赖网络与模型随机性。
# [导读] 结构: MockLLMProvider、_mock_learning_diagnostic。
# [导读] 提醒: 模拟得分和诊断仅服务测试, 不是实际学生表现, 也不能替代真实模型验收。
from __future__ import annotations

import json
from collections.abc import Iterator

from app.integrations.llm.base import (
    LLMRequest,
    LLMResponse,
    LLMStreamChunk,
    LLMUsage,
)


class MockLLMProvider:
    """Deterministic local provider for tests and interface development."""

    # [导读] 按统一请求协议返回完整模型响应; 调用方仍需校验业务字段, 测试替身也不能被当成真实模
    # [导读] 型结果。
    def complete(self, request: LLMRequest) -> LLMResponse:
        if request.metadata.get("simulation_kind") == "briefing":
            content = json.dumps(
                {
                    "schema_version": "simulation.briefing.v1",
                    "briefing": [
                        {
                            "id": "brief-01",
                            "kind": "narration",
                            "speaker_id": "narrator",
                            "rendered_text": "你走进白天的会谈室，把已经收到的报价单放在桌面上。",
                            "fact_refs": [],
                            "scene_id": "meeting-room-day",
                            "character_id": "david-lim",
                            "expression": "neutral",
                            "action": "none",
                        },
                        {
                            "id": "brief-02",
                            "kind": "narration",
                            "speaker_id": "narrator",
                            "rendered_text": (
                                "今天你代表上海翰霖采购一方，负责提出有依据的价格还盘。"
                            ),
                            "fact_refs": ["student_role"],
                            "scene_id": "meeting-room-day",
                            "character_id": "david-lim",
                            "expression": "neutral",
                            "action": "none",
                        },
                        {
                            "id": "brief-03",
                            "kind": "narration",
                            "speaker_id": "narrator",
                            "rendered_text": "对面的 David Lim 代表 NovaTech 坚守当前报价。",
                            "fact_refs": ["ai_role"],
                            "scene_id": "meeting-room-day",
                            "character_id": "david-lim",
                            "expression": "thinking",
                            "action": "none",
                        },
                        {
                            "id": "brief-04",
                            "kind": "narration",
                            "speaker_id": "narrator",
                            "rendered_text": "本轮围绕 NT-IM250 显示模组的单价与交换条件展开。",
                            "fact_refs": ["product"],
                            "scene_id": "meeting-room-day",
                            "character_id": "david-lim",
                            "expression": "neutral",
                            "action": "none",
                        },
                        {
                            "id": "brief-05",
                            "kind": "narration",
                            "speaker_id": "narrator",
                            "rendered_text": "你的目标是说明还盘依据，并用互惠条件推动下一步。",
                            "fact_refs": ["student_task"],
                            "scene_id": "meeting-room-day",
                            "character_id": "david-lim",
                            "expression": "neutral",
                            "action": "none",
                        },
                    ],
                    "opening": {
                        "beats": [
                            {
                                "id": "opening-01",
                                "kind": "speech",
                                "speaker_id": "david-lim",
                                "text": "Our offer reflects the value of the NT-IM250.",
                                "expression": "neutral",
                                "action": "none",
                            },
                            {
                                "id": "opening-02",
                                "kind": "speech",
                                "speaker_id": "david-lim",
                                "text": "What terms would make this work for your team?",
                                "expression": "thinking",
                                "action": "head_tilt",
                            },
                        ]
                    },
                },
                ensure_ascii=False,
            )
        elif request.purpose == "scenario":
            content = json.dumps(
                {
                    "public": {
                        "scenario_title": "CIF Shanghai 价格还盘",
                        "scenario_summary": "NovaTech 已报盘，买方需要以商业依据争取更优条件。",
                        "student_task": "与卖方完成价格还盘，并通过条件交换推动成交。",
                        "student_role": "上海翰霖采购经理",
                        "ai_role": "NovaTech 出口总监 David Lim",
                        "product": "800 件 NT-IM250，USD 285/件，CIF Shanghai",
                        "negotiation_targets": ["提出有依据的还盘", "至少进行一次条件交换"],
                        "checklist": ["引用数量或市场依据", "确认价格和付款条件"],
                        "opening_message": (
                            "Thank you for your interest. Our offer remains "
                            "USD 285 per unit CIF Shanghai."
                        ),
                    },
                    "private": {
                        "seller_strategy": "守价优先，以数量或付款条件交换让步。",
                        "opening_anchor": "USD 285",
                        "bottom_line_reminder": "不得向学生泄露成本和底线。",
                    },
                },
                ensure_ascii=False,
            )
        elif request.purpose == "conversation":
            if request.metadata.get("simulation_kind") == "turn":
                trust_band = request.metadata.get("trust_band")
                willingness_band = request.metadata.get("willingness_band")
                if trust_band == "cautious":
                    lines = [
                        {
                            "id": "line-01",
                            "kind": "speech",
                            "speaker_id": "david-lim",
                            "text": "Please explain the commercial basis for that proposal.",
                            "expression": "confused",
                            "action": "head_tilt",
                        }
                    ]
                elif trust_band == "positive" and willingness_band == "positive":
                    lines = [
                        {
                            "id": "line-01",
                            "kind": "speech",
                            "speaker_id": "david-lim",
                            "text": (
                                "Let us confirm the remaining payment term and summarize "
                                "our progress."
                            ),
                            "expression": "pleased",
                            "action": "nod",
                        }
                    ]
                else:
                    lines = [
                        {
                            "id": "line-01",
                            "kind": "speech",
                            "speaker_id": "david-lim",
                            "text": "A lower price needs a stronger order commitment.",
                            "expression": "thinking",
                            "action": "head_tilt",
                        },
                        {
                            "id": "line-02",
                            "kind": "speech",
                            "speaker_id": "david-lim",
                            "text": "What volume can your team confirm?",
                            "expression": "neutral",
                            "action": "none",
                        },
                    ]
                content = json.dumps(
                    {
                        "schema_version": "simulation.turn.v1",
                        "beats": lines,
                    }
                )
            else:
                content = (
                    "We appreciate your reasoning. If you can increase the order to 1,000 units "
                    "and accept an irrevocable L/C at sight, we could consider "
                    "USD 282 CIF Shanghai."
                )
        elif request.metadata.get("evaluation_kind") == "round":
            checklist = json.loads(request.metadata.get("checklist_json", "[]"))
            graph_candidates = json.loads(request.metadata.get("graph_candidates_json", "[]"))
            knowledge = [
                item for item in graph_candidates if item.get("node_type") == "knowledge_resource"
            ]
            strategies = [item for item in graph_candidates if item.get("node_type") == "strategy"]
            round_payload = {
                "score": 74,
                "pros": "还盘理由明确，并保持了合作语气。",
                "cons": "交换条件仍不够量化。",
                "detailed_evaluation": (
                    "本轮能够用订单规模支撑目标价，但尚未把数量、付款方式和价格"
                    "组成明确的条件交换方案。"
                ),
                "next_step_suggestion": "下一轮提出增加数量换取明确降价。",
                "checklist_results": [
                    {
                        "item": item,
                        "satisfied": index == 0,
                        "rationale": (
                            "本轮已经给出数量条件作为谈判依据。"
                            if index == 0
                            else "目前尚未同时确认价格和付款条件。"
                        ),
                    }
                    for index, item in enumerate(checklist)
                ],
                "knowledge_recommendations": [
                    {
                        "node_id": item["node_id"],
                        "confidence": 0.88,
                        "reason": "该知识可以直接解释本轮表达中的业务边界。",
                        "reveal_level": 1,
                    }
                    for item in knowledge[:1]
                ],
                "strategy_recommendations": [
                    {
                        "node_id": item["node_id"],
                        "confidence": 0.84,
                        "reason": "该策略与本轮尚未量化的条件交换直接相关。",
                        "reveal_level": 1,
                    }
                    for item in strategies[:1]
                ],
                "learning_diagnostic": _mock_learning_diagnostic(
                    request.metadata.get(
                        "student_message_id", "00000000-0000-0000-0000-000000000000"
                    ),
                    (
                        request.metadata.get("student_message_content", "")
                        if request.metadata.get("experience_mode") == "simulation"
                        else "Could you offer USD 278 if we increase the order?"
                    ),
                ),
            }
            if request.metadata.get("experience_mode") == "simulation":
                student_id = request.metadata.get(
                    "student_message_id", "00000000-0000-0000-0000-000000000000"
                )
                student_content = request.metadata.get("student_message_content", "")
                round_payload["simulation_observation"] = {
                    "schema_version": "simulation.observation.v1",
                    "events": [
                        {
                            "kind": "evidence_backed_proposal",
                            "target_key": "unit_price",
                            "confidence": 0.9,
                            "evidence": [{"message_id": student_id, "quote": student_content}],
                            "reason": "本轮提出了带有订单依据的还盘方案。",
                            "normalized_fact_signature": "order-backed-counteroffer",
                        }
                    ],
                    "term_candidates": [],
                    "milestone_candidates": [
                        {
                            "key": "reasoned_counteroffer",
                            "message_ids": [student_id],
                            "reason": "学生给出了还盘依据。",
                        }
                    ],
                }
            content = json.dumps(round_payload, ensure_ascii=False)
        else:
            message_id = request.metadata.get("evidence_message_id", "missing")
            quote = request.metadata.get("evidence_quote", "")
            dimensions = json.loads(
                request.metadata.get(
                    "rubric_keys",
                    '["correspondence_quality", "professional_accuracy", '
                    '"negotiation_strategy", "objective_achievement", '
                    '"relationship_management"]',
                )
            )
            content = json.dumps(
                {
                    "level": "competent",
                    "summary": "能够提出还盘并保持专业表达，条件交换仍可更具体。",
                    "strengths": ["表达清晰", "保持合作语气"],
                    "improvements": ["量化可交换条件"],
                    "next_actions": ["下一轮同时绑定数量、价格与付款条件"],
                    "dimensions": [
                        {
                            "dimension_key": key,
                            "score": 72,
                            "comment": "达到本次基础要求。",
                            "evidence": [
                                {
                                    "message_id": message_id,
                                    "quote": quote,
                                    "reason": "该表达构成学生本轮谈判证据。",
                                }
                            ],
                        }
                        for key in dimensions
                    ],
                    "knowledge_tags": ["counter-offer", "reciprocity"],
                    "learning_diagnostic": _mock_learning_diagnostic(message_id, quote),
                },
                ensure_ascii=False,
            )
        return LLMResponse(
            provider="mock",
            model="mock-deepseek-v4-flash",
            content=content,
            finish_reason="stop",
            usage=LLMUsage(),
        )

    def stream(self, request: LLMRequest) -> Iterator[LLMStreamChunk]:
        response = self.complete(request)
        words = response.content.split(" ")
        for index, word in enumerate(words):
            suffix = " " if index + 1 < len(words) else ""
            yield LLMStreamChunk(
                provider=response.provider,
                model=response.model,
                delta=f"{word}{suffix}",
            )
        yield LLMStreamChunk(
            provider=response.provider,
            model=response.model,
            finish_reason=response.finish_reason,
            usage=response.usage,
        )


def _mock_learning_diagnostic(message_id: str, quote: str) -> dict[str, object]:
    dimension_keys = [
        "domain_knowledge",
        "language_control",
        "negotiation_strategy",
        "adaptability",
        "intercultural_pragmatics",
        "self_regulation",
    ]
    evidence = (
        [{"message_id": message_id, "quote": quote, "interpretation": "构成当前能力判断依据。"}]
        if quote
        else []
    )
    return {
        "framework_version": "zpd-da-v1",
        "learner_stage": "developing",
        "challenge_level": 2,
        "support_level": "guided_choice",
        "negotiation_style": "collaborative",
        "adaptability_summary": "能够回应对方条件，但尚需帮助完成多条件交换。",
        "dimensions": [
            {
                "dimension_key": key,
                "score": 68,
                "judgment": "在引导下能够完成基础任务。",
                "evidence": evidence,
            }
            for key in dimension_keys
        ],
        "knowledge_mastery": [
            {
                "knowledge_point": "条件交换",
                "status": "developing",
                "evidence": evidence,
            }
        ],
        "next_stretch_target": "独立把数量、价格和付款方式组成可执行的交换方案。",
        "mediation_strategy": "以卖方身份提出二选一条件，随后逐步撤除提示。",
        "confidence": 0.82,
    }
