import { onMounted, ref } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'

import { knowledgeGraphLearningApi } from '../api/knowledgeGraphLearningApi'
import type { KnowledgeGraphView } from '../types'

export function useStudentKnowledgeGraph() {
  const auth = useAuthStore()
  const graph = ref<KnowledgeGraphView | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  async function reload(): Promise<void> {
    if (!auth.accessToken) return
    loading.value = true
    error.value = null
    try {
      graph.value = await knowledgeGraphLearningApi.studentGraph(auth.accessToken)
    } catch (cause: unknown) {
      error.value = cause instanceof Error ? cause.message : '知识图谱加载失败。'
    } finally {
      loading.value = false
    }
  }
  onMounted(reload)
  return { graph, loading, error, reload }
}
