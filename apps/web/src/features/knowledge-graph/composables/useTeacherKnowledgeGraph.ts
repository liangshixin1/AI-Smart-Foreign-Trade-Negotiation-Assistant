import { onMounted, ref } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'

import { knowledgeGraphLearningApi } from '../api/knowledgeGraphLearningApi'
import type { KnowledgeGraphView } from '../types'

export function useTeacherKnowledgeGraph() {
  const auth = useAuthStore()
  const graph = ref<KnowledgeGraphView | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const displaySaving = ref(false)
  const displayError = ref<string | null>(null)

  async function load(): Promise<void> {
    if (!auth.accessToken) return
    loading.value = true
    error.value = null
    try {
      graph.value = await knowledgeGraphLearningApi.teacherGraph(auth.accessToken)
    } catch (caught: unknown) {
      error.value = caught instanceof Error ? caught.message : '知识图谱加载失败。'
    } finally {
      loading.value = false
    }
  }

  async function updateNodeDisplay(
    nodeId: string,
    shortNameZh: string,
    expectedRevision: number,
  ): Promise<void> {
    if (!auth.accessToken || !graph.value) return
    displaySaving.value = true
    displayError.value = null
    try {
      const result = await knowledgeGraphLearningApi.updateNodeDisplay(
        auth.accessToken,
        nodeId,
        graph.value.graph_version,
        shortNameZh,
        expectedRevision,
      )
      applyDisplayResult(result)
    } catch (caught: unknown) {
      displayError.value = caught instanceof Error ? caught.message : '中文短名保存失败。'
    } finally {
      displaySaving.value = false
    }
  }

  async function restoreNodeDisplay(nodeId: string, expectedRevision: number): Promise<void> {
    if (!auth.accessToken || !graph.value) return
    displaySaving.value = true
    displayError.value = null
    try {
      const result = await knowledgeGraphLearningApi.restoreNodeDisplay(
        auth.accessToken,
        nodeId,
        graph.value.graph_version,
        expectedRevision,
      )
      applyDisplayResult(result)
    } catch (caught: unknown) {
      displayError.value = caught instanceof Error ? caught.message : '恢复原始短名失败。'
    } finally {
      displaySaving.value = false
    }
  }

  function applyDisplayResult(result: {
    node_id: string
    short_label: string
    revision: number
    has_override: boolean
  }): void {
    const node = graph.value?.nodes.find((item) => item.id === result.node_id)
    if (!node) return
    node.short_label = result.short_label
    node.display_revision = result.revision
    node.has_display_override = result.has_override
  }

  onMounted(load)
  return {
    graph,
    loading,
    error,
    displaySaving,
    displayError,
    reload: load,
    updateNodeDisplay,
    restoreNodeDisplay,
  }
}
