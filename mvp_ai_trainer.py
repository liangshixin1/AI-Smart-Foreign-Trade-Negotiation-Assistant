"""
Minimal Viable Product (MVP) for AI‑Enhanced Experiential Learning in
Foreign Trade Negotiation.  This script demonstrates how to integrate
the DeepSeek API to act as a learning partner and smart advisor across
ten chapters of an international trade negotiation curriculum.

Each chapter corresponds to a task function that sends a prompt to
DeepSeek's chat completion API and returns a generated response.
To run this script, you must install the `openai` SDK (`pip install
openai`) and set the environment variable `DEEPSEEK_API_KEY` with
your DeepSeek API key.  The API is compatible with the OpenAI
interface by specifying the `base_url` parameter.

The script does not implement a graphical user interface; instead it
provides a simple command‑line menu.  Students can choose a task,
enter required information, and receive AI‑generated drafts, simulated
negotiation responses or contract reviews.  After each generation,
the script optionally requests a second call to evaluate the student's
draft and provide feedback.  This dual‑call pattern illustrates how
the AI can serve both as a collaborator and as a critic.
"""

import os
from typing import Dict, Any, Iterator, Optional

try:
    from openai import OpenAI
except ImportError as e:
    raise ImportError(
        "The openai package is required. Install it with `pip install openai`." 
    ) from e


GLOBAL_SYSTEM_PROMPT = (
    "《外贸谈判技巧》数字教材·AI教研伙伴（G-Tutor）——全局指令\n"
    "* 你是“G-Tutor”，角色定位：学习伙伴 + 智能顾问。目标：让学生在做中学（任务驱动、可复现、可交付）。\n"
    "* 你可以随机或因地制宜决定学生的谈判身份（甲方/买方或乙方/卖方），并明确告知身份与对手方身份。\n"
    "* 你必须在对话开始生成全真模拟场景（包含：产品/规格、数量、包装、运输方式、目的地、交货期、Incoterms、结算币种、信用证/付款方式要求、合规限制等），并说明“本场景由 AI 模拟生成，仅供教学”。\n"
    "* 所有输出中英双语，中文在前、英文随后；语言实用、可操作，避免虚浮辞藻。\n"
    "* 交互遵循“一轮任务一目标”：给出可执行步骤、示例模板、检查清单、下一步建议。\n"
    "* 以知识图谱节点为导航，标记当前节点与未覆盖节点。\n"
    "* 对学生产出执行两阶段回路：1）协作生成（草稿/谈判回合）；2）批判性反馈（逐条修正+风险提示）。\n"
    "* 输出必须遵循统一的 JSON 契约，键包括 role_assignment、scenario、knowledge_graph_focus、task_steps、templates、checklist、rubric、next_actions、stream_tags。\n"
    "* 如果学生提出的条款可能违法或高风险，先提示风险与依据，再给出可行替代方案。\n"
    "* 明确声明：你提供的是教学与草拟建议，不构成法律或合规意见。\n"
)

SCENARIO_SYSTEM_PROMPT = (
    "You assign roles (student vs AI) and generate a realistic trade scenario. "
    "Return bilingual text followed by the JSON contract described in the global instructions."
)

CH6_SYSTEM_PROMPT = (
    "你是国际贸易条款顾问，围绕付款与交货条款进行风险评估与双赢改写。"
    " 支持：T/T 预付比例、O/A、D/P、D/A、L/C（at sight、usance、UPAS）、分批交货、部分装运/转运限制、交货期缓冲与延迟违约金等。"
    " 先评估学生方案对买卖双方的现金流、信用与履约风险，再给出改写与谈判建议（含让步与保护条款）。"
    " 输出自然语言说明 + 统一 JSON。"
)

CH7_SYSTEM_PROMPT = (
    "你是中立争议协调员，模拟对手方并推进检验争议处理。"
    " 识别并解释检验条款与国际公约要点，引导学生引用合同/信用证条款、检验证书、复验流程，并输出双方可接受的解决路径（含时效节点）。"
    " 输出自然语言说明 + 统一 JSON。"
)

CH8_SYSTEM_PROMPT = (
    "你是保险与争议解决顾问，基于交易细节给出适当险别、保险金额与免赔额建议。"
    " 设计一条仲裁条款（仲裁地/机构/规则/语言/适用法/裁决终局），并提示选择错误的潜在风险。"
    " 输出自然语言说明 + 统一 JSON。"
)

CH9_SYSTEM_PROMPT = (
    "你是客户成功经理，AI 扮演情绪激动的客户，对学生进行安抚、溯源与闭环训练。"
    " 引导学生进行 LEARN（Listen, Empathize, Apologize/acknowledge, Resolve plan, Next check-in）闭环，并对共情表达、响应速度、可行方案评分，给出话术升级建议。"
    " 输出自然语言说明 + 统一 JSON。"
)

CH10_SYSTEM_PROMPT = (
    "你是高级法务/商务写作教练，评审索赔函/答复函。"
    " 检查法律依据、时效、条款引用、因果与证据链、语气与专业性、请求或抗辩的比例性，给出逐段批注与重写示例，最后汇总改进版正式函电。"
    " 输出自然语言说明 + 统一 JSON。"
)


