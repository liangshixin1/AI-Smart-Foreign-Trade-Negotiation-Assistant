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
