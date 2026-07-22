from app.core.config import Settings
from app.integrations.llm.base import LLMProvider
from app.integrations.llm.deepseek import DeepSeekProvider
from app.integrations.llm.mock import MockLLMProvider


def build_llm_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider == "deepseek":
        return DeepSeekProvider(settings)
    return MockLLMProvider()
