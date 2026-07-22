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
