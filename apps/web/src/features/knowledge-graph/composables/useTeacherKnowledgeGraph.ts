/* [组件导读]
 * 业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
 * 用途：读取教师图谱，并提供节点短名保存、恢复和局部显示更新。
 * 为什么与边界：短名写入带图谱版本及期望修订号，避免旧页面覆盖别人修改；只更新展示字段，不改稳定编号或原始知识事实。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { onMounted, ref } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'

import { knowledgeGraphLearningApi } from '../api/knowledgeGraphLearningApi'
import type { KnowledgeGraphView } from '../types'

export function useTeacherKnowledgeGraph(attemptId?: string) {
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
      graph.value = attemptId
        ? await knowledgeGraphLearningApi.teacherAttemptGraph(auth.accessToken, attemptId)
        : await knowledgeGraphLearningApi.teacherGraph(auth.accessToken)
    } catch (caught: unknown) {
      error.value = caught instanceof Error ? caught.message : '知识图谱加载失败。'
    } finally {
      loading.value = false
    }
  }

  // [导读] 带上底图版本和期望显示修订号；服务器发现冲突时显示错误，不直接覆盖其他教师修改。
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
      displayError.value = caught instanceof Error ? caught.message : '图谱显示名称保存失败。'
    } finally {
      displaySaving.value = false
    }
  }

  // [导读] 恢复默认名称同样需要版本检查，避免旧页面清掉新覆盖记录。
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
      displayError.value = caught instanceof Error ? caught.message : '恢复专家中文名称失败。'
    } finally {
      displaySaving.value = false
    }
  }

  // [导读] 只更新返回节点的短名、修订号和覆盖标志，保持节点身份与业务属性不变。
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
