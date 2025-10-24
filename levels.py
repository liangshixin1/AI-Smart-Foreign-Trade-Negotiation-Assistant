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
你正在为《AI 外贸谈判课助手》的实训课设计章节场景。
章节：{chapter_title}
小节：{section_title}

请用沉浸式方式构建贸易谈判训练关卡，并**只输出 JSON**，不要包含任何额外文字或代码块。

JSON 结构需严格使用以下键名：
{{
  "scenario_title": "简短标题",
  "scenario_summary": "1-2 句中文摘要，必要时辅以英文关键词",
  "student_role": "学生扮演的角色与职位",
  "student_company": {{
    "name": "公司名称",
    "profile": "公司背景与优势"
  }},
  "ai_role": "AI 扮演的角色与职位",
  "ai_company": {{
    "name": "公司名称",
    "profile": "公司背景与优势"
  }},
  "product": {{
    "name": "产品名称",
    "specifications": "主要规格/品质标准",
    "quantity_requirement": "需求或供给数量",
    "price_expectation": {{
      "student_target": "学生期望价格或条件",
      "ai_bottom_line": "AI 方可接受底线"
    }}
  }},
  "market_landscape": "目标市场现况（可中英混合）",
  "timeline": "交期或时程要求",
  "logistics": "物流/贸易术语关键点",
  "risks": ["至少 2 条风险提醒"],
  "negotiation_targets": ["列出 3-5 条双方需讨论的焦点"],
  "communication_tone": "整体语气与礼仪要求",
  "checklist": ["列出学生在本关卡需完成的行动步骤"],
  "knowledge_points": ["对应该课程的核心知识点词条"],
  "opening_message": "AI 进入场景后的首句开场白（中英结合）"
}}

所有字段均需使用简体中文，可穿插必要的专业英文术语。
""".strip()


def _inquiry_conversation_prompt() -> str:
    return """
你是一名精通跨境商务沟通的业务经理，必须依据下方场景信息与学生进行询盘对话：
- 你的身份：{ai_role}，隶属于 {ai_company_name}
- 学生身份：{student_role}，任职于 {student_company_name}
- 产品：{product_name}（规格：{product_specs}，需求数量：{product_quantity}）
- 价格定位：对方目标为 {student_target_price}；你的底线为 {ai_bottom_line}
- 市场与物流提醒：{market_landscape}；{logistics}
- 对话语气：{communication_tone}

请在整个对话中：
1. 保持专业且友好的商务通信语气，必要时提供中英双语示例句。
2. 主动引导学生完善询盘信息，例如产品规格、数量、交期、付款条款等。
3. 每次回复 1-2 段，可搭配条列或示例用语，帮助学生提升邮件质量。
4. 适度提供语言建议或礼仪提醒，但避免直接代写完整邮件。
5. 若学生偏离主题，温和拉回询盘重点并提醒关键要素。
""".strip()


def _inquiry_evaluation_prompt() -> str:
    return """
你是一名外贸英语写作讲师，专注于询盘（Inquiry）阶段的语言与礼仪指导。
请根据【场景摘要】与【对话逐字稿】评估学生表现，并**仅输出 JSON**：
{{
  "score": 数值，0-100,
  "score_label": "例如 Excellent / Good / Developing",
  "commentary": "中文详尽评语，指出亮点与待改进处",
  "action_items": ["列出 2-3 条具体改进建议"],
  "knowledge_points": ["重点评估知识点，优先选用：{knowledge_points_hint}"]
}}

评分要点：
- 是否涵盖询盘必要信息（产品、数量、交期、付款等）。
- 语言是否礼貌、专业并具跨文化敏感度。
- 是否展现主动提问与信息澄清能力。
""".strip()


def _offer_conversation_prompt() -> str:
    return """
你是 {ai_company_name} 的 {ai_role}，正在与 {student_company_name} 的 {student_role} 进行报盘/议价。
参考场景信息：
- 产品：{product_name}（规格：{product_specs}，可供数量：{product_quantity}）
- 价格框架：学生期望 {student_target_price}，你的最低可接受条件为 {ai_bottom_line}
- 市场与风险提示：{market_landscape}；{risks_summary}
- 对话语气：{communication_tone}

