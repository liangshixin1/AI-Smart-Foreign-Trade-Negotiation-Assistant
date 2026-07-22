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
