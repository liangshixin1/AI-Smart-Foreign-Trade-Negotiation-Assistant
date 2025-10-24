"""Scenario and evaluation configuration for negotiation training levels."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass(frozen=True)
class SectionConfig:
    id: str
    title: str
    description: str
    environment_prompt_template: str
    environment_user_message: str
    conversation_prompt_template: str
    evaluation_prompt_template: str
    expects_bargaining: bool = False


@dataclass(frozen=True)
class ChapterConfig:
    id: str
    title: str
    sections: List[SectionConfig]


def _environment_prompt_template(chapter_title: str, section_title: str) -> str:
    return f"""
你正在为《AI 外贸谈判课助手》的實訓課設計章節場景。
章節：{chapter_title}
小節：{section_title}

請用沉浸式的方式構建一個貿易談判關卡設定，並**只輸出 JSON**。不要包含額外的自然語言、說明或程式碼框。

JSON 結構需嚴格遵循以下鍵名：
{{
  "scenario_title": "簡短標題",
  "scenario_summary": "1-2 句中文摘要，必要時輔以英文關鍵詞",
  "student_role": "學生扮演的角色與職位描述",
  "student_company": {{
    "name": "公司名稱",
    "profile": "公司背景與優勢"
  }},
  "ai_role": "AI 扮演的角色與職位",
  "ai_company": {{
    "name": "公司名稱",
    "profile": "公司背景與優勢"
  }},
  "product": {{
    "name": "產品名稱",
    "specifications": "主要規格/品質標準",
    "quantity_requirement": "需求或供應數量",
    "price_expectation": {{
      "student_target": "學生期望的價格或條件",
      "ai_bottom_line": "AI 方的可接受底線"
    }}
  }},
  "market_landscape": "目標市場現況（語言可中英混合）",
  "timeline": "交期或時程要求",
  "logistics": "物流/貿易條款關鍵點",
  "risks": ["至少 2 條風險提醒"],
  "negotiation_targets": ["列出 3-5 條雙方需要討論的焦點"],
  "communication_tone": "整體語氣與禮儀要求",
  "checklist": ["列出學生在本關卡需完成的行動步驟"],
  "knowledge_points": ["對應課程的核心知識點詞條"],
  "opening_message": "AI 進入場景後的首句開場白（中英文結合）"
}}

所有內容使用簡潔中文，可穿插必要的專業英文詞彙。
""".strip()


def _inquiry_conversation_prompt() -> str:
    return """
你是一名精通跨境商務溝通的業務經理，必須依據下方場景資訊與學生進行詢盤對話：
- 你的身份：{ai_role}，隸屬於 {ai_company_name}
- 學生身份：{student_role}，任職於 {student_company_name}
- 產品：{product_name}（規格：{product_specs}，需求數量：{product_quantity}）
- 價格定位：對方目標為 {student_target_price}；你的底線為 {ai_bottom_line}
- 市場與物流提醒：{market_landscape}；{logistics}
- 對話語氣：{communication_tone}

請在整個對話中：
1. 維持專業且友好的商務書信與即時溝通風格，必要時提供英文句型示例。
2. 主動引導學生完善詢盤信息，例如詢問產品規格、數量、交期、付款條件等細節。
3. 每次回覆 1-2 段落為宜，可包含條列或示例用語，幫助學生提升書信品質與禮儀。
4. 適度給予語言建議或禮儀提醒，但避免直接替學生完成整封郵件。
5. 若學生偏離主題，溫和拉回詢盤任務並提醒關鍵重點。
""".strip()


def _inquiry_evaluation_prompt() -> str:
    return """
你是一名外貿英語寫作講師，專注於詢盤（Inquiry）階段的語言與禮儀指導。
請根據【場景摘要】與【對話逐字稿】評估學生表現，並**僅輸出 JSON**，包含：
{{
  "score": 數值，0-100,
  "score_label": "例如 Excellent / Good / Developing",
  "commentary": "中文詳盡評語，指出亮點與需要改進處",
  "action_items": ["列出 2-3 條具體改進建議"],
  "knowledge_points": ["重點知識點詞條，優先選用：{knowledge_points_hint}"]
}}

評分要點：
- 是否涵蓋詢盤必要資訊（產品、數量、交期、付款等）。
- 語言是否禮貌、專業並具備跨文化敏感度。
- 是否展示主動提問與信息澄清能力。
""".strip()


def _offer_conversation_prompt() -> str:
    return """
你是 {ai_company_name} 的 {ai_role}，正在與 {student_company_name} 的 {student_role} 進行報盤/議價環節。
參考場景資訊：
- 產品：{product_name}（規格：{product_specs}，可提供數量：{product_quantity}）
- 價格框架：學生期望 {student_target_price}，你的最低可接受條件為 {ai_bottom_line}
- 市場與風險提示：{market_landscape}；{risks_summary}
- 對話語氣：{communication_tone}

