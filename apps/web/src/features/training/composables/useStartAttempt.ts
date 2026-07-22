import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/features/auth/stores/auth'
import { ApiError } from '@/shared/api/http'

import { createAttempt } from '../api/trainingApi'

export function useStartAttempt(unitId: string) {
  const auth = useAuthStore()
  const router = useRouter()
  const starting = ref(false)
  const startError = ref<string | null>(null)

  async function start(difficulty: string): Promise<void> {
    if (!auth.accessToken || starting.value) return
    starting.value = true
    startError.value = null
    try {
      const attempt = await createAttempt(auth.accessToken, {
        unit_id: unitId,
        difficulty,
      })
      await router.push({ name: 'training-workspace', params: { attemptId: attempt.id } })
    } catch (error: unknown) {
      startError.value = error instanceof ApiError ? error.message : '无法开始训练，请稍后重试。'
    } finally {
      starting.value = false
    }
  }

  return { start, starting, startError }
}
