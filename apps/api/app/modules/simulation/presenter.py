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
