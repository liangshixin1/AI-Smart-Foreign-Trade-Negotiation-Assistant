import { request } from '@/shared/api/http'

import type { Attempt, AttemptHistoryItem, RoundEvaluation } from '../types'

export type TrainingStreamEvent =
  | { type: 'message.started'; data: { message_id: string; student_message_id: string } }
  | { type: 'message.delta'; data: { message_id: string; delta: string } }
  | { type: 'message.completed'; data: { message_id: string; content: string } }
  | {
      type: 'message.failed'
      data: { message_id: string; code: string; message: string; retryable: boolean }
    }
  | { type: 'round_evaluation.started'; data: { assistant_message_id: string } }
  | { type: 'round_evaluation.completed'; data: RoundEvaluation }
  | {
      type: 'round_evaluation.failed'
      data: { assistant_message_id: string; code: string; message: string; retryable: boolean }
    }
  | { type: 'stream.closed'; data: { status: string } }

export function createAttempt(
  accessToken: string,
  input: { unit_id: string; difficulty: string },
): Promise<Attempt> {
  return request<Attempt>(
    '/api/v1/attempts',
    { method: 'POST', body: JSON.stringify(input) },
    accessToken,
  )
}

export function getAttempt(accessToken: string, attemptId: string): Promise<Attempt> {
  return request<Attempt>(`/api/v1/attempts/${attemptId}`, {}, accessToken)
}

export function getAttemptHistory(accessToken: string): Promise<AttemptHistoryItem[]> {
  return request<AttemptHistoryItem[]>('/api/v1/attempts', {}, accessToken)
}

export function saveAttemptDraft(
  accessToken: string,
  attemptId: string,
  content: string,
): Promise<Attempt> {
  return request<Attempt>(
    `/api/v1/attempts/${attemptId}/draft`,
    { method: 'PUT', body: JSON.stringify({ content }) },
    accessToken,
  )
}

export function retryAttempt(
  accessToken: string,
  attemptId: string,
  idempotencyKey: string,
): Promise<Attempt> {
  return request<Attempt>(
    `/api/v1/attempts/${attemptId}/retry`,
    { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } },
    accessToken,
  )
}

export function sendAttemptMessage(
  accessToken: string,
  attemptId: string,
  input: { content: string; client_message_id: string },
): Promise<Attempt> {
  return request<Attempt>(
    `/api/v1/attempts/${attemptId}/messages`,
    { method: 'POST', body: JSON.stringify(input) },
    accessToken,
  )
}

export function submitAttempt(
  accessToken: string,
  attemptId: string,
  idempotencyKey: string,
): Promise<Attempt> {
  return request<Attempt>(
    `/api/v1/attempts/${attemptId}/submit`,
    { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } },
    accessToken,
  )
}

export function retryEvaluation(accessToken: string, attemptId: string): Promise<Attempt> {
  return request<Attempt>(
    `/api/v1/attempts/${attemptId}/evaluation/retry`,
    { method: 'POST' },
    accessToken,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseEvent(block: string): TrainingStreamEvent | null {
  const eventLine = block.split('\n').find((line) => line.startsWith('event:'))
  const dataLine = block.split('\n').find((line) => line.startsWith('data:'))
  if (!eventLine || !dataLine) return null
  const type = eventLine.slice(6).trim()
  const parsed: unknown = JSON.parse(dataLine.slice(5).trim())
  if (!isRecord(parsed) || parsed.event_version !== 1) return null
  const data = { ...parsed }
  delete data.event_version
  return { type, data } as TrainingStreamEvent
}

export async function streamAttemptMessage(
  accessToken: string,
  attemptId: string,
  input: { content: string; client_message_id: string },
  onEvent: (event: TrainingStreamEvent) => void,
): Promise<boolean> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
  const response = await fetch(`${baseUrl}/api/v1/attempts/${attemptId}/messages/stream`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload: unknown = await response.json()
    const message =
      isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string'
        ? payload.error.message
        : `流式请求失败（${String(response.status)}）`
    throw new Error(message)
  }
  if (!response.body) throw new Error('浏览器未提供流式响应体。')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let messageCompleted = false
  let streamDone = false
  while (!streamDone) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      const event = parseEvent(block)
      if (event) {
        onEvent(event)
        if (event.type === 'message.completed') messageCompleted = true
      }
    }
    streamDone = done
  }
  return messageCompleted
}