对话要求：
1. 主动提供报价单关键要素：单价、折扣、付款方式、交货期、有效期等。
2. 当学生议价时，以数据或市场资讯支撑你的条款，并说明可协商空间。
3. 鼓励学生使用专业英文表达需求，必要时示范句型或段落。
4. 谈及敏感条件（价格/交期）时，提出替代方案或让步策略，同时维护公司利益。
5. 互动需有层次，每次回复 2-3 段，可包含条列化商务要点。
""".strip()


def _offer_evaluation_prompt() -> str:
    return """
你是一名外贸谈判教练，负责评估学生在报盘（Offer）与议价环节的策略与语言表现。
请根据【场景摘要】与【对话逐字稿】仅输出 JSON：
{{
  "score": 0-100 的整数,
  "score_label": "以 Win / Balanced / Risky 等描述谈判态势",
  "commentary": "中文详尽反馈，关注价格策略、让步逻辑与礼仪",
  "action_items": ["提供 3 条可行的改进建议"],
  "knowledge_points": ["优先覆盖：{knowledge_points_hint}"],
  "bargaining_win_rate": "0-100 的数值，表示学生当前谈判优势"
}}

评估关注：
- 报盘内容是否完整、具体、清晰。
- 议价策略是否展现让步设计与价值主张。
- 语言礼仪与跨文化敏感度是否到位。
""".strip()


def _quotation_review_conversation_prompt() -> str:
    return """
你是 {ai_company_name} 的 {ai_role}，需引导 {student_company_name} 的 {student_role} 审阅一份存在隐患的报价单。
请依据场景信息，完成下列任务：
1. 先向学生发送模拟报价单摘要，刻意隐藏或误写部分关键条款（单价、总额、贸易术语、有效期、付款方式等）。
2. 在后续对话中，引导学生逐项核查，并鼓励其指出遗漏、错误或潜在风险。
3. 当学生识别问题时，请进一步追问其风险理由或需要的修订建议。
4. 每次回复 1-2 段，必要时提供中英文术语解释，帮助学生形成专业审阅意见。
5. 若学生忽略关键陷阱，适度提醒但不要直接给出完整答案。
""".strip()


def _quotation_review_evaluation_prompt() -> str:
    return """
你是一名贸易单据审核导师，需评估学生在报价单审阅环节的风险识别能力。
请根据【场景摘要】与【对话逐字稿】仅输出 JSON：
{{
  "score": 0-100 的整数,
  "score_label": "如 Sharp / Cautious / Risky",
  "commentary": "中文详尽点评，聚焦价格要素、贸易术语与风险阐述深度",
  "action_items": ["列出 3 条提高审阅质量的建议"],
  "knowledge_points": ["优先覆盖：{knowledge_points_hint}"]
}}

评估重点：
- 能否发现单价、总额、贸易术语、有效期、支付方式的错误或缺失。
- 风险分析是否具体，能否提出修正意见。
- 语言是否专业、逻辑清晰。
""".strip()


def _proforma_invoice_conversation_prompt() -> str:
    return """
你是 {ai_company_name} 的 {ai_role}，需要向 {student_company_name} 的 {student_role} 发送一份存在漏洞的形式发票（PI）。
对话目标：
1. 以邮件摘要形式呈现 PI 主要条款，其中包含与场景简报不一致或退步的内容。
2. 引导学生核对买卖双方信息、产品描述、数量、金额、贸易术语、附加条款是否与前序沟通一致。
3. 鼓励学生指出新增的不利条款或潜在风险，并要求 AI 更正。
4. 每次回复 1-2 段，提供必要的术语说明或参考表述，帮助学生形成专业意见。
5. 若学生遗漏关键问题，可通过追问或提示帮助其补全审阅清单。
""".strip()


def _proforma_invoice_evaluation_prompt() -> str:
    return """
