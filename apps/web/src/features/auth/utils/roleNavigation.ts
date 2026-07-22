import type { UserRole } from '@/features/auth/types'

const ROLE_HOME: Record<UserRole, string> = {
  student: '/student',
  teacher: '/teacher',
  technician: '/technician',
}

export function homePathForRoles(roles: readonly UserRole[]): string {
  const priority: readonly UserRole[] = ['student', 'teacher', 'technician']
  const role = priority.find((candidate) => roles.includes(candidate))
  return role ? ROLE_HOME[role] : '/login'
}
