import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { LearningDiagnostic, RoundLearningDiagnostic } from '../api/teacherApi'
import LearnerDevelopmentDiagnostic from './LearnerDevelopmentDiagnostic.vue'

const diagnostic: LearningDiagnostic = {
  framework_version: 'zpd-da-v1',
  learner_stage: 'developing',
  challenge_level: 2,
  support_level: 'guided_choice',
  negotiation_style: 'collaborative',
  adaptability_summary: '能够回应新条件，但仍需要引导完成多条件交换。',
  dimensions: [
    'domain_knowledge',
    'language_control',
    'negotiation_strategy',
    'adaptability',
    'intercultural_pragmatics',
    'self_regulation',
  ].map((dimension_key) => ({
    dimension_key: dimension_key as LearningDiagnostic['dimensions'][number]['dimension_key'],
    score: 68,
    judgment: '在引导下能够完成基础任务。',
    evidence: [
      {
        message_id: 'message-1',
        quote: 'Could you offer USD 278 if we increase the order?',
        interpretation: '能够提出条件交换。',
      },
    ],
  })),
  knowledge_mastery: [{ knowledge_point: '条件交换', status: 'developing', evidence: [] }],
  next_stretch_target: '独立组成多条件交换方案。',
  mediation_strategy: '先给出二选一条件，再撤除提示。',
  confidence: 0.82,
}

const rounds: RoundLearningDiagnostic[] = [
  {
    round_evaluation_id: 'round-1',
    student_message_id: 'message-1',
    created_at: '2026-07-22T09:00:00+08:00',
    diagnostic,
  },
]

describe('LearnerDevelopmentDiagnostic', () => {
  it('renders the teacher-only final profile and round trajectory', () => {
    const wrapper = mount(LearnerDevelopmentDiagnostic, {
      props: { rounds, finalDiagnostic: diagnostic },
    })

    expect(wrapper.text()).toContain('仅教师可见')
    expect(wrapper.text()).toContain('持续发展')
    expect(wrapper.text()).toContain('引导选择')
    expect(wrapper.text()).toContain('谈判策略')
    expect(wrapper.text()).toContain('条件交换')
    expect(wrapper.text()).toContain('查看 1 轮发展轨迹')
  })
})
