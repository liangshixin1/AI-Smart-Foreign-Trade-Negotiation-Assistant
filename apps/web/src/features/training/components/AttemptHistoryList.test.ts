import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AttemptHistoryList from './AttemptHistoryList.vue'

vi.mock('../composables/useAttemptHistory', () => ({
  useAttemptHistory: () => ({
    items: [
      {
        id: 'failed-attempt',
        unit_id: 'chapter-3-section-1',
        unit_title: '价格还盘攻防',
        training_mode: 'negotiation',
        experience_mode: 'chat',
        status: 'generation_failed',
        overall_score: null,
        retry_of_attempt_id: null,
        created_at: '2026-09-07T12:00:00Z',
        updated_at: '2026-09-07T12:00:00Z',
      },
    ],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}))

describe('attempt history recovery', () => {
  it('routes a failed scenario back to its preparation page instead of a blank workspace', () => {
    const wrapper = mount(AttemptHistoryList, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    })

    expect(wrapper.text()).toContain('场景生成失败')
    expect(wrapper.text()).toContain('重新开始')
    expect(wrapper.getComponent(RouterLinkStub).props('to')).toBe(
      '/student/units/chapter-3-section-1',
    )
  })
})
