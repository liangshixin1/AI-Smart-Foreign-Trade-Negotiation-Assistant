/* [组件导读]
 * 业务名词：Attempt 是一次训练；仿真用逐段台词和角色演出呈现谈判，态势是根据原话证据计算的状态。
 * 用途：按可见字符逐步显示台词，并支持直接显示完整当前文本。
 * 为什么与边界：用字素分割保留 emoji 和组合字符；页面隐藏时暂停推进，减少动画偏好或不支持分割时直接全文显示。卸载要取消计时器。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'

export type PlaybackSpeed = 'slow' | 'standard' | 'fast' | 'instant'

const rates: Record<Exclude<PlaybackSpeed, 'instant'>, number> = {
  slow: 18,
  standard: 30,
  fast: 48,
}

// [导读] 按用户可见字素分割，避免拆开 emoji 或组合字符；不支持时返回 null 交给上层直接显示。
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

  // [导读] 清除上一次计时器，防止切文本或卸载后旧任务继续推进。
  function cancel(): void {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
  }

  function reveal(): void {
    cancel()
    visibleText.value = text.value
    typing.value = false
  }

  // [导读] 隐藏页面暂缓推进，正常显示时每次增加一个字素，再依据速度安排下一次调用。
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

  // [导读] 开始前取消旧任务；即时模式、减少动画偏好或无法安全分割时直接显示全文。
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
