import { onMounted, ref } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'

import { knowledgeGraphLearningApi } from '../api/knowledgeGraphLearningApi'
import type { KnowledgeInsights } from '../types'

export function useKnowledgeInsights(scope: 'classroom' | 'student', scopeId: () => string | null) {
  const auth = useAuthStore()
  const insights = ref<KnowledgeInsights | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load(): Promise<void> {
    const id = scopeId()
    if (!auth.accessToken || !id) return
    loading.value = true
    error.value = null
    try {
      insights.value =
        scope === 'classroom'
          ? await knowledgeGraphLearningApi.classroomInsights(auth.accessToken, id)
          : await knowledgeGraphLearningApi.studentInsights(auth.accessToken, id)
    } catch (caught: unknown) {
      error.value = caught instanceof Error ? caught.message : '知识学情加载失败。'
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
  return { insights, loading, error, load }
}
