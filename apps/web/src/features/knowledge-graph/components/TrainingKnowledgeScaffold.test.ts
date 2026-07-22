import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { AttemptScaffold } from '../types'
import TrainingKnowledgeScaffold from './TrainingKnowledgeScaffold.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
})

function mountScaffold(
  props: InstanceType<typeof TrainingKnowledgeScaffold>['$props'],
): ReturnType<typeof mount> {
  return mount(TrainingKnowledgeScaffold, { props, global: { plugins: [router] } })
}

const scaffold: AttemptScaffold = {
  attempt_id: 'attempt-1',
  unit_id: 'unit-1',
  graph_version: 'kg-1',
  scenario: null,
  phenomena: [
    {
      id: 'p1',
      type: 'phenomenon',
      source_type: 'Phenomenon',
      label: '客户压价',
      properties: { cue: '客户以竞品报价要求降价。' },
    },
  ],
  knowledge_resources: [
    {
      id: 'k1',
      type: 'knowledge_resource',
      source_type: 'KnowledgeResource',
      label: '价格构成',
      properties: { Summary: '理解报价中的成本与利润空间。' },
    },
  ],
  strategies: [
    {
      id: 's1',
      type: 'strategy',
      source_type: 'Strategy',
      label: '条件让步',
      properties: { Summary: '让步必须换取对方的对等承诺。' },
    },
  ],
  scaffolds: [
    {
      id: 'hint-1',
      phenomenon_id: 'p1',
      level: '一级',
      trigger: '不知道如何回应时',
      content: null,
      revealed: false,
      used: false,
    },
  ],
  edges: [],
}

describe('TrainingKnowledgeScaffold', () => {
  it('requires the student to reveal a graded hint explicitly', async () => {
    const wrapper = mountScaffold({
      scaffold,
      loading: false,
      error: null,
      interactingHintId: null,
      recommendations: [],
    })

    expect(wrapper.text()).not.toContain('提示正文')
    await wrapper.get('.hint-group summary').trigger('click')
    await wrapper.get('.hint button').trigger('click')
    expect(wrapper.emitted('reveal-hint')?.[0]?.[0]).toMatchObject({ id: 'hint-1' })
  })

  it('lets the student mark a revealed hint as used', async () => {
    const hint = scaffold.scaffolds[0]
    if (!hint) throw new Error('Fixture must include a hint')
    const revealed = {
      ...scaffold,
      scaffolds: [{ ...hint, revealed: true, content: '先询问降价条件。' }],
    }
    const wrapper = mountScaffold({
      scaffold: revealed,
      loading: false,
      error: null,
      interactingHintId: null,
      recommendations: [],
    })

    await wrapper.get('.hint-group summary').trigger('click')
    expect(wrapper.text()).toContain('先询问降价条件。')
    await wrapper.get('.hint button').trigger('click')
    expect(wrapper.emitted('use-hint')?.[0]?.[0]).toMatchObject({ id: 'hint-1' })
  })

  it('keeps all support groups collapsed and shows their counts by default', () => {
    const wrapper = mountScaffold({
      scaffold,
      loading: false,
      error: null,
      interactingHintId: null,
      recommendations: [],
    })

    expect(wrapper.findAll('details')).toHaveLength(3)
    expect(
      wrapper.findAll('details').every((details) => details.attributes('open') === undefined),
    ).toBe(true)
    expect(wrapper.text()).toContain('知识资源')
    expect(wrapper.text()).toContain('策略技巧')
    expect(wrapper.text()).toContain('线索提示')
    expect(wrapper.find('.knowledge-group .group-count').text()).toBe('1')
    expect(wrapper.find('.strategy-group .group-count').text()).toBe('1')
    expect(wrapper.find('.hint-group .group-count').text()).toBe('1')
  })

  it('highlights only the latest round selections without removing fixed candidates', async () => {
    const wrapper = mountScaffold({
      scaffold,
      loading: false,
      error: null,
      interactingHintId: null,
      recommendations: [
        {
          node_id: 's1',
          node_type: 'strategy',
          title: '条件让步',
          confidence: 0.92,
          reason: '学生已经开始讨论价格，需要用条件交换控制让步幅度。',
          reveal_level: 1,
        },
      ],
    })

    await wrapper.get('.knowledge-group summary').trigger('click')
    await wrapper.get('.strategy-group summary').trigger('click')
    expect(wrapper.findAll('li')).toHaveLength(2)
    expect(wrapper.find('.knowledge-group li').classes()).not.toContain('recommended')
    expect(wrapper.find('.strategy-group li').classes()).toContain('recommended')
    expect(wrapper.find('.strategy-group').text()).toContain('本轮建议')
    expect(wrapper.find('.strategy-group').text()).toContain('需要用条件交换控制让步幅度')
  })
})
