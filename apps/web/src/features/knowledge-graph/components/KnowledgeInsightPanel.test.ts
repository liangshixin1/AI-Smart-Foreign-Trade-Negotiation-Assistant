import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import KnowledgeInsightPanel from './KnowledgeInsightPanel.vue'

describe('KnowledgeInsightPanel', () => {
  it('shows scaffold dependency alongside weak-unit evidence', () => {
    const wrapper = mount(KnowledgeInsightPanel, {
      props: {
        loading: false,
        error: null,
        insights: {
          scope: 'classroom',
          scope_id: 'class-1',
          graph_version: 'kg-1',
          completed_attempts: 9,
          average_score: 72,
          evidence_rounds: 5,
          students_with_evidence: 3,
          learning_views: 7,
          learning_completions: 2,
          stage_insights: [
            {
              node_id: 'stage-1',
              label: '询盘',
              evidence_count: 5,
              attempt_count: 3,
              student_count: 3,
              average_score: 63,
              needs_attention: true,
            },
          ],
          phenomenon_insights: [
            {
              node_id: 'p1',
              label: '客户压价',
              stage_id: 'stage-1',
              stage_label: '询盘',
              evidence_count: 5,
              attempt_count: 3,
              student_count: 3,
              average_score: 63,
              needs_attention: true,
              scaffold_reveal_count: 6,
              scaffold_use_count: 4,
            },
          ],
          knowledge_insights: [
            {
              node_id: 'k1',
              label: '锚定策略',
              node_type: 'KnowledgePoint',
              knowledge_type: 'Strategy',
              evidence_count: 5,
              attempt_count: 3,
              student_count: 3,
              average_score: 63,
              needs_attention: true,
              recommendation_count: 4,
              content_view_count: 7,
              content_completion_count: 2,
              last_activity_at: null,
            },
          ],
          weak_units: [
            {
              unit_id: 'unit-1',
              unit_title: '价格谈判',
              attempt_count: 5,
              average_score: 63,
              needs_attention: true,
              phenomenon_ids: ['p1'],
              knowledge_resource_ids: ['k1', 'k2'],
              strategy_ids: ['s1'],
              knowledge_point_ids: ['k1', 'k2', 's1'],
              knowledge_type_breakdown: { Concept: 2, Strategy: 1 },
              scaffold_reveal_count: 6,
              scaffold_use_count: 4,
              students_using_scaffolds: 3,
            },
          ],
        },
      },
      global: {
        stubs: {
          TeacherKnowledgeAnalyticsGraph: { template: '<div data-test="teacher-graph" />' },
        },
      },
    })

    expect(wrapper.text()).toContain('锚定策略')
    expect(wrapper.text()).toContain('客户压价')
    expect(wrapper.text()).toContain('展开提示 6 次')
    expect(wrapper.text()).toContain('学习完成 2 次')
  })
})
