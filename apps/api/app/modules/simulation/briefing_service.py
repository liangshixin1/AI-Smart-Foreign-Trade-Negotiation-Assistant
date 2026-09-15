# [导读] 所属业务: 带角色演出和态势的谈判仿真。
# [导读] 业务名词: Simulation 是逐段台词演出的训练体验; Presentation 是已保存的演出; State 是按
# [导读] 证据计算的谈判态势。
# [导读] 用途与原因: 根据公开场景生成开场简报并验证事实引用; 模型失败时使用受控备用简报, 避免展
# [导读] 示对手私有底牌。
# [导读] 结构: SimulationBriefingService、_validate_fact_refs、_validate_public_claims、
# [导读] _fallback。
# [导读] 提醒: 台词、逐轮评价与态势是不同结果; 分析失败不应丢掉已保存台词, 重试需尊重训练绑定的
# [导读] 配置和规则版本。
from __future__ import annotations

import json
import re
import uuid

from sqlalchemy.orm import Session

from app.integrations.llm.base import LLMMessage, LLMProvider, LLMProviderError, LLMRequest
from app.integrations.llm.prompt_renderer import render_prompt
from app.integrations.llm.structured_output import parse_structured_output
from app.modules.curriculum.models import TrainingUnit
from app.modules.simulation.models import (
    SimulationSession,
    SimulationStateSnapshot,
    SimulationTurnPresentation,
)
from app.modules.simulation.profile_service import load_simulation_prompt
from app.modules.simulation.schemas import (
    BriefingBeat,
    SimulationBeat,
    SimulationBriefingCandidate,
    SimulationOpening,
    SimulationProfile,
    SimulationTurnCandidate,
)
from app.modules.simulation.state_rules import initial_state
from app.modules.simulation.validators import validate_opening
from app.modules.training.hashing import stable_hash
from app.modules.training.invocations import invoke_and_record
from app.modules.training.models import Attempt, Message


class SimulationBriefingService:
    def __init__(self, db: Session, provider: LLMProvider) -> None:
        self.db = db
        self.provider = provider

    # [导读] 此处 flush 使新增对象可被后续 SQL 引用, 但尚未持久提交; 需沿调用方确认最终 commit
    # [导读] 或失败回滚。
    def create(
        self, attempt: Attempt, unit: TrainingUnit, profile: SimulationProfile
    ) -> SimulationSession:
        if attempt.scenario is None:
            raise ValueError("Simulation briefing requires a scenario snapshot")
        candidate, source, provider, model = self._generate(attempt, unit, profile)
        _validate_fact_refs(candidate, attempt.scenario.public_payload)
        opening_turn = SimulationTurnCandidate(
            schema_version="simulation.turn.v1", beats=candidate.opening.beats
        )
        canonical = validate_opening(opening_turn)
        attempt.scenario.public_payload["opening_message"] = canonical
        attempt.scenario.content_hash = stable_hash(
            {
                "public": attempt.scenario.public_payload,
                "private": attempt.scenario.private_payload,
            }
        )
        opening = Message(
            sequence_no=1,
            role="assistant",
            content=canonical,
            status="completed",
            provider=provider,
            model_name=model,
        )
        attempt.messages.append(opening)
        attempt.conversation_revision = 1
        self.db.flush()
        state = initial_state(profile)
        briefing_payload = [item.model_dump(mode="json") for item in candidate.briefing]
        session = SimulationSession(
            attempt_id=attempt.id,
            profile_id=profile.id,
            profile_version=profile.version,
            briefing_payload=briefing_payload,
            briefing_hash=stable_hash(briefing_payload),
            briefing_status="ready" if source == "llm" else "fallback",
            character_id=profile.character_id,
            display_name=profile.display_name,
            scene_id=profile.scene_id,
            asset_pack=profile.asset_pack,
            asset_pack_version=profile.asset_pack_version,
            latest_state_payload=state.model_dump(mode="json"),
            latest_state_revision=0,
            analysis_status="ready",
        )
        self.db.add(session)
        self.db.add(
            SimulationTurnPresentation(
                attempt_id=attempt.id,
                assistant_message_id=opening.id,
                student_message_id=None,
                beats=[item.model_dump(mode="json") for item in candidate.opening.beats],
                canonical_text_hash=stable_hash(canonical),
                source=source,
                input_state_revision=0,
                conversation_revision=1,
                prompt_binding={
                    "prompt_id": profile.briefing_prompt_id,
                    "prompt_version": profile.briefing_prompt_version,
                },
                asset_pack_version=profile.asset_pack_version,
            )
        )
        self.db.add(
            SimulationStateSnapshot(
                attempt_id=attempt.id,
                state_revision=0,
                source_round_id=None,
                parent_revision=None,
                payload=state.model_dump(mode="json"),
                applied_event_ids=[],
                rules_version=profile.rules_version,
            )
        )
        return session

    def _generate(
        self, attempt: Attempt, unit: TrainingUnit, profile: SimulationProfile
    ) -> tuple[SimulationBriefingCandidate, str, str, str]:
        scenario = attempt.scenario
        if scenario is None:
            raise ValueError("Simulation briefing requires a persisted scenario")
        public_json = json.dumps(scenario.public_payload, ensure_ascii=False)
        prompt = render_prompt(
            load_simulation_prompt("briefing"), {"scenario_public_json": public_json}
        )
        request = LLMRequest(
            purpose="scenario",
            prompt_template_id=profile.briefing_prompt_id,
            prompt_version=profile.briefing_prompt_version,
            correlation_id=str(uuid.uuid4()),
            messages=[LLMMessage(role="system", content=prompt)],
            json_output=True,
            metadata={
                "attempt_id": str(attempt.id),
                "unit_key": unit.unit_key,
                "simulation_kind": "briefing",
            },
        )
        current = request
        for index in range(2):
            try:
                response = invoke_and_record(self.db, self.provider, current)
                if response.finish_reason != "stop":
                    raise LLMProviderError(
                        f"finish_{response.finish_reason}",
                        "仿真简报输出不完整。",
                        retryable=True,
                    )
                candidate = parse_structured_output(response.content, SimulationBriefingCandidate)
                _validate_fact_refs(candidate, scenario.public_payload)
                _validate_public_claims(candidate, scenario.public_payload)
                validate_opening(
                    SimulationTurnCandidate(
                        schema_version="simulation.turn.v1", beats=candidate.opening.beats
                    )
                )
                return candidate, "llm", response.provider, response.model
            except (LLMProviderError, ValueError):
                if index == 0:
                    current = current.model_copy(
                        update={
                            "correlation_id": str(uuid.uuid4()),
                            "messages": [
                                *current.messages,
                                LLMMessage(
                                    role="system",
                                    content=(
                                        "上一份分镜未通过 Schema、事实引用或短台词校验，"
                                        "请完整重写合法 JSON。"
                                    ),
                                ),
                            ],
                        }
                    )
                    continue
        return _fallback(attempt), "deterministic_fallback", "local", "public-summary-v1"


