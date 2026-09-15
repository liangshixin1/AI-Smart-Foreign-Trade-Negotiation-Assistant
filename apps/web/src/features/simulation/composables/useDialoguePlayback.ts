/* [组件导读]
 * 业务名词：Attempt 是一次训练；仿真用逐段台词和角色演出呈现谈判，态势是根据原话证据计算的状态。
 * 用途：管理一轮演出的段落索引、逐字显示和阅读完成状态。
 * 为什么与边界：推进先补全当前段文字，再进入下一段；演出编号变化才重置索引。showAll 仅补全当前段，不会自动跳过后续段落。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { computed, ref, watch, type Ref } from 'vue'

import type { SimulationBeat, SimulationPresentation } from '../types'
import { useTypewriter, type PlaybackSpeed } from './useTypewriter'

export function useDialoguePlayback(turn: Ref<SimulationPresentation | null>) {
  const beatIndex = ref(0)
  const speed = ref<PlaybackSpeed>('standard')
  const currentBeat = computed<SimulationBeat | null>(
    () => turn.value?.beats[beatIndex.value] ?? null,
  )
  const text = computed(() => currentBeat.value?.text ?? '')
  const typewriter = useTypewriter(text, speed)
  const complete = computed(
    () => beatIndex.value >= (turn.value?.beats.length ?? 1) - 1 && !typewriter.typing.value,
  )

  // [导读] 正在打字时仅补全当前段；当前段已读完才进入下一段，避免一次点击跳过未读台词。
  function advance(): void {
    if (typewriter.typing.value) {
      typewriter.reveal()
      return
    }
    if (beatIndex.value < (turn.value?.beats.length ?? 1) - 1) beatIndex.value += 1
  }

  // [导读] 只补全当前段的打字内容，不改变 beatIndex；调用方不能把它当成整轮全部已读。
  function showAll(): void {
    typewriter.reveal()
  }

  watch(
    () => turn.value?.presentation_id,
    () => {
      beatIndex.value = 0
    },
  )
  return {
    beatIndex,
    speed,
    currentBeat,
    visibleText: typewriter.visibleText,
    typing: typewriter.typing,
    complete,
    advance,
    showAll,
  }
}
