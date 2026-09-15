/* [组件导读]
 * 业务名词：Attempt 是一次训练记录；场景是本次任务与约束，逐轮反馈是单轮建议，正式评价在确认提交后形成。
 * 用途：创建小节训练并导航到简报或信用证工作台。
 * 为什么与边界：按小节、难度和体验模式保存创建键，断网后可恢复同次请求；明确失败时按现有分支清理键，避免长期卡在旧失败记录。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
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
