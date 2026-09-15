import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GraphNodeDialog from './GraphNodeDialog.vue'
import type { KnowledgeGraphNode, KnowledgeNodeType } from '../types'

describe('node learning entry', () => {
  it.each<KnowledgeNodeType>(['stage', 'phenomenon', 'knowledge_point'])(
    'opens independent content for %s',
    (type) => {
      const node = {
        id: `${type}:one`,
        type,
        label: '节点',
        short_label: '节点',
        properties: {},
      } as KnowledgeGraphNode
      const wrapper = mount(GraphNodeDialog, {
        props: { node, neighbors: [], contentBase: '/student/knowledge/' },
        global: {
          stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
        },
      })
      expect(wrapper.get('a.content-link').attributes('href')).toBe(
        `/student/knowledge/${encodeURIComponent(node.id)}`,
      )
      wrapper.unmount()
    },
  )
})
