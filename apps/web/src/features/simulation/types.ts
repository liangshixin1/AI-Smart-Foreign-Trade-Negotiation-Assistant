export type SimulationExpression = 'neutral' | 'thinking' | 'pleased' | 'frustrated' | 'confused'
export type SimulationAction = 'none' | 'nod' | 'head_tilt'

export interface SimulationBeat {
  id: string
  kind: 'speech'
  speaker_id: 'david-lim'
  text: string
  expression: SimulationExpression
  action: SimulationAction
}

export interface BriefingBeat {
  id: string
  kind: 'narration'
  speaker_id: 'narrator'
  rendered_text: string
  fact_refs: string[]
  scene_id: 'meeting-room-day'
  character_id: 'david-lim'
  expression: SimulationExpression
  action: SimulationAction
}

export interface SimulationPresentation {
  schema_version: 'simulation.presentation.v1'
  presentation_id: string
  message_id: string
  student_message_id: string | null
  conversation_revision: number
  input_state_revision: number
  canonical_content: string
  canonical_text_hash: string
  character_id: string
  asset_pack_version: string
  beats: SimulationBeat[]
  created_at: string
}

export interface SimulationMetric {
  value: number
  band: 'cautious' | 'steady' | 'positive'
  delta: number
}

export interface SimulationState {
  schema_version: 'simulation.state.v1'
  revision: number
  source_round_id: string | null
  analysis_status: 'ready' | 'pending' | 'failed'
  trust: SimulationMetric
  willingness: SimulationMetric
  alignment: { value: number; confirmed: number; required: number }
  term_ledger: Array<Record<string, unknown>>
  milestones: Array<{ key: string; status: 'pending' | 'evidenced'; message_ids: string[] }>
  public_changes: Array<{
    label: string
    reason: string
    event_id: string
    evidence: Array<{ message_id: string; quote: string }>
  }>
  commercial_outcome: 'negotiating' | 'provisional_agreement' | 'paused' | 'no_agreement'
  rules_version: string
}

export interface SimulationSession {
  schema_version: 'simulation.session.v1'
  attempt_id: string
  profile_id: string
  profile_version: string
  character_id: string
  display_name: string
  scene_id: string
  asset_pack: string
  asset_pack_version: string
  briefing_status: string
  briefing: BriefingBeat[]
  briefing_hash: string
  turns: SimulationPresentation[]
  state_history: SimulationState[]
  latest_state: SimulationState
}
