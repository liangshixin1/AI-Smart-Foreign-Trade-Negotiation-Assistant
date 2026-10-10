# [导读] 所属业务: 带角色演出和态势的谈判仿真。
# [导读] 业务名词: Simulation 是逐段台词演出的训练体验; Presentation 是已保存的演出; State 是按
# [导读] 证据计算的谈判态势。
# [导读] 用途与原因: 读取仿真配置和指定版本的提示词, 检查当前关卡是否支持仿真; 旧训练重放必须使
# [导读] 用绑定版本。
# [导读] 结构: load_profile、load_profile_version、load_simulation_prompt、
# [导读] SimulationProfileService
# [导读] 。
# [导读] 提醒: 台词、逐轮评价与态势是不同结果; 分析失败不应丢掉已保存台词, 重试需尊重训练绑定的
# [导读] 配置和规则版本。
from __future__ import annotations

from functools import lru_cache

import yaml

from app.core.errors import AppError
from app.core.resources import resource_root
from app.modules.simulation.schemas import SimulationProfile

CONTENT_ROOT = resource_root() / "content"
PROFILE_PATH = CONTENT_ROOT / "simulation/profiles/price-counteroffer-v1.yaml"
PROMPT_ROOT = CONTENT_ROOT / "prompts/simulation"


@lru_cache
def load_profile() -> SimulationProfile:
    with PROFILE_PATH.open(encoding="utf-8") as source:
        payload = yaml.safe_load(source)
    return SimulationProfile.model_validate(payload)


@lru_cache
def load_profile_version(profile_id: str, version: str) -> SimulationProfile:
    for path in (CONTENT_ROOT / "simulation/profiles").glob("*.yaml"):
        with path.open(encoding="utf-8") as source:
            candidate = SimulationProfile.model_validate(yaml.safe_load(source))
        if (candidate.id, candidate.version) == (profile_id, version):
            return candidate
    raise AppError(
        code="simulation.profile_missing",
        message="该仿真记录绑定的版本化关卡配置不存在。",
        status_code=409,
    )


@lru_cache
def load_simulation_prompt(kind: str) -> str:
    paths = {
        "briefing": PROMPT_ROOT / "scenario/simulation-briefing-public.yaml",
        "conversation": PROMPT_ROOT / "conversation/simulation-conversation-counteroffer.yaml",
        "round": PROMPT_ROOT / "round/simulation-round-counteroffer.yaml",
        "final": PROMPT_ROOT / "final/simulation-final-counteroffer.yaml",
    }
    path = paths.get(kind)
    if path is None:
        raise ValueError(f"Unknown simulation prompt kind: {kind}")
    with path.open(encoding="utf-8") as source:
        payload = yaml.safe_load(source)
    template = payload.get("template") if isinstance(payload, dict) else None
    if not isinstance(template, str) or not template.strip():
        raise RuntimeError(f"Simulation prompt is invalid: {path}")
    return template


class SimulationProfileService:
    def __init__(self, enabled: bool) -> None:
        self.enabled = enabled

    def supported_modes(self, unit_key: str, training_mode: str) -> list[str]:
        modes = ["chat"]
        profile = load_profile()
        if (
            self.enabled
            and profile.enabled
            and profile.unit_key == unit_key
            and profile.training_mode == training_mode
        ):
            modes.append("simulation")
        return modes

    def require_available(self, unit_key: str, training_mode: str) -> SimulationProfile:
        profile = load_profile()
        if "simulation" not in self.supported_modes(unit_key, training_mode):
            raise AppError(
                code="simulation.not_available",
                message="该小节当前未开放仿真模式。",
                status_code=422,
            )
        return profile

    def for_existing_attempt(
        self, unit_key: str, profile_id: str, profile_version: str
    ) -> SimulationProfile:
        profile = load_profile_version(profile_id, profile_version)
        if profile.unit_key != unit_key:
            raise AppError(
                code="simulation.profile_missing",
                message="该仿真记录绑定的关卡配置不存在。",
                status_code=409,
            )
        return profile