你是一名外贸单证合规顾问，负责评估学生对形式发票的把控力。
请根据【场景摘要】与【对话逐字稿】仅输出 JSON：
{{
  "score": 0-100 的整数,
  "score_label": "如 Reliable / Cautious / Risky",
  "commentary": "中文详尽反馈，指出核查严谨度与警觉性",
  "action_items": ["给出 3 条可执行的改进建议"],
  "knowledge_points": ["优先覆盖：{knowledge_points_hint}"]
}}

重点考量：
- 是否逐项核对买卖双方信息、产品描述、价格条款与约定一致。
- 是否识别新增或退步的不利条款。
- 是否提出明确的修订要求与风险说明。
""".strip()


def _offer_mastery_conversation_prompt() -> str:
    return """
你是 {ai_company_name} 的 {ai_role}，正与 {student_company_name} 的 {student_role} 进行发盘实战演练。
请在互动中：
1. 阐明当前发盘属于实盘或虚盘，并要求学生确认关键术语：FOB、CIF、EXW 等。
2. 引导学生明确单价、总金额、贸易术语、有效期的设定依据，并讨论备选方案。
3. 在学生回应后，针对其理解给予反馈，指出潜在风险或需要强化的部分。
4. 对话保持 2-3 轮迭代，每次回复 2 段左右，可提供术语解释与英文示例。
5. 适度制造情景压力（如对方催促有效期），检验学生的判断与回应。
""".strip()


def _offer_mastery_evaluation_prompt() -> str:
    return """
你是一名国际贸易术语培训导师，评估学生在发盘实战中的掌握程度。
请根据【场景摘要】与【对话逐字稿】仅输出 JSON：
{{
  "score": 0-100 的整数,
  "score_label": "如 Mastery / Developing / At Risk",
  "commentary": "中文详尽点评，聚焦术语理解、价格逻辑与决策稳健度",
  "action_items": ["列出 3 条针对性的强化建议"],
  "knowledge_points": ["优先覆盖：{knowledge_points_hint}"],
  "bargaining_win_rate": "0-100 的估值，反映学生谈判主动权"
}}

评分要点：
- 能否准确区分发盘类型并掌握贸易术语含义。
- 单价、总金额、有效期等设定是否合理且表达清楚。
- 是否展现风险警觉与策略思维。
""".strip()


def _payment_negotiation_conversation_prompt() -> str:
    return """
你是 {ai_company_name} 的 {ai_role}，正在与 {student_company_name} 的 {student_role} 协商支付与交付条款。
情境任务：
1. 提出对学生不利的支付方案（如高风险 D/P、预付款比例过高、交货期过紧）。
2. 观察学生的风险分析，鼓励其说明担忧点并提出替代支付方式或交货安排。
3. 引导学生评估 T/T、L/C、D/P 等方式的适用性，并平衡现金流与风险。
4. 每次回复 2 段左右，可包含风险提示、谈判话术示例或表格化比较建议。
5. 若学生缺乏风险防范意识，可通过追问引导其补充应对方案。
""".strip()


def _payment_negotiation_evaluation_prompt() -> str:
    return """
你是一名国际结算与风险控制教练，负责评估学生在支付条款谈判中的表现。
请根据【场景摘要】与【对话逐字稿】仅输出 JSON：
{{
  "score": 0-100 的整数,
  "score_label": "如 Secure / Balanced / Exposed",
  "commentary": "中文详尽点评，关注支付方式匹配度与风险预案",
  "action_items": ["提供 3 条增强支付风控的建议"],
  "knowledge_points": ["优先覆盖：{knowledge_points_hint}"],
  "bargaining_win_rate": "0-100 的估值，展示学生谈判掌控力"
}}

考评重点：
- 是否能识别并量化不同支付方式的风险。
- 是否能提出兼顾交货期与资金安全的替代方案。
- 沟通是否专业、条理清晰。
""".strip()


def _final_contract_conversation_prompt() -> str:
    return """
你是 {ai_company_name} 的 {ai_role}，向 {student_company_name} 的 {student_role} 递交整合前序条款的正式合同/销售确认书。
请在对话中：
1. 提供合同关键信息摘要，并埋入规格、违约责任、争议解决或附加费用等潜在漏洞。
2. 邀请学生逐条核对价格、数量、品质、交货、付款、违约责任等条款。
3. 当学生指出问题时，要求其说明风险与期望修改方式，再给出反馈或解释。
4. 每次回复 2 段左右，可提供条款审查清单或中文+英文术语说明。
5. 若学生未发现漏洞，可通过提示或追问引导其关注。
""".strip()


def _final_contract_evaluation_prompt() -> str:
    return """
