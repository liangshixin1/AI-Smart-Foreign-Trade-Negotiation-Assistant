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
    })

    expect(wrapper.text()).toContain('价格谈判')
    expect(wrapper.text()).toContain('展开提示 6 次')
    expect(wrapper.text()).toContain('3 名学生使用')
  })
})
