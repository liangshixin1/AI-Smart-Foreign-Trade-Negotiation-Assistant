/* [组件导读]
 * 业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
 * 用途：按教师选择的班级或学生范围读取知识学情。
 * 为什么与边界：范围与标识由调用方提供；空标识不应发起错误查询，后端还会核对教师班级权限。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
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
