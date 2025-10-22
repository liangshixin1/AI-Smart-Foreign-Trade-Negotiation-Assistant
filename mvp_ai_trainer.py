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
from typing import List, Dict, Any

try:
    from openai import OpenAI
except ImportError as e:
    raise ImportError(
        "The openai package is required. Install it with `pip install openai`." 
    ) from e


class ForeignTradeAITrainer:
    """A class encapsulating AI tasks for foreign trade negotiation training."""

    def __init__(self, api_key: str, base_url: str = "https://api.deepseek.com"):
        self.client = OpenAI(api_key=api_key, base_url=base_url)

    def _chat(self, system_prompt: str, user_prompt: str, stream: bool = False) -> str:
        """
        Internal helper to call the DeepSeek chat completion API.

        :param system_prompt: Instructions defining the assistant's role.
        :param user_prompt: The user's message to the assistant.
        :param stream: Whether to stream the response.
        :return: The assistant's reply as a string.
        """
        response = self.client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            stream=stream,
        )
        return response.choices[0].message.content.strip()

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

    def payment_delivery_simulation(self, proposal: str) -> str:
        """Simulate payment and delivery negotiation for Chapter 6."""
        system = (
            "You are an international trade advisor assessing payment and delivery terms.  Given the "
            "student's proposed arrangement (e.g. 30% T/T advance, 70% L/C at sight), evaluate the "
            "risk and feasibility from both buyer and seller perspectives.  Provide feedback on how "
            "to improve the terms to achieve a win‑win outcome."
        )
        return self._chat(system, proposal)

    def inspection_dispute_simulation(self, scenario: str) -> str:
        """Simulate handling an inspection dispute for Chapter 7."""
        system = (
            "You are a neutral trade dispute mediator.  Students will describe a dispute over inspection "
            "results.  Identify applicable international conventions (such as the CISG on examination of "
            "goods) and advise each party on their rights, obligations and negotiation strategies."
        )
        return self._chat(system, scenario)

    def insurance_arbitration_advisor(self, scenario: str) -> str:
        """Advise on insurance scheme and arbitration clause for Chapter 8."""
        system = (
            "You are an insurance and arbitration consultant.  Based on the provided transaction details, "
            "recommend appropriate marine cargo insurance coverage (basic and additional clauses) and "
            "suggest an arbitration clause specifying seat, institution and rules.  Point out potential "
            "risks if coverage is insufficient or the arbitration venue is poorly chosen."
        )
        return self._chat(system, scenario)

    def complaint_handling_simulation(self, complaint: str) -> str:
        """Simulate responding to an emotional customer complaint (Chapter 9)."""
        system = (
            "You are a customer service manager in a trading company.  A customer is angry about a shipment "
            "problem.  Respond with empathy, gather essential facts (who, what, when, where, why, how) and "
            "outline a clear plan to resolve the issue.  After your response, briefly evaluate the tone and "
            "effectiveness of your message and suggest improvements."
        )
        return self._chat(system, complaint)

    def claim_letter_review(self, letter: str) -> str:
        """Review a claim or response letter for legal basis, tone and persuasiveness (Chapter 10)."""
        system = (
            "You are a legal advisor assessing a trade claim letter or reply.  Evaluate whether the letter cites "
            "appropriate legal grounds, adheres to claim deadlines (e.g. nine‑month filing period under the Carmack "
            "Amendment), and uses professional language.  Provide constructive feedback on structure, tone and "
            "argument strength."
        )
        return self._chat(system, letter)


def main():
    #
    # API key configuration
    #
    # This script first tries to read an API key from the environment
    # variable DEEPSEEK_API_KEY.  If not found, it falls back to the
    # hard‑coded API_KEY constant defined below.  Replace the empty string
    # with your actual key to hard‑code it for testing purposes.
    API_KEY = ""
    api_key = os.environ.get("DEEPSEEK_API_KEY") or API_KEY
    if not api_key:
        raise EnvironmentError(
            "No API key provided.  Set the DEEPSEEK_API_KEY environment variable or "
            "edit the API_KEY constant in the script."
        )

    trainer = ForeignTradeAITrainer(api_key)

    menu = {
        "1": ("Generate inquiry email", trainer.generate_inquiry),
        "2": ("Simulate offer negotiation", trainer.simulate_offer),
        "3": ("Simulate counter‑offer", trainer.simulate_counter_offer),
        "4": ("Review order contract", trainer.review_order_contract),
        "5": ("Plan shipping and draft documents", trainer.plan_shipping),
        "6": ("Evaluate payment & delivery terms", trainer.payment_delivery_simulation),
        "7": ("Handle inspection dispute", trainer.inspection_dispute_simulation),
        "8": ("Design insurance & arbitration clause", trainer.insurance_arbitration_advisor),
        "9": ("Handle customer complaint", trainer.complaint_handling_simulation),
        "10": ("Review claim letter", trainer.claim_letter_review),
    }

    print("Foreign Trade AI Trainer")
    while True:
        print("\nAvailable tasks:")
        for key, (desc, _) in menu.items():
            print(f"  {key}. {desc}")
        print("  q. Quit")

        choice = input("Select a task by number (or 'q' to quit): ").strip()
        if choice.lower() == 'q':
            break
        if choice not in menu:
            print("Invalid selection. Please try again.")
            continue

        description, func = menu[choice]
        print(f"\nYou selected: {description}")
        if choice == "2":
            # Offer simulation requires structured input
            offer = {}
            offer["Product"] = input("Enter product description: ")
            offer["Quantity"] = input("Enter quantity: ")
            offer["Price"] = input("Enter desired unit price: ")
            offer["Incoterm"] = input("Enter Incoterm (e.g., FOB, CIF): ")
            offer["Payment terms"] = input("Enter payment terms: ")
            offer["Delivery"] = input("Enter delivery timeframe: ")
            print("\nGenerating offer and negotiation...")
            result = func(offer)
        else:
            user_input = input("Enter the details or scenario description: ")
            result = func(user_input)
        print("\nAI Response:\n")
        print(result)


if __name__ == "__main__":
    main()