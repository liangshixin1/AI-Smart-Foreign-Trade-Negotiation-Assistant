/* [组件导读]
 * 业务名词：访问令牌用于接口身份验证；Attempt 是一次训练记录，角色分学生、教师和技术人员。
 * 用途：封装浏览器确认行为供业务操作复用。
 * 为什么与边界：确认只是用户操作意愿，后端仍需校验身份、资源范围与当前状态。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
export function confirmAction(message: string): boolean {
  return globalThis.confirm(message)
}
