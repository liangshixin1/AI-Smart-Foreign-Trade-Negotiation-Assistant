"""封装与大模型交互的基础能力。"""

from __future__ import annotations

from typing import Dict, List

from openai import OpenAI

DEEPSEEK_BASE = "https://api.deepseek.com"
MODEL = "deepseek-chat"


def create_client(api_key: str) -> OpenAI:
    return OpenAI(api_key=api_key, base_url=DEEPSEEK_BASE)


def complete_chat(api_key: str, messages: List[Dict[str, str]], temperature: float = 0.7) -> str:
    client = create_client(api_key)
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=temperature,
    )
    if not response.choices:
        raise RuntimeError("Empty response from chat completion API")
    return response.choices[0].message.content or ""


def stream_chat(api_key: str, messages: List[Dict[str, str]], temperature: float = 0.7):
    client = create_client(api_key)
    stream = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=temperature,
        stream=True,
    )
    for chunk in stream:
        for choice in chunk.choices or []:
            delta = getattr(choice, "delta", None)
            if delta and getattr(delta, "content", None):
                yield delta.content
