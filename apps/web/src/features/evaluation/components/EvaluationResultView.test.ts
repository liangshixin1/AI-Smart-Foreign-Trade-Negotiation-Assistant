import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { EvaluationResult } from '@/features/training/types'

import EvaluationResultView from './EvaluationResultView.vue'

describe('EvaluationResultView', () => {
  it('shows the conclusion, dimension, exact evidence and model provenance', () => {
    const evaluation: EvaluationResult = {
      id: 'evaluation-1',
      overall_score: 72,
      level: 'competent',
      summary: '能够提出有依据的还盘。',
      strengths: ['表达清晰'],
      improvements: ['量化交换条件'],
      next_actions: ['绑定数量和付款条件'],
      knowledge_tags: ['counter-offer'],
      model_name: 'deepseek-v4-flash',
      prompt_version: '1.1.0',
      evaluation_status: 'completed',
      created_at: '2026-07-14T00:00:00Z',
      dimensions: [
        {
          dimension_key: 'negotiation_strategy',
          label: '谈判策略',
          score: 72,
          weight: 0.3,
          comment: '能够提出条件。',
          evidence: [
            {
              message_id: 'message-1',
              quote: 'Could you consider USD 278?',
              reason: '提出了明确价格。',
            },
          ],
        },
      ],
    }
    const wrapper = mount(EvaluationResultView, { props: { evaluation } })
    expect(wrapper.text()).toContain('72/100')
    expect(wrapper.text()).toContain('Could you consider USD 278?')
    expect(wrapper.text()).toContain('deepseek-v4-flash')
    expect(wrapper.text()).toContain('1.1.0')
  })
})
