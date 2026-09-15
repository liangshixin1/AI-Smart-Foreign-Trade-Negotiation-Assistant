/* [组件导读]
 * 业务名词：角色分学生、教师和技术人员；访问令牌用于调用接口，刷新令牌用于在登录有效期内换取新令牌。
 * 用途：用 Pinia 保存登录者、令牌和浏览器会话，并处理登录、刷新及退出。
 * 为什么与边界：本地缓存用于恢复界面，不是权限真相；服务器校验失败需刷新或清理。localStorage 中令牌可被同源脚本读取，不能输出到日志。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { defineStore } from 'pinia'

import { authApi } from '@/features/auth/api/authApi'
import type { PersistedAuth, TokenPair, UserRole, UserSummary } from '@/features/auth/types'
import { parsePersistedAuth } from '@/features/auth/utils/sessionValidation'

const STORAGE_KEY = 'negotiation-platform.auth'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserSummary | null
  hydrated: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    accessToken: null,
    refreshToken: null,
    user: null,
    hydrated: false,
  }),
  getters: {
    isAuthenticated: (state): boolean => Boolean(state.accessToken && state.user),
    hasRole:
      (state) =>
      (role: UserRole): boolean =>
        state.user?.roles.includes(role) ?? false,
  },
  actions: {
    // [导读] 浏览器缓存只恢复界面所需会话，不能证明令牌仍有效；是否有效由服务端判断。
    hydrate(): void {
      if (this.hydrated) return
      const persisted = parsePersistedAuth(localStorage.getItem(STORAGE_KEY))
      if (persisted) this.applySession(persisted)
      this.hydrated = true
    },
    async login(identifier: string, password: string): Promise<void> {
      this.applyTokenPair(await authApi.login(identifier, password))
    },
    // [导读] 先请求当前用户，失败再尝试刷新；本地 user 对象不能代替服务端身份核验。
    async validate(): Promise<boolean> {
      if (!this.accessToken) return false
      try {
        const response = await authApi.me(this.accessToken)
        this.user = response.user
        this.persist()
        return true
      } catch {
        return this.tryRefresh()
      }
    },
    // [导读] 先清本地身份再通知后端撤销，避免网络失败时界面仍继续显示为已登录。
    async logout(): Promise<void> {
      const token = this.accessToken
      this.clear()
      if (token) await authApi.logout(token)
    },
    // [导读] 刷新成功后同时更新令牌，失败则清会话；不能无限使用浏览器中的旧刷新令牌。
    async tryRefresh(): Promise<boolean> {
      if (!this.refreshToken) {
        this.clear()
        return false
      }
      try {
        this.applyTokenPair(await authApi.refresh(this.refreshToken))
        return true
      } catch {
        this.clear()
        return false
      }
    },
    applyTokenPair(tokens: TokenPair): void {
      this.applySession({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        user: tokens.user,
      })
      this.persist()
    },
    applySession(session: PersistedAuth): void {
      this.accessToken = session.accessToken
      this.refreshToken = session.refreshToken
      this.user = session.user
    },
    // [导读] 同时保存两类令牌与用户快照，便于恢复；不要把这份 localStorage 内容复制到日志或提交给其他成员。
    persist(): void {
      if (!this.accessToken || !this.refreshToken || !this.user) return
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          user: this.user,
        } satisfies PersistedAuth),
      )
    },
    clear(): void {
      this.accessToken = null
      this.refreshToken = null
      this.user = null
      localStorage.removeItem(STORAGE_KEY)
    },
  },
})