class ForeignTradeAITrainer:
    """A class encapsulating AI tasks for foreign trade negotiation training."""

    def __init__(self, api_key: Optional[str] = None, base_url: str = "https://api.deepseek.com"):
        api_key = api_key or os.getenv("DEEPSEEK_API_KEY")
        if not api_key:
            raise EnvironmentError("Missing DEEPSEEK_API_KEY environment variable.")
        self.client = OpenAI(api_key=api_key, base_url=base_url)

    def _chat(self, system_prompt: str, user_prompt: str) -> str:
        response = self.client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return response.choices[0].message.content.strip()

    def _chat_stream(self, system_prompt: str, user_prompt: str) -> Iterator[str]:
        stream = self.client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            stream=True,
        )
        for chunk in stream:
            delta = getattr(chunk.choices[0].delta, "content", "")
            if delta:
                yield delta

    def decide_role_and_scenario(self, seed: str = "", stream: bool = False):
        system = GLOBAL_SYSTEM_PROMPT + "\n" + SCENARIO_SYSTEM_PROMPT
        user = f"Please decide roles and create scenario. Seed: {seed}"
        if stream:
            return self._chat_stream(system, user)
        return self._chat(system, user)

    def generate_inquiry(self, product_info: str) -> str:
        """Generate an inquiry email based on product and market information."""
        system = (
            "You are an experienced foreign trade buyer.  Your task is to draft a "
            "polite and professional inquiry email to a potential supplier.  Include "
            "product specifications, quantity, required quality standards and any "
            "other relevant details.  After drafting the email, provide two paragraphs "
            "of constructive feedback on language, courtesy and cultural appropriateness."
        )
        user = f"Please write an inquiry email based on the following information: {product_info}"
        return self._chat(system, user)

    def simulate_offer(self, offer_data: Dict[str, Any]) -> str:
        """Simulate generating an offer and negotiating price with a buyer."""
        system = (
            "You are a foreign trade seller preparing a detailed offer.  Draft a quotation "
            "that includes unit price, total amount, Incoterms (e.g. FOB or CIF), payment "
            "terms, delivery lead time and validity period.  After presenting the quotation, "
            "simulate the buyer requesting a discount and respond with a persuasive justification."
        )
        lines = [f"{k}: {v}" for k, v in offer_data.items()]
        user = "Generate an offer and conduct a short price negotiation based on the following details:\n" + "\n".join(lines)
        return self._chat(system, user)

    def simulate_counter_offer(self, context: str) -> str:
        """Simulate a counter‑offer negotiation sequence."""
        system = (
            "You are participating in a price negotiation.  The buyer has proposed certain "
            "conditions.  Respond by crafting a counter‑offer that balances concession and "
            "firmness.  Explain your reasoning and anticipate the buyer's reaction."
        )
        user = f"The current negotiation context is: {context}. Please draft a counter‑offer."
        return self._chat(system, user)

    def review_order_contract(self, contract_text: str) -> str:
        """Review an order or contract and highlight key clauses and risks."""
        system = (
            "You are a senior contract auditor specialising in international trade.  Read the "
            "following order or contract and identify key clauses such as price, delivery, "
            "payment terms, liability, governing law and dispute resolution.  Provide a summary "
            "of any missing or ambiguous terms and suggest improvements to mitigate risks."
        )
        return self._chat(system, contract_text)

    def plan_shipping(self, order_details: str) -> str:
        """Generate a shipping plan, booking note and draft bill of lading."""
        system = (
            "You are a logistics coordinator.  Based on the order details, design a comprehensive "
            "shipping plan including choice of transport mode, packaging, booking a vessel, customs "
            "declaration and insurance coverage.  Provide a booking note template and a draft bill of "
            "lading with key fields filled out."
        )
        return self._chat(system, order_details)

    def chapter6_payment_delivery(self, proposal: str, stream: bool = False):
        system = GLOBAL_SYSTEM_PROMPT + "\n" + CH6_SYSTEM_PROMPT
        if stream:
            return self._chat_stream(system, proposal)
        return self._chat(system, proposal)

    def chapter7_inspection(self, scenario: str, stream: bool = False):
        system = GLOBAL_SYSTEM_PROMPT + "\n" + CH7_SYSTEM_PROMPT
        if stream:
            return self._chat_stream(system, scenario)
        return self._chat(system, scenario)

    def chapter8_insurance_arbitration(self, detail: str, stream: bool = False):
        system = GLOBAL_SYSTEM_PROMPT + "\n" + CH8_SYSTEM_PROMPT
        if stream:
            return self._chat_stream(system, detail)
        return self._chat(system, detail)

    def chapter9_complaint(self, complaint: str, stream: bool = False):
        system = GLOBAL_SYSTEM_PROMPT + "\n" + CH9_SYSTEM_PROMPT
        if stream:
            return self._chat_stream(system, complaint)
        return self._chat(system, complaint)

    def chapter10_claim(self, letter: str, stream: bool = False):
        system = GLOBAL_SYSTEM_PROMPT + "\n" + CH10_SYSTEM_PROMPT
        if stream:
            return self._chat_stream(system, letter)
        return self._chat(system, letter)

    def payment_delivery_simulation(self, proposal: str) -> str:
        """Backward compatible wrapper for chapter 6."""
        return self.chapter6_payment_delivery(proposal)

    def inspection_dispute_simulation(self, scenario: str) -> str:
        """Backward compatible wrapper for chapter 7."""
        return self.chapter7_inspection(scenario)

    def insurance_arbitration_advisor(self, scenario: str) -> str:
        """Backward compatible wrapper for chapter 8."""
        return self.chapter8_insurance_arbitration(scenario)

    def complaint_handling_simulation(self, complaint: str) -> str:
        """Backward compatible wrapper for chapter 9."""
        return self.chapter9_complaint(complaint)

    def claim_letter_review(self, letter: str) -> str:
        """Backward compatible wrapper for chapter 10."""
        return self.chapter10_claim(letter)


