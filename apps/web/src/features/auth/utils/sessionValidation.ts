/* [组件导读]
 * 业务名词：角色分学生、教师和技术人员；访问令牌用于调用接口，刷新令牌用于在登录有效期内换取新令牌。
 * 用途：验证浏览器保存的登录会话数据形状。
 * 为什么与边界：localStorage 可能含旧版本或损坏内容，不能把 JSON 解析成功当作有效身份；有效期仍需服务端确认。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import type { PersistedAuth, UserRole, UserSummary } from '@/features/auth/types'

const ROLES: readonly UserRole[] = ['student', 'teacher', 'technician']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isUser(value: unknown): value is UserSummary {
  if (!isRecord(value) || !Array.isArray(value.roles)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.email === 'string' &&
    (value.student_no === null || typeof value.student_no === 'string') &&
    typeof value.display_name === 'string' &&
    value.roles.every((role) => typeof role === 'string' && ROLES.includes(role as UserRole))
  )
}

export function parsePersistedAuth(value: string | null): PersistedAuth | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      isRecord(parsed) &&
      typeof parsed.accessToken === 'string' &&
      typeof parsed.refreshToken === 'string' &&
      isUser(parsed.user)
    ) {
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        user: parsed.user,
      }
    }
  } catch {
    return null
  }
  return null
}
