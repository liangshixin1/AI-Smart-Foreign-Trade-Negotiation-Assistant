/* [组件导读]
 * 业务名词：角色分学生、教师和技术人员；访问令牌用于调用接口，刷新令牌用于在登录有效期内换取新令牌。
 * 用途：封装本业务的后端接口路径、请求参数和响应类型。
 * 为什么与边界：请求集中便于保持前后端契约一致；调用成功与业务完成可能不同，需检查返回状态，失败由调用方展示或重试。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { request } from '@/shared/api/http'
import type { TokenPair, UserSummary } from '@/features/auth/types'

interface MeResponse {
  user: UserSummary
}

export const authApi = {
  login(identifier: string, password: string): Promise<TokenPair> {
    return request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    })
  },

  refresh(refreshToken: string): Promise<TokenPair> {
    return request('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  },

  me(accessToken: string): Promise<MeResponse> {
    return request('/api/v1/me', {}, accessToken)
  },

  logout(accessToken: string): Promise<void> {
    return request('/api/v1/auth/logout', { method: 'POST' }, accessToken)
  },
}
