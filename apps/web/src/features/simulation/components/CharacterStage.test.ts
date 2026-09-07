import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CharacterStage from './CharacterStage.vue'

describe('simulation character stage', () => {
  it('falls back from a missing expression to neutral, then to an identity-safe silhouette', async () => {
    const wrapper = mount(CharacterStage, {
      props: { displayName: 'David Lim', expression: 'pleased', action: 'none' },
    })
    expect(wrapper.get('.portrait').attributes('src')).toContain('/pleased.webp')
    await wrapper.get('.portrait').trigger('error')
    expect(wrapper.get('.portrait').attributes('src')).toContain('/neutral.webp')
    await wrapper.get('.portrait').trigger('error')
    expect(wrapper.find('.portrait').exists()).toBe(false)
    expect(wrapper.get('.portrait-fallback').attributes('aria-label')).toContain('David Lim')
  })

  it('keeps the stage usable when its background is missing', async () => {
    const wrapper = mount(CharacterStage, {
      props: { displayName: 'David Lim', expression: 'neutral', action: 'head_tilt' },
    })
    await wrapper.get('.background').trigger('error')
    expect(wrapper.find('.background').exists()).toBe(false)
    expect(wrapper.get('.stage').classes()).toContain('action-head_tilt')
    expect(wrapper.get('.portrait').isVisible()).toBe(true)
  })
})
