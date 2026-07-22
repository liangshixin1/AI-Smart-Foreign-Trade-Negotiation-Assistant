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

  function hydrateDraft(content: string): void {
    hydrated = false
    draft.value = content
    hydrated = true
    autosaveState.value = 'saved'
  }

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
