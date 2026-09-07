import { describe, expect, it } from 'vitest'

import { splitGraphemes } from './useTypewriter'

describe('simulation grapheme playback', () => {
  it('keeps emoji and combining characters intact', () => {
    expect(splitGraphemes('A👨‍👩‍👧‍👦é')).toEqual(['A', '👨‍👩‍👧‍👦', 'é'])
  })

  it('falls back to whole-line playback when Segmenter is unavailable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Segmenter')
    Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: undefined })
    expect(splitGraphemes('完整一句')).toBeNull()
    if (descriptor) Object.defineProperty(Intl, 'Segmenter', descriptor)
  })
})
