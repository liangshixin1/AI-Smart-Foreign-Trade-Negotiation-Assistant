import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import MessageComposer from './MessageComposer.vue'

describe('MessageComposer', () => {
  it('only clears the draft after the server confirms success', async () => {
    const failedSend = vi.fn<(content: string) => Promise<boolean>>().mockResolvedValue(false)
    const wrapper = mount(MessageComposer, {
      props: { disabled: false, sending: false, sendMessage: failedSend },
    })
    const textarea = wrapper.get('textarea')
    await textarea.setValue('Please reconsider our target price.')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(failedSend).toHaveBeenCalledWith('Please reconsider our target price.')
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      'Please reconsider our target price.',
    )

    const successfulSend = vi.fn<(content: string) => Promise<boolean>>().mockResolvedValue(true)
    await wrapper.setProps({ sendMessage: successfulSend })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
  })
})
