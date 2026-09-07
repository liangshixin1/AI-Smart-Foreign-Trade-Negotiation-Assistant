import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useStartAttempt } from './useStartAttempt'

const mocks = vi.hoisted(() => ({
  createAttempt: vi.fn(),
  push: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('@/features/auth/stores/auth', () => ({
  useAuthStore: () => ({ accessToken: 'test-token' }),
}))

vi.mock('../api/trainingApi', () => ({
  createAttempt: mocks.createAttempt,
}))

describe('attempt creation recovery', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    })
    mocks.createAttempt.mockReset()
    mocks.push.mockReset()
  })

  afterEach(() => vi.unstubAllGlobals())

  it('does not navigate into a failed scenario attempt', async () => {
    mocks.createAttempt.mockResolvedValue({
      id: 'failed-attempt',
      status: 'generation_failed',
      scenario: null,
    })
    const { start, startError } = useStartAttempt('chapter-3-section-1')

    await start('standard', 'chat')

    expect(mocks.push).not.toHaveBeenCalled()
    expect(startError.value).toContain('场景生成未完成')
  })
})
