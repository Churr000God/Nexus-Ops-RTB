import { create } from "zustand"
import { persist } from "zustand/middleware"

import { authService } from "@/services/authService"
import type { TotpSetupData } from "@/services/authService"
import type { LoginRequest, User } from "@/types/auth"

export type AuthStatus = "booting" | "anonymous" | "authenticated" | "mfa_setup" | "mfa_verify"

type AuthState = {
  status: AuthStatus
  accessToken: string | null
  user: User | null
  error: string | null
  mfaToken: string | null
  mfaConfigured: boolean
}

type AuthActions = {
  bootstrap: () => Promise<void>
  login: (payload: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
  refreshUser: () => Promise<void>
  completeMfaSetup: () => Promise<TotpSetupData>
  confirmMfaSetup: (code: string) => Promise<string[]>
  completeMfaVerify: (code: string) => Promise<void>
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      status: "booting",
      accessToken: null,
      user: null,
      error: null,
      mfaToken: null,
      mfaConfigured: false,

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
        const response = await authService.login(payload)
        set({
          mfaToken: response.mfa_token,
          mfaConfigured: response.totp_configured,
          status: response.totp_configured ? "mfa_verify" : "mfa_setup",
        })
      },

      logout: async () => {
        set({ error: null })
        try {
          await authService.logout()
        } finally {
          set({
            accessToken: null,
            user: null,
            status: "anonymous",
            mfaToken: null,
            mfaConfigured: false,
          })
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

      completeMfaSetup: async () => {
        const { mfaToken } = get()
        if (!mfaToken) throw new Error("No hay challenge activo")
        return authService.getTotpSetup(mfaToken)
      },

      confirmMfaSetup: async (code: string): Promise<string[]> => {
        const { mfaToken } = get()
        if (!mfaToken) throw new Error("No hay challenge activo")
        const result = await authService.confirmTotpSetup(mfaToken, code)
        const user = await authService.me(result.access_token)
        set({ accessToken: result.access_token, user, status: "authenticated", mfaToken: null })
        return result.backup_codes
      },

      completeMfaVerify: async (code: string) => {
        const { mfaToken } = get()
        if (!mfaToken) throw new Error("No hay challenge activo")
        const token = await authService.verifyTotp(mfaToken, code)
        const user = await authService.me(token.access_token)
        set({ accessToken: token.access_token, user, status: "authenticated", mfaToken: null })
      },
    }),
    {
      name: "nexus-ops-auth",
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
    }
  )
)
