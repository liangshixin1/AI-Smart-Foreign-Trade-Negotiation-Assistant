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
