export interface ApiErrorBody {
  code: string
  message: string
  details: unknown
  request_id: string
  retryable: boolean
}

interface ErrorEnvelope {
  error: ApiErrorBody
}

export class ApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (!isRecord(value) || !isRecord(value.error)) return false
  const error = value.error
  return (
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    typeof error.request_id === 'string' &&
    typeof error.retryable === 'boolean'
  )
}

async function throwApiError(response: Response): Promise<never> {
  const payload: unknown = await response.json().catch(() => null)
  if (isErrorEnvelope(payload)) throw new ApiError(response.status, payload.error)
  throw new Error(`Unexpected API error (${String(response.status)})`)
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  // XLSX 等二进制请求会由功能 API 明确设置类型，这里只为 JSON 字符串补默认值。
  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  if (response.status === 204) return undefined as T
  if (!response.ok) return throwApiError(response)
  const payload: unknown = await response.json()
  return payload as T
}

export async function requestBlob(
  path: string,
  accessToken: string,
): Promise<{ blob: Blob; filename: string | null }> {
  const headers = new Headers()
  headers.set('Accept', 'application/octet-stream')
  headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(`${API_BASE_URL}${path}`, {
    mode: 'cors',
    headers,
  })
  if (!response.ok) return throwApiError(response)
  const disposition = response.headers.get('Content-Disposition')
  const encodedName = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  return {
    blob: await response.blob(),
    filename: encodedName ? decodeURIComponent(encodedName) : null,
  }
}