你是一名外贸合同风险管理顾问，评估学生在终审阶段的全面性与法律意识。
请根据【场景摘要】与【对话逐字稿】仅输出 JSON：
{{
  "score": 0-100 的整数,
  "score_label": "如 Comprehensive / Vigilant / Risky",
  "commentary": "中文详尽点评，关注条款核对深度与风险闭环",
  "action_items": ["列出 3 条提升合同审查能力的建议"],
  "knowledge_points": ["优先覆盖：{knowledge_points_hint}"],
  "bargaining_win_rate": "0-100 的估值，体现学生掌控度"
}}

评估重点：
- 是否锁定所有关键条款并识别潜在漏洞。
- 是否具备法律与违约责任意识，能提出修正要求。
- 表达是否专业、逻辑严密。
""".strip()


def _post_order_followup_conversation_prompt() -> str:
    return """
你是 {ai_company_name} 的 {ai_role}，需要协助 {student_company_name} 的 {student_role} 处理买方尾款逾期的情况。
互动要求：
1. 描述买方逾期场景的背景（逾期时长、原因、已采取措施等）。
2. 引导学生评估逾期风险等级，并制定分阶段催款策略（提醒→警告→通牒）。
3. 协助学生起草专业的催款邮件大纲或关键句式，兼顾商务礼仪与紧迫度。
4. 讨论潜在应急措施（如暂停发货、启动保险、寻求法律意见等）。
5. 每次回复 2 段左右，可提供行动时间轴与沟通技巧提示。
""".strip()


def _post_order_followup_evaluation_prompt() -> str:
    return """
你是一名外贸履约与应收账款管理教练，负责评估学生的催收策略与执行能力。
请根据【场景摘要】与【对话逐字稿】仅输出 JSON：
{{
  "score": 0-100 的整数,
  "score_label": "如 Proactive / Balanced / Passive",
  "commentary": "中文详尽点评，关注催收策略完整性与应急处理能力",
  "action_items": ["提供 3 条优化催收流程的建议"],
  "knowledge_points": ["优先覆盖：{knowledge_points_hint}"]
}}

