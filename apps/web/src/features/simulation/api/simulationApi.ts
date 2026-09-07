import { request } from '@/shared/api/http'

import type { SimulationSession } from '../types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function assertSession(value: unknown): asserts value is SimulationSession {
  if (
    !isRecord(value) ||
    value.schema_version !== 'simulation.session.v1' ||
    !Array.isArray(value.briefing) ||
    !Array.isArray(value.turns) ||
    !isRecord(value.latest_state) ||
    value.latest_state.schema_version !== 'simulation.state.v1' ||
    typeof value.attempt_id !== 'string' ||
    typeof value.display_name !== 'string'
  ) {
    throw new Error('仿真记录版本不兼容，请刷新或联系管理员。')
  }
}

export async function getSimulation(
  accessToken: string,
  attemptId: string,
): Promise<SimulationSession> {
  const payload = await request<unknown>(
    `/api/v1/attempts/${attemptId}/simulation`,
    {},
    accessToken,
  )
  assertSession(payload)
  return payload
}

export async function retrySimulationAnalysis(
  accessToken: string,
  attemptId: string,
  assistantMessageId: string,
): Promise<SimulationSession> {
  const payload = await request<unknown>(
    `/api/v1/attempts/${attemptId}/simulation/messages/${assistantMessageId}/retry-analysis`,
    { method: 'POST' },
    accessToken,
  )
  assertSession(payload)
  return payload
}
