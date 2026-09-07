from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

from app.core.errors import AppError
from app.modules.simulation.schemas import SimulationProfile

CONTENT_ROOT = Path(__file__).resolve().parents[5] / "content"
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
