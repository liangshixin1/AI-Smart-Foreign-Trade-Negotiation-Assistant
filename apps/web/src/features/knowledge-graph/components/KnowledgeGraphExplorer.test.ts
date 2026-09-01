import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { KnowledgeGraphView } from '../types'
import KnowledgeGraphExplorer from './KnowledgeGraphExplorer.vue'

const graph: KnowledgeGraphView = {
  graph_version: 'kg-test',
  node_count: 4,
  edge_count: 3,
  nodes: [
    {
      id: 'stage:S2',
      type: 'stage',
      source_type: 'Stage',
      label: '发盘',
      short_label: '发盘',
      properties: { Sequence: 2, StageNameEN: 'Offer' },
    },
    {
      id: 'scenario:S04',
      type: 'scenario',
      source_type: 'Scenario',
      label: 'Identifying a Non-Firm Offer and Pushing for a Firm Offer',
      short_label: '识别虚盘并催实盘',
      properties: { CourseUnit: '流程 2 · 报盘｜应对虚盘' },
    },
    {
      id: 'phenomenon:P0401',
      type: 'phenomenon',
      source_type: 'Phenomenon',
      label: 'Recognise a non-firm offer and the risk of treating it as binding.',
      short_label: '将虚盘误作实盘',
      properties: { BusinessConsequence: '买方可能基于不可依赖的价格作出决策。' },
    },
    {
      id: 'knowledge:K005',
      type: 'knowledge_point',
      source_type: 'KnowledgePoint',
      knowledge_type: 'Strategy',
      label: 'Broad inquiry strategy',
      short_label: '宽泛询盘',
      properties: { KnowledgeTypeCode: 'Strategy', DefinitionZH: '用低承诺询盘摸清市场。' },
    },
  ],
  edges: [
    {
      id: 'edge-stage-scenario',
      source: 'stage:S2',
      target: 'scenario:S04',
      type: 'CONTAINS_SCENARIO',
      properties: {},
    },
    {
      id: 'edge-k',
      source: 'phenomenon:P0401',
      target: 'knowledge:K005',
      type: 'REQUIRES_KNOWLEDGE',
      properties: {},
    },
    {
      id: 'edge-1',
      source: 'scenario:S04',
      target: 'phenomenon:P0401',
      type: 'EXPOSES',
      properties: {},
    },
  ],
}

describe('KnowledgeGraphExplorer', () => {
  it('shows scenarios and opens node details in a dialog with both names', async () => {
    const wrapper = mount(KnowledgeGraphExplorer, {
      props: { graph },
      global: {
        stubs: {
          KnowledgeGraphCanvas: {
            emits: ['select'],
            template:
              '<button data-test="select-node" @click="$emit(\'select\', \'scenario:S04\')">选择</button>',
          },
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })

    expect(wrapper.text()).toContain('一级主题')
    expect(wrapper.text()).toContain('训练场景')
    expect(wrapper.text()).toContain('知识点类型')
    expect(wrapper.text()).toContain('策略战术')
    expect(wrapper.text()).toContain('选择一个节点，查看它与一级主题')
    await wrapper.get('[data-test="select-node"]').trigger('click')

    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.text()).toContain('识别虚盘并催实盘')
    expect(dialog.text()).toContain('Identifying a Non-Firm Offer')
    expect(dialog.text()).toContain('将虚盘误作实盘')
  })

  it('lets the teacher preview and submit a display-only short name change', async () => {
    const wrapper = mount(KnowledgeGraphExplorer, {
      props: { graph, editableDisplay: true },
      global: {
        stubs: {
          KnowledgeGraphCanvas: {
            emits: ['select'],
            template:
              '<button data-test="select-node" @click="$emit(\'select\', \'scenario:S04\')">选择</button>',
          },
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })

    await wrapper.get('[data-test="select-node"]').trigger('click')
    await wrapper.get('.edit-button').trigger('click')
    await wrapper.get('#node-short-name').setValue('虚盘识别与催实盘')
    expect(wrapper.text()).toContain('图谱预览')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('save-display')).toEqual([['scenario:S04', '虚盘识别与催实盘', 0]])
  })
})
