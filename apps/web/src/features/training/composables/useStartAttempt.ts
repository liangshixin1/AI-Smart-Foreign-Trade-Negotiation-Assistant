import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/features/auth/stores/auth'
import { ApiError } from '@/shared/api/http'
import { createClientId } from '@/shared/utils/id'

import { createAttempt } from '../api/trainingApi'

export function useStartAttempt(unitId: string) {
  const auth = useAuthStore()
  const router = useRouter()
  const starting = ref(false)
  const startError = ref<string | null>(null)

  function storageKey(difficulty: string, mode: 'chat' | 'simulation'): string {
    return `training:create:${unitId}:${difficulty}:${mode}`
  }

  function pendingKey(difficulty: string, mode: 'chat' | 'simulation'): string {
    const key = storageKey(difficulty, mode)
    try {
      const existing = localStorage.getItem(key)
      if (existing) return existing
      const created = createClientId('attempt-create')
      localStorage.setItem(key, created)
      return created
    } catch {
      return createClientId('attempt-create')
    }
  }

  function clearPendingKey(difficulty: string, mode: 'chat' | 'simulation'): void {
    try {
      localStorage.removeItem(storageKey(difficulty, mode))
    } catch {
      // Browsers can disable storage; server-side idempotency still protects an active retry.
    }
  }

  async function start(
    difficulty: string,
    experienceMode: 'chat' | 'simulation' = 'chat',
  ): Promise<void> {
    if (!auth.accessToken || starting.value) return
    starting.value = true
    startError.value = null
    const idempotencyKey = pendingKey(difficulty, experienceMode)
    try {
      const attempt = await createAttempt(
        auth.accessToken,
        {
          unit_id: unitId,
          difficulty,
          experience_mode: experienceMode,
        },
        idempotencyKey,
      )
      clearPendingKey(difficulty, experienceMode)
      if (attempt.status === 'generation_failed' || !attempt.scenario) {
        startError.value = '本次场景生成未完成，请重新开始；你的课程进度不会受影响。'
        return
      }
      await router.push({
        name:
          attempt.workspace_kind === 'lc_correction' ? 'training-workspace' : 'attempt-briefing',
        params: { attemptId: attempt.id },
      })
    } catch (error: unknown) {
      startError.value = error instanceof ApiError ? error.message : '无法开始训练，请稍后重试。'
      if (error instanceof ApiError && error.body.retryable) {
        clearPendingKey(difficulty, experienceMode)
      }
    } finally {
      starting.value = false
    }
  }

  return { start, starting, startError }
}
