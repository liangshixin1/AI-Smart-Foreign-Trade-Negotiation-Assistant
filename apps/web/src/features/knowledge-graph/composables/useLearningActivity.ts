import { ref } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'

import { knowledgeGraphLearningApi } from '../api/knowledgeGraphLearningApi'
import type { LearningActivitySource } from '../types'

export function useLearningActivity(
  nodeId: string,
  source: LearningActivitySource,
  attemptId: string | null,
) {
  const auth = useAuthStore()
  const completing = ref(false)
  const completed = ref(false)
  const message = ref<string | null>(null)

  async function record(eventType: 'viewed' | 'completed'): Promise<void> {
    if (!auth.accessToken) return
    if (eventType === 'completed') completing.value = true
    message.value = null
    try {
      await knowledgeGraphLearningApi.recordLearningActivity(
        auth.accessToken,
        nodeId,
        eventType,
        source,
        attemptId,
        crypto.randomUUID(),
      )
      if (eventType === 'completed') {
        completed.value = true
        message.value = '已记入你的知识学习进度。'
      }
    } catch (cause: unknown) {
      message.value = cause instanceof Error ? cause.message : '学习进度记录失败，请重试。'
    } finally {
      completing.value = false
    }
  }

  return { completing, completed, message, record }
}
