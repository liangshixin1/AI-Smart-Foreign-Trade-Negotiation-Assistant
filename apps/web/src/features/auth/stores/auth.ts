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
    hydrate(): void {
      if (this.hydrated) return
      const persisted = parsePersistedAuth(localStorage.getItem(STORAGE_KEY))
      if (persisted) this.applySession(persisted)
      this.hydrated = true
    },
    async login(identifier: string, password: string): Promise<void> {
      this.applyTokenPair(await authApi.login(identifier, password))
    },
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
    async logout(): Promise<void> {
      const token = this.accessToken
      this.clear()
      if (token) await authApi.logout(token)
    },
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
