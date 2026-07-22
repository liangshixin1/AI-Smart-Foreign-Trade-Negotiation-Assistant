import { describe, expect, it } from 'vitest'

import { canRestoreChangeSet } from '@/features/technician/composables/useKnowledgeGraphImport'

describe('canRestoreChangeSet', () => {
  it('允许重复上传后恢复已评审或已发布的变更集', () => {
    expect(canRestoreChangeSet('review_ready')).toBe(true)
    expect(canRestoreChangeSet('approved')).toBe(true)
    expect(canRestoreChangeSet('published')).toBe(true)
    expect(canRestoreChangeSet('validation_failed')).toBe(false)
  })
})
