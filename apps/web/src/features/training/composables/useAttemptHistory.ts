/* [组件导读]
 * 业务名词：Attempt 是一次训练记录；场景是本次任务与约束，逐轮反馈是单轮建议，正式评价在确认提交后形成。
 * 用途：读取当前学生的训练历史，提供加载、失败和重试状态。
 * 为什么与边界：历史训练各有独立编号，继续训练和重练不是同一动作；列表内容以服务端记录为准。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { onMounted, ref } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'
import { ApiError } from '@/shared/api/http'

import { getAttemptHistory } from '../api/trainingApi'
import type { AttemptHistoryItem } from '../types'

export function useAttemptHistory() {
  const auth = useAuthStore()
  const items = ref<AttemptHistoryItem[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function reload(): Promise<void> {
    if (!auth.accessToken) return
    loading.value = true
    error.value = null
    try {
      items.value = await getAttemptHistory(auth.accessToken)
    } catch (caught: unknown) {
      error.value = caught instanceof ApiError ? caught.message : '训练历史加载失败。'
    } finally {
      loading.value = false
    }
  }

  onMounted(reload)
  return { items, loading, error, reload }
}
