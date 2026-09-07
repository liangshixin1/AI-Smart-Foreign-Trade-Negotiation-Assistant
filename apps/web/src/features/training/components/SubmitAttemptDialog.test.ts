import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SubmitAttemptDialog from './SubmitAttemptDialog.vue'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false
  })
})

describe('submission confirmation', () => {
  it('supports cancellation but blocks dismissal while submitting', async () => {
    const wrapper = mount(SubmitAttemptDialog, { props: { open: false, submitting: false } })
    await wrapper.setProps({ open: true })
    expect((wrapper.get('dialog').element as HTMLDialogElement).open).toBe(true)
    await wrapper.get('dialog').trigger('cancel')
    expect(wrapper.emitted('close')).toHaveLength(1)
    await wrapper.setProps({ submitting: true })
    await wrapper.get('dialog').trigger('cancel')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
    await wrapper.setProps({ open: false })
    expect((wrapper.get('dialog').element as HTMLDialogElement).open).toBe(false)
  })
})
