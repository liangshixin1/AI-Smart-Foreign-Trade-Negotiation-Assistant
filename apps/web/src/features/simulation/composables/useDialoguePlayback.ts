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

  function advance(): void {
    if (typewriter.typing.value) {
      typewriter.reveal()
      return
    }
    if (beatIndex.value < (turn.value?.beats.length ?? 1) - 1) beatIndex.value += 1
  }

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
