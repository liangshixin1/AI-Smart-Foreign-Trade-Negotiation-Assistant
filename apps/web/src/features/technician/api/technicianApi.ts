/* [组件导读]
 * 业务名词：变更集是待评审的图谱改动；发布版是通过评审后可读取的图数据，模型配置按生成场景、对话和评价分用途。
 * 用途：封装本业务的后端接口路径、请求参数和响应类型。
 * 为什么与边界：请求集中便于保持前后端契约一致；调用成功与业务完成可能不同，需检查返回状态，失败由调用方展示或重试。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { request } from '@/shared/api/http'
export interface AgentStatus {
  purpose: 'scenario' | 'conversation' | 'evaluation'
  configured: boolean
  model: string
}
export interface LlmConfig {
  provider: string
  base_url: string
  timeout_seconds: number
  max_retries: number
  agents: AgentStatus[]
}
export interface ConfigInput {
  base_url: string
  timeout_seconds: number
  max_retries: number
  scenario_model: string
  conversation_model: string
  evaluation_model: string
  scenario_api_key?: string
  conversation_api_key?: string
  evaluation_api_key?: string
}
export const technicianApi = {
  get: (token: string) => request<LlmConfig>('/api/v1/technician/llm-config', {}, token),
  save: (token: string, data: ConfigInput) =>
    request<LlmConfig>(
      '/api/v1/technician/llm-config',
      { method: 'PUT', body: JSON.stringify(data) },
      token,
    ),
  test: (token: string, purpose: string) =>
    request<{ status: string; model: string; total_tokens: number }>(
      `/api/v1/technician/llm-config/test/${purpose}`,
      { method: 'POST' },
      token,
    ),
}
