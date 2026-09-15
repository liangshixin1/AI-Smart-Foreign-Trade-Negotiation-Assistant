# [导读] 用途: 按运行配置创建模拟或 DeepSeek 模型适配器。
# [导读] 为什么: 模型选择集中在工厂, 应用和测试可以注入同一协议下的不同实现。
# [导读] 结构: build_llm_provider。
# [导读] 提醒: mock 是固定测试响应, 不是实际模型能力; 上线配置变化需同步更新运行中的 provider。
from app.core.config import Settings
from app.integrations.llm.base import LLMProvider
from app.integrations.llm.deepseek import DeepSeekProvider
from app.integrations.llm.mock import MockLLMProvider


def build_llm_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider == "deepseek":
        return DeepSeekProvider(settings)
    return MockLLMProvider()
