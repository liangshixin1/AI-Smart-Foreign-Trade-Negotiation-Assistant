import { onMounted, ref } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'

import { knowledgeGraphLearningApi } from '../api/knowledgeGraphLearningApi'
import type { KnowledgeInsights } from '../types'

export function useStudentKnowledgeInsights() {
  const auth = useAuthStore()
  const insights = ref<KnowledgeInsights | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function load(): Promise<void> {
    if (!auth.accessToken) return
    loading.value = true
    error.value = null
    try {
      insights.value = await knowledgeGraphLearningApi.ownInsights(auth.accessToken)
    } catch (cause: unknown) {
      error.value = cause instanceof Error ? cause.message : '知识学习进度加载失败。'
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
  return { insights, loading, error, reload: load }
}
