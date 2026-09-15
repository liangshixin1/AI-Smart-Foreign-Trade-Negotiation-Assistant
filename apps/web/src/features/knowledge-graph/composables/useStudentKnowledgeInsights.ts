/* [组件导读]
 * 业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
 * 用途：读取当前登录学生的知识学习概况。
 * 为什么与边界：身份来自登录令牌，前端不自行选择其他学生；数据读取与展示拆开便于多个页面复用。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
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
