import { onMounted, ref } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'
import { ApiError } from '@/shared/api/http'
import { createClientId } from '@/shared/utils/id'

import {
  getAttempt,
  retryAttempt,
  retryEvaluation,
  streamAttemptMessage,
  submitAttempt,
} from '../api/trainingApi'
import type { TrainingStreamEvent } from '../api/trainingApi'
import type { Attempt, TrainingMessage } from '../types'
import { useAttemptDraft } from './useAttemptDraft'

export function useAttempt(attemptId: string) {
  const auth = useAuthStore()
  const attempt = ref<Attempt | null>(null)
  const loading = ref(true)
  const sending = ref(false)
  const submitting = ref(false)
  const error = ref<string | null>(null)
  const { draft, autosaveState, hydrateDraft } = useAttemptDraft(attemptId, attempt)
  const pendingMessage = ref<{ content: string; id: string } | null>(null)

  async function reload(): Promise<void> {
    if (!auth.accessToken) return
    loading.value = true
    error.value = null
    try {
      const loaded = await getAttempt(auth.accessToken, attemptId)
      attempt.value = loaded
      hydrateDraft(loaded.draft_content)
    } catch (caught: unknown) {
      error.value = caught instanceof ApiError ? caught.message : '训练记录加载失败。'
    } finally {
      loading.value = false
    }
  }

  async function send(content: string): Promise<boolean> {
    if (!auth.accessToken || sending.value) return false
    sending.value = true
    error.value = null
    // 网络中断后重发同一内容时复用幂等键，避免服务端生成重复学生消息。
    const clientId =
      pendingMessage.value?.content === content
        ? pendingMessage.value.id
        : createClientId('message')
    pendingMessage.value = { content, id: clientId }
    let messageCompleted = false
    try {
      messageCompleted = await streamAttemptMessage(
        auth.accessToken,
        attemptId,
        { content, client_message_id: clientId },
        (event) => {
          applyStreamEvent(event, content)
        },
      )
      if (messageCompleted) pendingMessage.value = null
      if (messageCompleted) draft.value = ''
      return messageCompleted
    } catch (caught: unknown) {
      error.value = caught instanceof Error ? caught.message : '流式回复失败，学生消息仍会保留。'
      await reload()
      return messageCompleted
    } finally {
      sending.value = false
    }
  }

  function applyStreamEvent(event: TrainingStreamEvent, studentContent: string): void {
    if (!attempt.value) return
    // SSE 事件只增量更新当前 Attempt；刷新后仍以服务端持久化记录重新水合。
    if (event.type === 'message.started') {
      const nextSequence =
        Math.max(0, ...attempt.value.messages.map((item) => item.sequence_no)) + 1
      if (!findMessage(event.data.student_message_id)) {
        attempt.value.messages.push({
          id: event.data.student_message_id,
          sequence_no: nextSequence,
          role: 'student',
          content: studentContent,
          status: 'completed',
          created_at: new Date().toISOString(),
        })
      }
      if (!findMessage(event.data.message_id)) {
        attempt.value.messages.push({
          id: event.data.message_id,
          sequence_no: nextSequence + 1,
          role: 'assistant',
          content: '',
          status: 'streaming',
          created_at: new Date().toISOString(),
        })
      }
    } else if (event.type === 'message.delta') {
      const message = findMessage(event.data.message_id)
      if (message) message.content += event.data.delta
    } else if (event.type === 'message.completed') {
      const message = findMessage(event.data.message_id)
      if (message) {
        message.content = event.data.content
        message.status = 'completed'
      }
    } else if (event.type === 'message.failed') {
      const message = findMessage(event.data.message_id)
      if (message) message.status = 'failed'
      error.value = event.data.message
    } else if (event.type === 'round_evaluation.completed') {
      const index = attempt.value.round_evaluations.findIndex(
        (item) => item.assistant_message_id === event.data.assistant_message_id,
      )
      if (index >= 0) attempt.value.round_evaluations[index] = event.data
      else attempt.value.round_evaluations.push(event.data)
    } else if (event.type === 'round_evaluation.failed') {
      error.value = event.data.message
    }
  }

  function findMessage(messageId: string): TrainingMessage | undefined {
    return attempt.value?.messages.find((item) => item.id === messageId)
  }

  async function submit(): Promise<boolean> {
    if (!auth.accessToken || submitting.value) return false
    submitting.value = true
    error.value = null
    try {
      attempt.value = await submitAttempt(auth.accessToken, attemptId, createClientId('submit'))
      return attempt.value.status === 'completed'
    } catch (caught: unknown) {
      error.value = caught instanceof ApiError ? caught.message : '正式提交失败，训练内容仍已保留。'
      await reload()
      return false
    } finally {
      submitting.value = false
    }
  }

  async function retry(): Promise<boolean> {
    if (!auth.accessToken || submitting.value) return false
    submitting.value = true
    error.value = null
    try {
      attempt.value = await retryEvaluation(auth.accessToken, attemptId)
      return attempt.value.status === 'completed'
    } catch (caught: unknown) {
      error.value = caught instanceof ApiError ? caught.message : '评价重试失败。'
      await reload()
      return false
    } finally {
      submitting.value = false
    }
  }

  async function retryTraining(): Promise<string | null> {
    if (!auth.accessToken || submitting.value) return null
    submitting.value = true
    error.value = null
    try {
      const created = await retryAttempt(auth.accessToken, attemptId, createClientId('retry'))
      return created.id
    } catch (caught: unknown) {
      error.value = caught instanceof ApiError ? caught.message : '创建重练失败。'
      return null
    } finally {
      submitting.value = false
    }
  }

  onMounted(reload)
  return {
    attempt,
    draft,
    autosaveState,
    loading,
    sending,
    submitting,
    error,
    reload,
    send,
    submit,
    retry,
    retryTraining,
  }
}
