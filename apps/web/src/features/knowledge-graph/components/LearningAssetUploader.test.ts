import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LearningAssetUploader from './LearningAssetUploader.vue'

describe('LearningAssetUploader', () => {
  it('emits the selected PPTX file for controlled upload', async () => {
    const wrapper = mount(LearningAssetUploader, {
      props: { kind: 'slides', asset: null, busy: false },
    })
    const file = new File(['pptx'], 'CIF-theory.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })

    await input.trigger('change')

    expect(wrapper.emitted('upload')).toEqual([['slides', file]])
  })

  it('rejects legacy PPT before calling the API', async () => {
    const wrapper = mount(LearningAssetUploader, {
      props: { kind: 'slides', asset: null, busy: false },
    })
    const file = new File(['ppt'], 'legacy.ppt', { type: 'application/vnd.ms-powerpoint' })
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })

    await input.trigger('change')

    expect(wrapper.emitted('upload')).toBeUndefined()
    expect(wrapper.get('[role="alert"]').text()).toContain('PPTX')
  })
})
