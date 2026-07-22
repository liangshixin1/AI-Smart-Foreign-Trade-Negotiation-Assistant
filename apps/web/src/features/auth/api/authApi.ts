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