def main():
    trainer = ForeignTradeAITrainer()

    menu = {
        "0": {
            "description": "Decide roles and generate scenario",
            "handler": trainer.decide_role_and_scenario,
            "prompt": "Enter an optional seed for the scenario (press Enter to skip): ",
            "stream_capable": True,
            "structured_input": False,
        },
        "1": {
            "description": "Generate inquiry email",
            "handler": trainer.generate_inquiry,
            "prompt": "Enter product and market information: ",
            "stream_capable": False,
            "structured_input": False,
        },
        "2": {
            "description": "Simulate offer negotiation",
            "handler": trainer.simulate_offer,
            "stream_capable": False,
            "structured_input": True,
        },
        "3": {
            "description": "Simulate counter-offer",
            "handler": trainer.simulate_counter_offer,
            "prompt": "Describe the current negotiation context: ",
            "stream_capable": False,
            "structured_input": False,
        },
        "4": {
            "description": "Review order contract",
            "handler": trainer.review_order_contract,
            "prompt": "Paste or describe the contract text: ",
            "stream_capable": False,
            "structured_input": False,
        },
        "5": {
            "description": "Plan shipping and draft documents",
            "handler": trainer.plan_shipping,
            "prompt": "Provide order and logistics details: ",
            "stream_capable": False,
            "structured_input": False,
        },
        "6": {
            "description": "Evaluate payment & delivery terms",
            "handler": trainer.chapter6_payment_delivery,
            "prompt": "Describe the proposed payment and delivery terms: ",
            "stream_capable": True,
            "structured_input": False,
        },
        "7": {
            "description": "Handle inspection dispute",
            "handler": trainer.chapter7_inspection,
            "prompt": "Describe the inspection dispute scenario: ",
            "stream_capable": True,
            "structured_input": False,
        },
        "8": {
            "description": "Design insurance & arbitration clause",
            "handler": trainer.chapter8_insurance_arbitration,
            "prompt": "Provide transaction details for insurance and arbitration planning: ",
            "stream_capable": True,
            "structured_input": False,
        },
        "9": {
            "description": "Handle customer complaint",
            "handler": trainer.chapter9_complaint,
            "prompt": "Describe the complaint context or message: ",
            "stream_capable": True,
            "structured_input": False,
        },
        "10": {
            "description": "Review claim letter",
            "handler": trainer.chapter10_claim,
            "prompt": "Paste or describe the claim/response letter: ",
            "stream_capable": True,
            "structured_input": False,
        },
    }

    print("Foreign Trade AI Trainer")
    while True:
        print("\nAvailable tasks:")
        for key in sorted(menu.keys(), key=lambda k: (len(k), k)):
            print(f"  {key}. {menu[key]['description']}")
        print("  q. Quit")

        choice = input("Select a task by number (or 'q' to quit): ").strip()
        if choice.lower() == "q":
            break
        if choice not in menu:
            print("Invalid selection. Please try again.")
            continue

        entry = menu[choice]
        handler = entry["handler"]
        print(f"\nYou selected: {entry['description']}")

        if entry.get("structured_input"):
            offer = {}
            offer["Product"] = input("Enter product description: ")
            offer["Quantity"] = input("Enter quantity: ")
            offer["Price"] = input("Enter desired unit price: ")
            offer["Incoterm"] = input("Enter Incoterm (e.g., FOB, CIF): ")
            offer["Payment terms"] = input("Enter payment terms: ")
            offer["Delivery"] = input("Enter delivery timeframe: ")
            print("\nGenerating offer and negotiation...\n")
            print(handler(offer))
            continue

        user_input = input(entry.get("prompt", "Enter the details or scenario description: "))
        use_stream = False
        if entry.get("stream_capable"):
            stream_choice = input("Stream the response? (y/N): ").strip().lower()
            use_stream = stream_choice.startswith("y")

        print("\nAI Response:\n")
        if use_stream:
            for token in handler(user_input, stream=True):
                print(token, end="", flush=True)
            print()
        else:
            print(handler(user_input))


if __name__ == "__main__":
    main()
