/* [组件导读]
 * 业务名词：Attempt 是一次训练记录；场景是本次任务与约束，逐轮反馈是单轮建议，正式评价在确认提交后形成。
 * 用途：管理一次训练的加载、草稿、消息流、提交及重试。
 * 为什么与边界：幂等键是同一次操作的稳定编号；断网后复用它避免重复学生消息。模型回复失败与正式提交失败分开处理。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { onMounted, ref, shallowRef } from 'vue'

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
  const pendingStorageKey = `training:pending-message:${attemptId}`
  const pendingMessage = ref<{ content: string; id: string } | null>(readPendingMessage())
  const latestStreamEvent = shallowRef<TrainingStreamEvent | null>(null)

  // [导读] 从服务器恢复记录和草稿；失败保留明确错误，finally 释放加载状态。
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

  // [导读] 复用未完成同内容消息的编号；只在收到完整回复成功信号后清理待发送记录和草稿。
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
    savePendingMessage(pendingMessage.value)
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
      if (messageCompleted) {
        pendingMessage.value = null
        clearPendingMessage()
      }
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

  // [导读] 按事件类型和消息编号增量更新本次训练，避免把流片段或评价挂到其他轮次。
  function applyStreamEvent(event: TrainingStreamEvent, studentContent: string): void {
    latestStreamEvent.value = event
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

  // [导读] 读取断网前未完成的消息及其编号，先校验数据形状再用于重试。
  function readPendingMessage(): { content: string; id: string } | null {
    try {
      const raw = localStorage.getItem(pendingStorageKey)
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'content' in parsed &&
        typeof parsed.content === 'string' &&
        'id' in parsed &&
        typeof parsed.id === 'string'
      ) {
        return { content: parsed.content, id: parsed.id }
      }
    } catch {
      return null
    }
    return null
  }

  // [导读] 在等待服务器前保留重试所需内容和编号；浏览器存储不可用时仍依赖服务端与草稿恢复。
  function savePendingMessage(value: { content: string; id: string }): void {
    try {
      localStorage.setItem(pendingStorageKey, JSON.stringify(value))
    } catch {
      // Draft persistence and server reconciliation remain available without storage.
    }
  }

  function clearPendingMessage(): void {
    try {
      localStorage.removeItem(pendingStorageKey)
    } catch {
      // Nothing else to clear.
    }
  }

  // [导读] 正式提交会冻结训练；异常后重新读取服务器状态，避免用本地猜测覆盖真实提交结果。
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

  // [导读] 只补做当前训练的失败评价，保持学生已提交的内容不变。
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

  // [导读] 创建关联旧记录的新训练，返回新编号给页面导航；旧成绩仍可回放。
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
    latestStreamEvent,
    reload,
    send,
    submit,
    retry,
    retryTraining,
  }
}