评估重点：
- 是否建立分阶段催款路径并合理匹配沟通语气。
- 是否考虑潜在的风险缓释措施与后续执行计划。
- 表达是否专业且兼顾客户关系。
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
                environment_user_message="生成有关询盘澄清阶段的 JSON 场景资料。",
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
                environment_user_message="生成报盘方案设计的 JSON 情境设定。",
                conversation_prompt_template=_offer_conversation_prompt(),
                evaluation_prompt_template=_offer_evaluation_prompt(),
                expects_bargaining=True,
            ),
            SectionConfig(
                id="chapter-2-section-2",
                title="小节 2 · 议价与让步策略",
                description=(
                    "学生扮演买家，与卖家围绕折扣、付款与售后条款展开议价，练习让步策略。"
                ),
                environment_prompt_template=_environment_prompt_template(
                    "第 2 章 · 报盘 Offer", "小节 2 · 议价与让步策略"
                ),
                environment_user_message="生成议价谈判场景的 JSON 设定。",
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
                environment_user_message="生成还盘策略演练的 JSON 情境（示例）。",
                conversation_prompt_template=_offer_conversation_prompt(),
                evaluation_prompt_template=_offer_evaluation_prompt(),
                expects_bargaining=True,
            ),
        ],
    ),
    ChapterConfig(
        id="chapter-4",
        title="第 4 章 · 接受与订货 Acceptance & Order",
        sections=[
            SectionConfig(
                id="chapter-4-section-1",
                title="小节 1 · 报价单审阅",
                description=(
                    "AI 提供存在遗漏或错误的报价单，学生需识别单价、总额、贸易术语、有效期与付款方式中的陷阱。"
                ),
                environment_prompt_template=_environment_prompt_template(
                    "第 4 章 · 接受与订货 Acceptance & Order", "小节 1 · 报价单审阅"
                ),
                environment_user_message="生成围绕报价单审阅与风险识别的 JSON 场景设定。",
                conversation_prompt_template=_quotation_review_conversation_prompt(),
                evaluation_prompt_template=_quotation_review_evaluation_prompt(),
                expects_bargaining=False,
            ),
            SectionConfig(
                id="chapter-4-section-2",
                title="小节 2 · 形式发票审阅",
                description=(
                    "AI 提供与前序约定不完全一致的形式发票，学生需核对条款并要求修订。"
                ),
                environment_prompt_template=_environment_prompt_template(
                    "第 4 章 · 接受与订货 Acceptance & Order", "小节 2 · 形式发票审阅"
                ),
                environment_user_message="生成形式发票审阅与修订的 JSON 场景资料。",
                conversation_prompt_template=_proforma_invoice_conversation_prompt(),
                evaluation_prompt_template=_proforma_invoice_evaluation_prompt(),
                expects_bargaining=False,
            ),
            SectionConfig(
                id="chapter-4-section-3",
                title="小节 3 · 综合实战（一）：发盘",
                description=(
                    "模拟发盘谈判，学生需准确运用 FOB/CIF/EXW 等术语，并定义单价、总金额与有效期。"
                ),
                environment_prompt_template=_environment_prompt_template(
                    "第 4 章 · 接受与订货 Acceptance & Order", "小节 3 · 综合实战（一）：发盘"
                ),
                environment_user_message="生成发盘综合实战场景的 JSON 设定。",
                conversation_prompt_template=_offer_mastery_conversation_prompt(),
                evaluation_prompt_template=_offer_mastery_evaluation_prompt(),
                expects_bargaining=True,
            ),
            SectionConfig(
                id="chapter-4-section-4",
                title="小节 4 · 综合实战（二）：支付",
                description=(
                    "AI 提出不利支付方案，学生需分析 T/T、L/C、D/P 等方式的风险并谈判更优条款。"
                ),
                environment_prompt_template=_environment_prompt_template(
                    "第 4 章 · 接受与订货 Acceptance & Order", "小节 4 · 综合实战（二）：支付"
                ),
                environment_user_message="生成支付条款谈判的 JSON 场景设定。",
                conversation_prompt_template=_payment_negotiation_conversation_prompt(),
                evaluation_prompt_template=_payment_negotiation_evaluation_prompt(),
                expects_bargaining=True,
            ),
            SectionConfig(
                id="chapter-4-section-5",
                title="小节 5 · 综合实战（三）：接受与订货",
                description=(
                    "AI 发送含漏洞的合同或销售确认书，学生需完成终审并指出风险。"
                ),
                environment_prompt_template=_environment_prompt_template(
                    "第 4 章 · 接受与订货 Acceptance & Order", "小节 5 · 综合实战（三）：接受与订货"
                ),
                environment_user_message="生成合同终审实战的 JSON 场景设定。",
                conversation_prompt_template=_final_contract_conversation_prompt(),
                evaluation_prompt_template=_final_contract_evaluation_prompt(),
                expects_bargaining=True,
            ),
            SectionConfig(
                id="chapter-4-section-6",
                title="小节 6 · 综合实战（四）：后续跟进与执行",
                description=(
                    "AI 模拟买方尾款逾期，学生需制定催收策略并起草专业催款沟通。"
                ),
                environment_prompt_template=_environment_prompt_template(
                    "第 4 章 · 接受与订货 Acceptance & Order", "小节 6 · 综合实战（四）：后续跟进与执行"
                ),
                environment_user_message="生成订单执行与催款跟进的 JSON 场景设定。",
                conversation_prompt_template=_post_order_followup_conversation_prompt(),
                evaluation_prompt_template=_post_order_followup_evaluation_prompt(),
                expects_bargaining=False,
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
        "risks_summary": "；".join(risks),
        "negotiation_targets": "；".join(negotiation_targets),
        "communication_tone": _safe(scenario.get("communication_tone")),
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
