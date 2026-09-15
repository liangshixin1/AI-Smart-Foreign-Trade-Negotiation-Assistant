/* [组件导读]
 * 业务名词：Attempt 是一次训练；仿真用逐段台词和角色演出呈现谈判，态势是根据原话证据计算的状态。
 * 用途：封装本业务的后端接口路径、请求参数和响应类型。
 * 为什么与边界：请求集中便于保持前后端契约一致；调用成功与业务完成可能不同，需检查返回状态，失败由调用方展示或重试。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
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
