import { useAuthStore } from "@/stores/authStore"

export function useAuth() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const error = useAuthStore((s) => s.error)
  const mfaToken = useAuthStore((s) => s.mfaToken)
  const mfaConfigured = useAuthStore((s) => s.mfaConfigured)
  const bootstrap = useAuthStore((s) => s.bootstrap)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const clearError = useAuthStore((s) => s.clearError)
  const completeMfaSetup = useAuthStore((s) => s.completeMfaSetup)
  const confirmMfaSetup = useAuthStore((s) => s.confirmMfaSetup)
  const completeMfaVerify = useAuthStore((s) => s.completeMfaVerify)

  return {
    status,
    user,
    error,
    mfaToken,
    mfaConfigured,
    bootstrap,
    login,
    logout,
    clearError,
    completeMfaSetup,
    confirmMfaSetup,
    completeMfaVerify,
    isAuthenticated: status === "authenticated",
  }
}
