/** 平台级 API 适配层：组件不直接拼接地址，也不关心网络异常格式。 */
export interface ServiceCheck {
  ready: boolean
  durationMs: number
  detail?: string
}

export interface PlatformHealth {
  status: 'ok' | 'degraded'
  service: string
  environment: string
  checks: Record<string, ServiceCheck>
}

export async function fetchPlatformHealth(signal?: AbortSignal): Promise<PlatformHealth> {
  const response = await fetch('/api/system/health', { signal })
  if (!response.ok) {
    throw new Error(`健康检查失败（HTTP ${response.status}）`)
  }
  return response.json() as Promise<PlatformHealth>
}
