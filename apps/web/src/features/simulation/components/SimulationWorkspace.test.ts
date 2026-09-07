import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { ScenarioPublic, Attempt } from '@/features/training/types'

import SimulationWorkspace from './SimulationWorkspace.vue'
import type { SimulationSession } from '../types'

vi.mock('@/features/knowledge-graph/composables/useAttemptScaffold', () => ({
  useAttemptScaffold: () => ({
    scaffold: null,
    loading: false,
    error: null,
    interactingHintId: null,
    reload: vi.fn(),
    recordEvent: vi.fn(),
  }),
}))

const scenario: ScenarioPublic = {
  scenario_title: '首次还盘',
  scenario_summary: '围绕价格与数量谈判。',
  student_task: '提出有依据的还盘。',
  student_role: '买方',
  ai_role: 'David Lim',
  product: '显示模组',
  negotiation_targets: [],
  checklist: [],
  opening_message: '',
}
const attempt: Attempt & { scenario: ScenarioPublic } = {
  id: 'attempt-1',
  unit_id: 'chapter-3-section-1',
  unit_title: '价格还盘攻防',
  training_mode: 'negotiation',
  experience_mode: 'simulation',
  conversation_revision: 1,
  simulation_summary: null,
  status: 'in_progress',
  difficulty: 'standard',
  scenario,
  messages: [],
  round_evaluations: [],
  evaluation: null,
  draft_content: '',
  retry_of_attempt_id: null,
  created_at: '',
  updated_at: '',
}
const session: SimulationSession = {
  schema_version: 'simulation.session.v1',
  attempt_id: 'attempt-1',
  profile_id: 'price-counteroffer',
  profile_version: '1.0.0',
  character_id: 'david-lim',
  display_name: 'David Lim',
  scene_id: 'meeting-room-day',
  asset_pack: 'david-lim',
  asset_pack_version: 'v1-draft',
  briefing_status: 'ready',
  briefing: [],
  briefing_hash: 'hash',
  turns: [
    {
      schema_version: 'simulation.presentation.v1',
      presentation_id: 'turn-1',
      message_id: 'message-1',
      student_message_id: null,
      conversation_revision: 1,
      input_state_revision: 0,
      canonical_content: 'First sentence.\nSecond sentence.',
      canonical_text_hash: 'hash',
      character_id: 'david-lim',
      asset_pack_version: 'v1-draft',
      beats: [
        {
          id: 'beat-1',
          kind: 'speech',
          speaker_id: 'david-lim',
          text: 'First sentence.',
          expression: 'neutral',
          action: 'none',
        },
        {
          id: 'beat-2',
          kind: 'speech',
          speaker_id: 'david-lim',
          text: 'Second sentence.',
          expression: 'thinking',
          action: 'head_tilt',
        },
      ],
      created_at: '',
    },
  ],
  state_history: [],
  latest_state: {
    schema_version: 'simulation.state.v1',
    revision: 0,
    source_round_id: null,
    analysis_status: 'ready',
    trust: { value: 50, band: 'steady', delta: 0 },
    willingness: { value: 50, band: 'steady', delta: 0 },
    alignment: { value: 0, confirmed: 0, required: 3 },
    term_ledger: [],
    milestones: [],
    public_changes: [],
    commercial_outcome: 'negotiating',
    rules_version: '1.0.0',
  },
}

describe('simulation workspace', () => {
  it('preserves the draft and does not queue a send while dialogue remains unread', async () => {
    const sendMessage = vi.fn().mockResolvedValue(true)
    const wrapper = mount(SimulationWorkspace, {
      props: {
        attempt,
        session,
        sending: false,
        retryingAnalysis: false,
        sendMessage,
        draft: '',
        'onUpdate:draft': (value: string) => wrapper.setProps({ draft: value }),
      },
      global: {
        stubs: {
          CharacterStage: true,
          NegotiationStatusBar: true,
          TrainingKnowledgeScaffold: true,
        },
      },
    })
    const textarea = wrapper.get('textarea')
    await textarea.setValue('Could you consider USD 278?')
    await wrapper.get('form').trigger('submit')
    expect(sendMessage).not.toHaveBeenCalled()
    expect((textarea.element as HTMLTextAreaElement).value).toBe('Could you consider USD 278?')
    expect(wrapper.text()).toContain('草稿已保留')
  })

  it('does not submit or advance when an IME composition confirms with Enter', async () => {
    const sendMessage = vi.fn().mockResolvedValue(true)
    const wrapper = mount(SimulationWorkspace, {
      props: {
        attempt,
        session,
        sending: false,
        retryingAnalysis: false,
        sendMessage,
        draft: '',
        'onUpdate:draft': (value: string) => wrapper.setProps({ draft: value }),
      },
      global: {
        stubs: {
          CharacterStage: true,
          NegotiationStatusBar: true,
          TrainingKnowledgeScaffold: true,
        },
      },
    })
    await wrapper.get('textarea').setValue('Draft reply')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter', isComposing: true })
    expect(sendMessage).not.toHaveBeenCalled()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('Draft reply')
    expect(wrapper.find('.speech').text()).not.toContain('Second sentence.')
  })
})
