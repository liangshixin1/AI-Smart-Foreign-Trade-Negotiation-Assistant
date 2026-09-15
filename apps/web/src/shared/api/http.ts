/* [组件导读]
 * 业务名词：访问令牌用于接口身份验证；Attempt 是一次训练记录，角色分学生、教师和技术人员。
 * 用途：提供带 Bearer 令牌的 JSON 和二进制请求及统一错误解析。
 * 为什么与边界：跨域需要后端允许来源和请求头；TypeScript 泛型只做静态约定，不会在运行时验证成功响应。附件文件名读取还受响应头暴露策略限制。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
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

// [导读] 只把符合后端错误结构的响应转成 ApiError，其他响应保留通用失败，避免信任不完整错误字段。
async function throwApiError(response: Response): Promise<never> {
  const payload: unknown = await response.json().catch(() => null)
  if (isErrorEnvelope(payload)) throw new ApiError(response.status, payload.error)
  throw new Error(`Unexpected API error (${String(response.status)})`)
}

// [导读] 保留调用方自定义头，为 JSON 字符串补默认类型；204 不解析正文，其他错误按统一信封处理。
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

// [导读] 带身份下载二进制资源；浏览器跨域读取文件名还需后端暴露相应响应头。
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
