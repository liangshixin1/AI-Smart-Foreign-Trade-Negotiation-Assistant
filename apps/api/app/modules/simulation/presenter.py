# [导读] 所属业务: 带角色演出和态势的谈判仿真。
# [导读] 业务名词: Simulation 是逐段台词演出的训练体验; Presentation 是已保存的演出; State 是按
# [导读] 证据计算的谈判态势。
# [导读] 用途与原因: 把会话、演出与态势记录整理成前端响应; 显式组装公开字段, 避免将内部配置或私
# [导读] 有信息整包返回。
# [导读] 结构: present_simulation。
# [导读] 提醒: 台词、逐轮评价与态势是不同结果; 分析失败不应丢掉已保存台词, 重试需尊重训练绑定的
# [导读] 配置和规则版本。
from __future__ import annotations

from sqlalchemy.orm import Session

from app.modules.simulation.models import SimulationSession
from app.modules.simulation.repository import SimulationRepository
from app.modules.simulation.schemas import (
    BriefingBeat,
    SimulationResponse,
)
from app.modules.simulation.state_service import SimulationStateService
from app.modules.simulation.turn_service import SimulationTurnService
from app.modules.training.models import Message


def present_simulation(db: Session, session: SimulationSession) -> SimulationResponse:
    repository = SimulationRepository(db)
    turns = []
    for item in repository.presentations(session.attempt_id):
        message = db.get(Message, item.assistant_message_id)
        if message is None or message.status != "completed":
            continue
        turns.append(SimulationTurnService.present(item, message.content))
    return SimulationResponse(
        attempt_id=session.attempt_id,
        profile_id=session.profile_id,
        profile_version=session.profile_version,
        character_id=session.character_id,
        display_name=session.display_name,
        scene_id=session.scene_id,
        asset_pack=session.asset_pack,
        asset_pack_version=session.asset_pack_version,
        briefing_status=session.briefing_status,
        briefing=[BriefingBeat.model_validate(item) for item in session.briefing_payload],
        briefing_hash=session.briefing_hash,
        turns=turns,
        state_history=[
            SimulationStateService.from_snapshot(item)
            for item in repository.snapshots(session.attempt_id)
        ],
        latest_state=SimulationStateService(db).current(session.attempt_id),
    )
