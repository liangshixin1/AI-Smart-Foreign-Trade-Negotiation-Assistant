/* [组件导读]
 * 业务名词：角色分学生、教师和技术人员；访问令牌用于调用接口，刷新令牌用于在登录有效期内换取新令牌。
 * 用途：按用户角色选择角色首页。
 * 为什么与边界：将多角色优先顺序集中，登录页和路由守卫保持一致；页面跳转不代替后端鉴权。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
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
