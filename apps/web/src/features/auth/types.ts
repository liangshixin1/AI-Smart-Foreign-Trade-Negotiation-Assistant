/* [组件导读]
 * 业务名词：角色分学生、教师和技术人员；访问令牌用于调用接口，刷新令牌用于在登录有效期内换取新令牌。
 * 用途：定义本业务或运行环境的 TypeScript 类型。
 * 为什么与边界：类型帮助调用方理解字段约定，但编译后的接口数据仍需后端验证；类型断言不会自动清理或验证真实响应。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
export type UserRole = 'student' | 'teacher' | 'technician'

export interface UserSummary {
  id: string
  email: string
  student_no: string | null
  display_name: string
  roles: UserRole[]
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  expires_in: number
  user: UserSummary
}

export interface PersistedAuth {
  accessToken: string
  refreshToken: string
  user: UserSummary
}
