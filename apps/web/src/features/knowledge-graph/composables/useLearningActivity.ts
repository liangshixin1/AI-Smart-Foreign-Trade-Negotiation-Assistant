/* [组件导读]
 * 业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
 * 用途：记录当前节点的浏览和学习完成事件。
 * 为什么与边界：切节点同步更新请求代次，迟到回执不能点亮另一个节点的完成状态；完成事件是学习活动记录，不是课程通关成绩。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'

import { knowledgeGraphLearningApi } from '../api/knowledgeGraphLearningApi'
import type { LearningActivitySource } from '../types'

export function useLearningActivity(
  nodeId: MaybeRefOrGetter<string>,
  source: MaybeRefOrGetter<LearningActivitySource>,
  attemptId: MaybeRefOrGetter<string | null>,
) {
  const auth = useAuthStore()
  const completing = ref(false)
  const completed = ref(false)
  const message = ref<string | null>(null)

  let generation = 0
  watch(
    () => toValue(nodeId),
    () => {
      generation++
      completed.value = false
      completing.value = false
      message.value = null
    },
    { flush: 'sync' },
  )

  // [导读] 为学习事件发送唯一编号，回执只作用于发起时的节点代次；节点切换后忽略旧成功或失败。
  async function record(eventType: 'viewed' | 'completed'): Promise<void> {
    if (!auth.accessToken) return
    const current = generation
    if (eventType === 'completed') completing.value = true
    message.value = null
    try {
      await knowledgeGraphLearningApi.recordLearningActivity(
        auth.accessToken,
        toValue(nodeId),
        eventType,
        toValue(source),
        toValue(attemptId),
        crypto.randomUUID(),
      )
      if (current !== generation) return
      if (eventType === 'completed') {
        completed.value = true
        message.value = '已记入你的学习进度。'
      }
    } catch (cause: unknown) {
      if (current !== generation) return
      message.value = cause instanceof Error ? cause.message : '学习进度记录失败，请重试。'
    } finally {
      if (current === generation) completing.value = false
    }
  }

  return { completing, completed, message, record }
}
