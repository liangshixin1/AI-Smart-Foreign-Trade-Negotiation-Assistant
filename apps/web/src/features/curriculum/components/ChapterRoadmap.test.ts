import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { RouterLinkStub } from '@vue/test-utils'
import ChapterRoadmap from './ChapterRoadmap.vue'
import type { UnitMapItem } from '../types'

function unit(id: string, status: string): UnitMapItem {
  return {
    id,
    title: id,
    description: '练习',
    training_mode: 'negotiation',
    estimated_minutes: 20,
    status,
    sort_order: 1,
    active_attempt_id: status === 'in_progress' ? 'saved-attempt' : null,
  }
}

describe('chapter navigation', () => {
  it('expands ongoing work, preserves resume targets, and keeps locked units unlinked', () => {
    const wrapper = mount(ChapterRoadmap, {
      props: {
        chapters: [
          { id: 'first', title: '第一章', sort_order: 1, units: [unit('done', 'completed')] },
          {
            id: 'current',
            title: '第二章',
            sort_order: 2,
            units: [unit('current', 'in_progress')],
          },
          { id: 'future', title: '第三章', sort_order: 3, units: [unit('locked', 'locked')] },
        ],
      },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    const chapters = wrapper.findAll('details')
    expect(chapters[1]?.attributes('open')).toBeDefined()
    expect(chapters[2]?.attributes('open')).toBeUndefined()
    expect(chapters[2]?.find('a').exists()).toBe(false)
    const links = wrapper.findAllComponents(RouterLinkStub)
    expect(links[1]?.props('to')).toBe('/student/attempts/saved-attempt')
  })
})
