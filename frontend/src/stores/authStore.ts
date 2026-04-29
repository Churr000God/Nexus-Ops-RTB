import { create } from "zustand"
import { persist } from "zustand/middleware"

import { authService } from "@/services/authService"
import type { LoginRequest, User } from "@/types/auth"

export type AuthStatus = "booting" | "anonymous" | "authenticated"

type AuthState = {
  status: AuthStatus
  accessToken: string | null
  user: User | null
  error: string | null
}

type AuthActions = {
  bootstrap: () => Promise<void>
  login: (payload: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      status: "booting",
      accessToken: null,
      user: null,
      error: null,

      clearError: () => set({ error: null }),

      bootstrap: async () => {
        set({ status: "booting", error: null })

        const existingToken = get().accessToken
        if (existingToken) {
          try {
            const user = await authService.me(existingToken)
            set({ user, status: "authenticated" })
            return
          } catch {
            set({ accessToken: null, user: null })
          }
        }

        try {
          const refreshed = await authService.refresh()
          const user = await authService.me(refreshed.access_token)
          set({ accessToken: refreshed.access_token, user, status: "authenticated" })
        } catch {
          set({ accessToken: null, user: null, status: "anonymous" })
        }
      },

      login: async (payload: LoginRequest) => {
        set({ error: null })
        const token = await authService.login(payload)
        const user = await authService.me(token.access_token)
        set({ accessToken: token.access_token, user, status: "authenticated" })
      },

      logout: async () => {
        set({ error: null })
        try {
          await authService.logout()
        } finally {
          set({ accessToken: null, user: null, status: "anonymous" })
        }
      },

      refreshUser: async () => {
        const token = get().accessToken
        if (!token) return
        try {
          const user = await authService.me(token)
          set({ user })
        } catch {
          // silent — no interrumpir el flujo si falla
        }
      },
    }),
    {
      name: "nexus-ops-auth",
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
    }
  )
)
