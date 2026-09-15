/* [组件导读]
 * 业务名词：Attempt 是一次训练记录；场景是本次任务与约束，逐轮反馈是单轮建议，正式评价在确认提交后形成。
 * 用途：管理训练草稿的恢复和延迟自动保存。
 * 为什么与边界：700 毫秒防抖减少每次按键都写库；恢复服务器草稿与用户编辑分开，避免初始化直接触发保存。卸载尽力保存，不等于请求已成功。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { onBeforeUnmount, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'

import { saveAttemptDraft } from '../api/trainingApi'
import type { Attempt } from '../types'

export function useAttemptDraft(attemptId: string, attempt: Ref<Attempt | null>) {
  const auth = useAuthStore()
  const draft = ref('')
  const autosaveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
  let hydrated = false
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  // [导读] 将服务器草稿装入编辑状态，初始化与正常编辑分开，避免恢复过程被误当成新输入。
  function hydrateDraft(content: string): void {
    hydrated = false
    draft.value = content
    hydrated = true
    autosaveState.value = 'saved'
  }

  // [导读] 只保存仍在进行中的训练；保存失败标为 error，不能把尚未确认的数据显示为已保存。
  async function persistDraft(): Promise<void> {
    if (!auth.accessToken || attempt.value?.status !== 'in_progress') return
    autosaveState.value = 'saving'
    try {
      const updated = await saveAttemptDraft(auth.accessToken, attemptId, draft.value)
      attempt.value.draft_content = updated.draft_content
      autosaveState.value = 'saved'
    } catch {
      autosaveState.value = 'error'
    }
  }

  watch(draft, () => {
    if (!hydrated) return
    autosaveState.value = 'idle'
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void persistDraft(), 700)
  })

  onBeforeUnmount(() => {
    if (saveTimer) clearTimeout(saveTimer)
    if (hydrated && autosaveState.value === 'idle') void persistDraft()
  })
  return { draft, autosaveState, hydrateDraft }
}
