import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TrainingWorkspaceShell from './TrainingWorkspaceShell.vue'
import type { Attempt, ScenarioPublic } from '../types'

vi.mock('@/features/knowledge-graph', () => ({
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
  scenario_title: '实盘谈判',
  scenario_summary: '核对交易条款',
  student_task: '提出还盘',
  student_role: '买方',
  ai_role: '卖方',
  product: '显示模组',
  negotiation_targets: [],
  checklist: [],
  opening_message: '',
}
const attempt: Attempt & { scenario: ScenarioPublic } = {
  id: 'test-attempt',
  unit_id: 'offer',
  unit_title: '实盘',
  training_mode: 'negotiation',
  experience_mode: 'chat',
  conversation_revision: 0,
  simulation_summary: null,
  status: 'in_progress',
  difficulty: 'normal',
  scenario,
  messages: [],
  round_evaluations: [],
  evaluation: null,
  draft_content: '',
  retry_of_attempt_id: null,
  created_at: '',
  updated_at: '',
}

describe('responsive training panels', () => {
  it('keeps the same composer and unsent text across panel switches without sending', async () => {
    const sendMessage = vi.fn().mockResolvedValue(true)
    const wrapper = mount(TrainingWorkspaceShell, {
      props: {
        attempt,
        draft: '',
        sending: false,
        sendMessage,
        'onUpdate:draft': (draft: string) => wrapper.setProps({ draft }),
      },
      global: {
        stubs: { ScenarioBrief: true, ConversationTimeline: true, TrainingChecklist: true },
      },
    })
    const textarea = wrapper.get('textarea')
    await textarea.setValue('Could you offer a volume discount?')
    const panels = wrapper.findAll('.mobile-panels button')
    await panels[2]?.trigger('click')
    expect(wrapper.classes()).toContain('mobile-support')
    expect(panels[2]?.attributes('aria-pressed')).toBe('true')
    await panels[0]?.trigger('click')
    await panels[1]?.trigger('click')
    expect(wrapper.get('textarea').element).toBe(textarea.element)
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      'Could you offer a volume discount?',
    )
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
