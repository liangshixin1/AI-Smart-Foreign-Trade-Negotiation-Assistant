import { onMounted, ref, watch, type Ref } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'

import { getSimulation, retrySimulationAnalysis } from '../api/simulationApi'
import type { SimulationPresentation, SimulationSession, SimulationState } from '../types'

export function useSimulationSession(attemptId: string, enabled?: Ref<boolean>) {
  const auth = useAuthStore()
  const session = ref<SimulationSession | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const retryingAnalysis = ref(false)

  async function reload(): Promise<void> {
    if (enabled && !enabled.value) {
      loading.value = false
      return
    }
    if (!auth.accessToken) return
    loading.value = true
    error.value = null
    try {
      session.value = await getSimulation(auth.accessToken, attemptId)
    } catch (caught: unknown) {
      error.value = caught instanceof Error ? caught.message : '仿真记录加载失败。'
    } finally {
      loading.value = false
    }
  }

  function applyPresentation(presentation: SimulationPresentation): void {
    if (!session.value) return
    const index = session.value.turns.findIndex(
      (item) => item.presentation_id === presentation.presentation_id,
    )
    if (index >= 0) session.value.turns[index] = presentation
    else session.value.turns.push(presentation)
  }

  function applyState(state: SimulationState): void {
    if (!session.value || state.revision < session.value.latest_state.revision) return
    session.value.latest_state = state
  }

  async function retryAnalysis(): Promise<void> {
    if (!auth.accessToken || !session.value || retryingAnalysis.value) return
    const turn = [...session.value.turns].reverse().find((item) => item.student_message_id)
    if (!turn) return
    retryingAnalysis.value = true
    error.value = null
    try {
      session.value = await retrySimulationAnalysis(auth.accessToken, attemptId, turn.message_id)
    } catch (caught: unknown) {
      error.value = caught instanceof Error ? caught.message : '态势分析重试失败。'
    } finally {
      retryingAnalysis.value = false
    }
  }

  onMounted(reload)
  if (enabled) {
    watch(enabled, (value, previous) => {
      if (value && !previous) void reload()
    })
  }
  return {
    session,
    loading,
    error,
    retryingAnalysis,
    reload,
    retryAnalysis,
    applyPresentation,
    applyState,
  }
}
