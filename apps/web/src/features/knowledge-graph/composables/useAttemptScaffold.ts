/* [组件导读]
 * 业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
 * 用途：读取本次训练的固定支持库，并记录查看或使用提示的行为。
 * 为什么与边界：失败重试保留同一客户端事件编号，成功后才移除，避免重复计数；提示记录与模型评价是两类证据。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { onMounted, ref } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'
import { createClientId } from '@/shared/utils/id'

import { knowledgeGraphLearningApi } from '../api/knowledgeGraphLearningApi'
import type { AttemptScaffold, ScaffoldEventType, ScaffoldHint } from '../types'

export function useAttemptScaffold(attemptId: string) {
  const auth = useAuthStore()
  const scaffold = ref<AttemptScaffold | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const interactingHintId = ref<string | null>(null)
  const pendingEventIds = new Map<string, string>()

  async function load(): Promise<void> {
    if (!auth.accessToken) return
    loading.value = true
    error.value = null
    try {
      scaffold.value = await knowledgeGraphLearningApi.attemptScaffold(auth.accessToken, attemptId)
    } catch (caught: unknown) {
      error.value = caught instanceof Error ? caught.message : '学习脚手架加载失败。'
    } finally {
      loading.value = false
    }
  }

  // [导读] 提示和事件类型共同定位一次待确认操作，失败保留编号用于重试，成功后才删除去重键。
  async function recordEvent(hint: ScaffoldHint, eventType: ScaffoldEventType): Promise<void> {
    if (!auth.accessToken || interactingHintId.value) return
    const key = `${hint.id}:${eventType}`
    const clientEventId = pendingEventIds.get(key) ?? createClientId('scaffold')
    pendingEventIds.set(key, clientEventId)
    interactingHintId.value = hint.id
    error.value = null
    try {
      await knowledgeGraphLearningApi.recordScaffoldEvent(
        auth.accessToken,
        attemptId,
        hint,
        eventType,
        clientEventId,
      )
      pendingEventIds.delete(key)
      await load()
    } catch (caught: unknown) {
      error.value = caught instanceof Error ? caught.message : '提示使用记录失败。'
    } finally {
      interactingHintId.value = null
    }
  }

  onMounted(load)
  return { scaffold, loading, error, interactingHintId, reload: load, recordEvent }
}
