/* [组件导读]
 * 业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
 * 用途：读取学生可见图谱，传入训练编号时读取该训练绑定版本。
 * 为什么与边界：历史训练需沿旧版本重放，不能一律使用当前发布图；页面加载失败应保留错误状态。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { onMounted, ref } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'

import { knowledgeGraphLearningApi } from '../api/knowledgeGraphLearningApi'
import type { KnowledgeGraphView } from '../types'

export function useStudentKnowledgeGraph(attemptId?: string) {
  const auth = useAuthStore()
  const graph = ref<KnowledgeGraphView | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  async function reload(): Promise<void> {
    if (!auth.accessToken) return
    loading.value = true
    error.value = null
    try {
      graph.value = attemptId
        ? await knowledgeGraphLearningApi.studentAttemptGraph(auth.accessToken, attemptId)
        : await knowledgeGraphLearningApi.studentGraph(auth.accessToken)
    } catch (cause: unknown) {
      error.value = cause instanceof Error ? cause.message : '知识图谱加载失败。'
    } finally {
      loading.value = false
    }
  }
  onMounted(reload)
  return { graph, loading, error, reload }
}
