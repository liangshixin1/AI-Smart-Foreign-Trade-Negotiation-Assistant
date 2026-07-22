import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { RoundEvaluation } from '../types'
import RoundFeedbackCard from './RoundFeedbackCard.vue'

const evaluation: RoundEvaluation = {
  id: 'evaluation-1',
  student_message_id: 'student-message-1',
  assistant_message_id: 'assistant-message-1',
  status: 'completed',
  score: 82,
  pros: '能够说明报价依据。',
  cons: '尚未提出交换条件。',
  detailed_evaluation: '表达清晰，但需要把让步与订单数量绑定。',
  next_step_suggestion: '先确认采购量，再提出阶梯报价。',
  checklist_results: [],
  recommendations: [
    {
      node_id: 'strategy-1',
      node_type: 'strategy',
      title: '条件让步',
      confidence: 0.91,
      reason: '当前对话进入价格交换阶段。',
      reveal_level: 1,
    },
  ],
  model_name: 'deepseek-chat',
  prompt_version: 'round-evaluation-v1',
  created_at: '2026-07-22T09:00:00+08:00',
}

describe('RoundFeedbackCard', () => {
  it('keeps the dialogue area focused on feedback instead of repeating learning support', () => {
    const wrapper = mount(RoundFeedbackCard, { props: { evaluation } })

    expect(wrapper.text()).toContain('本轮即时反馈')
    expect(wrapper.text()).toContain('下一步')
    expect(wrapper.text()).not.toContain('本轮智能补给')
    expect(wrapper.text()).not.toContain('条件让步')
  })
})