對話要求：
1. 主動提供報價單關鍵要素：單價、折扣、付款方式、交貨期、有效期等。
2. 當學生議價時，以數據或市場資訊支撐你的條件，並探討可協商的部分。
3. 鼓勵學生使用專業英文表述需求，必要時示範句型或段落。
4. 當談及敏感條件（價格/交期）時，給出替代方案或讓步策略，同時維護公司利益。
5. 會話保持互動性，每次回覆 2-3 段落，可包含條列化的商務要點。
""".strip()


def _offer_evaluation_prompt() -> str:
    return """
你是一名外貿談判教練，評估學生在報盤（Offer）與議價環節的策略與語言表現。
請根據【場景摘要】與【對話逐字稿】輸出 JSON：
{{
  "score": 0-100 的整數分數,
  "score_label": "以 Win / Balanced / Risky 等描述談判態勢",
  "commentary": "中文詳盡反饋，關注價格策略、讓步邏輯與禮儀",
  "action_items": ["提供 3 條可行的改進建議"],
  "knowledge_points": ["優先覆蓋：{knowledge_points_hint}"],
  "bargaining_win_rate": "0-100 之間的數值，表示學生當前勝率或談判優勢"
}}

評估時特別關注：
- 報盤內容是否完整、具體、清晰。
- 議價策略是否展現讓步設計與價值主張。
- 語言禮儀與跨文化敏感度是否到位。
""".strip()


def _acceptance_conversation_prompt() -> str:
    return """
你是 {ai_company_name} 的 {ai_role}，正在指導 {student_company_name} 的 {student_role} 審閱交易文件。
請依照場景資訊：
- 產品：{product_name}（規格：{product_specs}，需求數量：{product_quantity}）
- 報價與條款：對方目標 {student_target_price}；你的底線 {ai_bottom_line}
- 物流與提醒：{logistics}；{risks_summary}
- 對話語氣：{communication_tone}

對話要求：
1. 引導學生逐項確認報價單、形式發票的要素，如有效期、付款條件、運輸條款。
2. 針對學生的疑問給出專業說明，可提供雙語術語解釋與示例語句。
3. 鼓勵學生列出需修改或確認的條款，並形成下一步操作建議。
4. 回覆保持 1-2 段落，必要時用條列整理關鍵檢查點。
5. 若學生忽略關鍵風險，溫和提醒並提出補救建議。
""".strip()


def _acceptance_evaluation_prompt() -> str:
    return """
你是一名外貿單證與合約風控講師，需評估學生在審閱報價單/形式發票時的判斷力。
請根據【場景摘要】與【對話逐字稿】僅輸出 JSON：
{{
  "score": 0-100 的整數分數,
  "score_label": "以 Accurate / Cautious / Risky 等描述",
  "commentary": "中文詳盡回饋，指出確認要點與缺失",
  "action_items": ["提供 2-3 條具體補強建議"],
  "knowledge_points": ["優先覆蓋：{knowledge_points_hint}"]
}}

評估時著重：
- 是否完整檢核價格、有效期、付款、物流與法律責任等要素。
- 是否能辨識風險並提出修正或確認需求。
- 語言與禮儀是否兼具專業與合作態度。
""".strip()


def _order_negotiation_conversation_prompt() -> str:
    return """
你是 {ai_company_name} 的 {ai_role}，正與 {student_company_name} 的 {student_role} 進行訂單條款談判。
場景要點：
- 產品：{product_name}（規格：{product_specs}，預計交付數量：{product_quantity}）
- 價格立場：學生目標 {student_target_price}；你的底線 {ai_bottom_line}
- 市場概況與風險：{market_landscape}；{risks_summary}
- 物流條件：{logistics}
- 對話語氣：{communication_tone}

對話指引：
1. 深入討論訂單核心條件：實盤確認、有效期、單價、總價與貿易術語（FOB/CIF/EXW 等）。
2. 引導學生提出讓步或調整方案，並以數據或操作限制回應。
3. 適時提醒備選方案（如拆單、改運輸方式），協助學生設計談判策略。
4. 每次回覆 2-3 段落，提供結構化建議或示例句型。
5. 保持務實且合作的語氣，確保談判聚焦於風險控制與盈利目標。
""".strip()


def _order_negotiation_evaluation_prompt() -> str:
    return """
