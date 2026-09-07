import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'

export type PlaybackSpeed = 'slow' | 'standard' | 'fast' | 'instant'

const rates: Record<Exclude<PlaybackSpeed, 'instant'>, number> = {
  slow: 18,
  standard: 30,
  fast: 48,
}

export function splitGraphemes(text: string): string[] | null {
  if (typeof Intl.Segmenter !== 'function') return null
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return [...segmenter.segment(text)].map((item) => item.segment)
}

export function useTypewriter(text: Ref<string>, speed: Ref<PlaybackSpeed>) {
  const visibleText = ref('')
  const typing = ref(false)
  let timer: number | null = null
  let cursor = 0
  let graphemes: string[] = []

  function cancel(): void {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
  }

  function reveal(): void {
    cancel()
    visibleText.value = text.value
    typing.value = false
  }

  function tick(): void {
    if (document.hidden) {
      timer = window.setTimeout(tick, 120)
      return
    }
    cursor += 1
    visibleText.value = graphemes.slice(0, cursor).join('')
    if (cursor >= graphemes.length) {
      typing.value = false
      timer = null
      return
    }
    timer = window.setTimeout(tick, 1000 / rates[speed.value as Exclude<PlaybackSpeed, 'instant'>])
  }

  function start(): void {
    cancel()
    cursor = 0
    const segmented = splitGraphemes(text.value)
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (speed.value === 'instant' || segmented === null || reducedMotion) {
      reveal()
      return
    }
    graphemes = segmented
    visibleText.value = ''
    typing.value = graphemes.length > 0
    if (typing.value) tick()
  }

  watch(text, start, { immediate: true })
  onBeforeUnmount(cancel)
  return { visibleText, typing: computed(() => typing.value), reveal, restart: start }
}