def _validate_fact_refs(
    candidate: SimulationBriefingCandidate, public_payload: dict[str, object]
) -> None:
    allowed = set(public_payload)
    if any(set(beat.fact_refs) - allowed for beat in candidate.briefing):
        raise ValueError("Briefing references a field outside the public scenario")


def _validate_public_claims(
    candidate: SimulationBriefingCandidate, public_payload: dict[str, object]
) -> None:
    public_text = json.dumps(public_payload, ensure_ascii=False).casefold()
    rendered = " ".join(
        [
            *(item.rendered_text for item in candidate.briefing),
            *(item.text for item in candidate.opening.beats),
        ]
    )
    fact_pattern = re.compile(
        r"USD\s*\d+(?:\.\d+)?|\b\d{4}[-年/]\d{1,2}(?:[-月/]\d{1,2})?|"
        r"\b\d+(?:,\d{3})*(?:\.\d+)?(?:%|\s*units?|\s*件)",
        re.IGNORECASE,
    )
    if any(token.casefold() not in public_text for token in fact_pattern.findall(rendered)):
        raise ValueError("Briefing introduced a numeric fact outside the public scenario")


def _fallback(attempt: Attempt) -> SimulationBriefingCandidate:
    if attempt.scenario is None:
        raise ValueError("Fallback requires scenario")
    public = attempt.scenario.public_payload
    rows = [
        (
            "brief-01",
            f"你走进会谈室，今天要处理的是：{public['scenario_title']}。",
            ["scenario_title"],
        ),
        ("brief-02", f"你代表{public['student_role']}参与本轮磋商。", ["student_role"]),
        ("brief-03", f"坐在对面的是{public['ai_role']}。", ["ai_role"]),
        ("brief-04", f"本次交易标的是{public['product']}。", ["product"]),
        ("brief-05", f"你需要完成的任务是：{public['student_task']}。", ["student_task"]),
    ]
    briefing = [
        BriefingBeat(id=beat_id, rendered_text=text[:140], fact_refs=refs)
        for beat_id, text, refs in rows
    ]
    opening = SimulationOpening(
        beats=[
            SimulationBeat(
                id="opening-01",
                text=(
                    "Our current offer reflects the value of the NT-IM250. "
                    "What proposal would you like us to consider?"
                ),
            )
        ]
    )
    return SimulationBriefingCandidate(
        schema_version="simulation.briefing.v1", briefing=briefing, opening=opening
    )
