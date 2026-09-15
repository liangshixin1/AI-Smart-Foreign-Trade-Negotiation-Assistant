/* [组件导读]
 * 业务名词：访问令牌用于接口身份验证；Attempt 是一次训练记录，角色分学生、教师和技术人员。
 * 用途：生成客户端操作编号。
 * 为什么与边界：稳定传递同次操作编号用于后端去重；重试是否复用编号由调用方决定，不能每次重发都无条件换新键。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
export function createClientId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
