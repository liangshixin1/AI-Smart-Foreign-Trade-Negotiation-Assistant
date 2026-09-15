/* [组件导读]
 * 业务名词：工作区是按学生、教师和技术人员区分的业务页面。
 * 用途：调用对应角色工作区入口检查当前登录者是否能进入。
 * 为什么与边界：把鉴权或连接失败显式转成页面提示，避免误显示为空工作区。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { onMounted, ref } from 'vue'

import type { UserRole } from '@/features/auth/types'
import { useAuthStore } from '@/features/auth/stores/auth'
import { request } from '@/shared/api/http'

interface WorkspaceResponse {
  role: UserRole
  message: string
}

export function useWorkspaceProbe(role: UserRole) {
  const auth = useAuthStore()
  const loading = ref(true)
  const message = ref('')
  const error = ref('')

  async function load(): Promise<void> {
    if (!auth.accessToken) {
      error.value = '登录会话不可用。'
      loading.value = false
      return
    }
    loading.value = true
    error.value = ''
    try {
      const response = await request<WorkspaceResponse>(
        `/api/v1/${role}/workspace`,
        {},
        auth.accessToken,
      )
      message.value = response.message
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '工作区加载失败。'
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
  return { loading, message, error, reload: load }
}
