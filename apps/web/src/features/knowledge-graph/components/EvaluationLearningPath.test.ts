import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { RoundEvaluation } from '@/features/training/types'

import EvaluationLearningPath from './EvaluationLearningPath.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
})

function evaluation(id: string, reason: string): RoundEvaluation {
  return {
    id,
    student_message_id: `${id}-student`,
    assistant_message_id: `${id}-assistant`,
    status: 'completed',
    score: 68,
    pros: '能够回应',
    cons: '条件交换不足',
    detailed_evaluation: '需要进一步练习。',
    next_step_suggestion: '学习条件让步。',
    checklist_results: [],
    recommendations: [
      {
        node_id: 'K047',
        node_type: 'strategy',
        title: '条件让步',
        confidence: 0.9,
        reason,
        reveal_level: 1,
      },
    ],
    model_name: 'mock',
    prompt_version: '1.0',
    created_at: '2026-09-03T10:00:00Z',
  }
}

describe('EvaluationLearningPath', () => {
  it('deduplicates repeated round recommendations and preserves latest guidance', async () => {
    await router.push('/student/attempts/a1/evaluation')
    const wrapper = mount(EvaluationLearningPath, {
      props: {
        evaluations: [evaluation('r1', '先建立交换意识。'), evaluation('r2', '控制让步幅度。')],
      },
      global: { plugins: [router] },
    })

    expect(wrapper.findAll('li')).toHaveLength(1)
    expect(wrapper.text()).toContain('连续 2 轮建议')
    expect(wrapper.text()).toContain('控制让步幅度')
    expect(wrapper.get('a').attributes('href')).toContain('source=evaluation')
  })
})