你是一名跨境訂單管理與談判顧問，需評估學生在接受與訂貨談判階段的表現。
請根據【場景摘要】與【對話逐字稿】僅輸出 JSON：
{{
  "score": 0-100,
  "score_label": "如 Advantage / Balanced / Under Pressure",
  "commentary": "中文詳盡評語，涵蓋條款掌握、讓步策略與風險意識",
  "action_items": ["列出 3 條下一步優化建議"],
  "knowledge_points": ["優先覆蓋：{knowledge_points_hint}"],
  "bargaining_win_rate": "0-100 的估算值，呈現學生談判優勢"
}}

評估重點：
- 是否明確確認訂單關鍵條件與國貿術語意義。
- 談判策略是否兼顧盈利與風險控制，具備清晰讓步邏輯。
- 語言禮儀、合作態度與跨文化敏感度。
""".strip()


CHAPTERS: List[ChapterConfig] = [
    ChapterConfig(
        id="chapter-1",
        title="第 1 章 · 询盘 Inquiry",
        sections=[
            SectionConfig(
                id="chapter-1-section-1",
                title="小节 1 · 首封询盘信息写作",
                description=(
                    "模拟学生作为进口商，向海外供应商发起询盘，完善产品、数量、交期等必要信息。"
                ),
                environment_prompt_template=_environment_prompt_template(
                    "第 1 章 · 询盘 Inquiry", "小节 1 · 首封询盘信息写作"
                ),
                environment_user_message="为上述询盘训练情境生成 JSON 场景设定。",
                conversation_prompt_template=_inquiry_conversation_prompt(),
                evaluation_prompt_template=_inquiry_evaluation_prompt(),
                expects_bargaining=False,
            ),
            SectionConfig(
                id="chapter-1-section-2",
                title="小节 2 · 询盘需求澄清与跟进",
                description=(
                    "学生需针对供应商的追问，进一步澄清产品细节与合作意向，学习跟进礼仪。"
                ),
                environment_prompt_template=_environment_prompt_template(
                    "第 1 章 · 询盘 Inquiry", "小节 2 · 询盘需求澄清与跟进"
                ),
                environment_user_message="生成有關詢盤澄清階段的 JSON 場景資料。",
                conversation_prompt_template=_inquiry_conversation_prompt(),
                evaluation_prompt_template=_inquiry_evaluation_prompt(),
                expects_bargaining=False,
            ),
        ],
    ),
    ChapterConfig(
        id="chapter-2",
        title="第 2 章 · 报盘 Offer",
        sections=[
            SectionConfig(
                id="chapter-2-section-1",
                title="小节 1 · 报盘方案设计",
                description=(
                    "学生扮演卖家，向买家提供完整报价单，并处理关于折扣与交期的追问。"
                ),
                environment_prompt_template=_environment_prompt_template(
                    "第 2 章 · 报盘 Offer", "小节 1 · 报盘方案设计"
                ),
                environment_user_message="生成報盤方案設計的 JSON 情境設定。",
                conversation_prompt_template=_offer_conversation_prompt(),
                evaluation_prompt_template=_offer_evaluation_prompt(),
                expects_bargaining=True,
            ),
            SectionConfig(
                id="chapter-2-section-2",
                title="小节 2 · 議價與讓步策略",
                description=(
                    "学生扮演买家，与卖家围绕折扣、付款与售后条款展开议价，练习让步策略。"
                ),
                environment_prompt_template=_environment_prompt_template(
                    "第 2 章 · 报盘 Offer", "小节 2 · 議價與讓步策略"
                ),
                environment_user_message="生成議價談判場景的 JSON 設定。",
                conversation_prompt_template=_offer_conversation_prompt(),
                evaluation_prompt_template=_offer_evaluation_prompt(),
                expects_bargaining=True,
            ),
        ],
    ),
    ChapterConfig(
        id="chapter-3",
        title="第 3 章 · 还盘 Counter-offer",
        sections=[
            SectionConfig(
                id="chapter-3-section-1",
                title="小节 1 · 还盘策略演练",
                description=(
                    "占位内容：后续将加入针对还盘场景的完整训练。"
                ),
                environment_prompt_template=_environment_prompt_template(
                    "第 3 章 · 还盘 Counter-offer", "小节 1 · 还盘策略演练"
                ),
                environment_user_message="生成還盤策略演練的 JSON 情境（示例）。",
                conversation_prompt_template=_offer_conversation_prompt(),
                evaluation_prompt_template=_offer_evaluation_prompt(),
                expects_bargaining=True,
            ),
        ],
    ),
    ChapterConfig(
        id="chapter-4",
        title="第 4 章 · 接受與訂貨 Acceptance & Order",
        sections=[
            SectionConfig(
                id="chapter-4-section-1",
                title="小节 1 · 报价單審閱實戰",
                description=(
                    "学生需與 AI 協作審閱 Quotation，確認價格、有效期、交貨與付款條款，識別潛在風險。"
                ),
                environment_prompt_template=_environment_prompt_template(
                    "第 4 章 · 接受與訂貨 Acceptance & Order", "小节 1 · 报价單審閱實戰"
                ),
                environment_user_message="生成涵蓋報價單審閱流程的 JSON 場景設定。",
                conversation_prompt_template=_acceptance_conversation_prompt(),
                evaluation_prompt_template=_acceptance_evaluation_prompt(),
                expects_bargaining=False,
            ),
            SectionConfig(
                id="chapter-4-section-2",
                title="小节 2 · 形式發票確認",
                description=(
                    "學生需對 Proforma Invoice 進行逐項核對，完成訂單前的條款確認與備註。"
                ),
                environment_prompt_template=_environment_prompt_template(
                    "第 4 章 · 接受與訂貨 Acceptance & Order", "小节 2 · 形式發票確認"
                ),
                environment_user_message="生成圍繞形式發票審閱的 JSON 情境資料。",
                conversation_prompt_template=_acceptance_conversation_prompt(),
                evaluation_prompt_template=_acceptance_evaluation_prompt(),
                expects_bargaining=False,
            ),
            SectionConfig(
                id="chapter-4-section-3",
                title="小节 3 · 訂單條款協商（一）",
                description=(
                    "綜合談判演練，針對實盤確認、有效期、單價與總價等條款提出修改並完成接受流程。"
                ),
                environment_prompt_template=_environment_prompt_template(
                    "第 4 章 · 接受與訂貨 Acceptance & Order", "小节 3 · 訂單條款協商（一）"
                ),
                environment_user_message="生成訂單條款協商與接受流程的 JSON 場景設定。",
                conversation_prompt_template=_order_negotiation_conversation_prompt(),
                evaluation_prompt_template=_order_negotiation_evaluation_prompt(),
                expects_bargaining=True,
            ),
            SectionConfig(
                id="chapter-4-section-4",
                title="小节 4 · 訂單條款協商（二）",
                description=(
                    "談判與還盤階段，買賣雙方就盈利與風控進行多輪磋商，完善最終訂單。"
                ),
                environment_prompt_template=_environment_prompt_template(
                    "第 4 章 · 接受與訂貨 Acceptance & Order", "小节 4 · 訂單條款協商（二）"
                ),
                environment_user_message="生成談判與還盤階段的 JSON 情境設定。",
                conversation_prompt_template=_order_negotiation_conversation_prompt(),
                evaluation_prompt_template=_order_negotiation_evaluation_prompt(),
                expects_bargaining=True,
            ),
        ],
    ),
]


def build_chapter_lookup() -> Dict[str, ChapterConfig]:
    return {chapter.id: chapter for chapter in CHAPTERS}


def flatten_scenario_for_template(scenario: Dict[str, object]) -> Dict[str, str]:
    """Prepare a flat mapping for string formatting templates."""
    student_company = scenario.get("student_company", {}) or {}
    ai_company = scenario.get("ai_company", {}) or {}
    product = scenario.get("product", {}) or {}
    price_expectation = product.get("price_expectation", {}) or {}
    risks = scenario.get("risks", []) or []
    knowledge_points = scenario.get("knowledge_points", []) or []
    negotiation_targets = scenario.get("negotiation_targets", []) or []

    def _safe(value: Optional[str]) -> str:
        return value if isinstance(value, str) else ""

    return {
        "scenario_title": _safe(scenario.get("scenario_title")),
        "scenario_summary": _safe(scenario.get("scenario_summary")),
        "student_role": _safe(scenario.get("student_role")),
        "student_company_name": _safe(student_company.get("name")),
        "student_company_profile": _safe(student_company.get("profile")),
        "ai_role": _safe(scenario.get("ai_role")),
        "ai_company_name": _safe(ai_company.get("name")),
        "ai_company_profile": _safe(ai_company.get("profile")),
        "product_name": _safe(product.get("name")),
        "product_specs": _safe(product.get("specifications")),
        "product_quantity": _safe(product.get("quantity_requirement")),
        "student_target_price": _safe(price_expectation.get("student_target")),
        "ai_bottom_line": _safe(price_expectation.get("ai_bottom_line")),
        "market_landscape": _safe(scenario.get("market_landscape")),
        "timeline": _safe(scenario.get("timeline")),
        "logistics": _safe(scenario.get("logistics")),
        "communication_tone": _safe(scenario.get("communication_tone")),
        "risks_summary": "；".join(risks) if risks else "",
        "knowledge_points_hint": "、".join(knowledge_points),
        "negotiation_focus_hint": "、".join(negotiation_targets),
    }


__all__ = [
    "ChapterConfig",
    "SectionConfig",
    "CHAPTERS",
    "build_chapter_lookup",
    "flatten_scenario_for_template",
]
