/* [组件导读]
 * 业务名词：Attempt 是一次训练；仿真用逐段台词和角色演出呈现谈判，态势是根据原话证据计算的状态。
 * 用途：管理仿真会话、逐轮演出和最新谈判态势。
 * 为什么与边界：演出按编号替换避免重复，态势按 revision 拒绝旧结果；补做分析复用已保存台词，不重新生成对手回复。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
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

  // [导读] 按 presentation_id 更新或追加，避免重放同一事件时出现两份演出。
  function applyPresentation(presentation: SimulationPresentation): void {
    if (!session.value) return
    const index = session.value.turns.findIndex(
      (item) => item.presentation_id === presentation.presentation_id,
    )
    if (index >= 0) session.value.turns[index] = presentation
    else session.value.turns.push(presentation)
  }

  // [导读] 拒绝比当前 revision 更旧的态势响应，防止异步回执把状态倒退。
  function applyState(state: SimulationState): void {
    if (!session.value || state.revision < session.value.latest_state.revision) return
    session.value.latest_state = state
  }

  // [导读] 寻找最近的非开场轮次，只请求补做态势分析，不重新生成已保存台词。
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
