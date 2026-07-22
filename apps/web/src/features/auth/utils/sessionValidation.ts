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
