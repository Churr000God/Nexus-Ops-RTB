import { useAuthStore } from "@/stores/authStore"

export function useAuth() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const error = useAuthStore((s) => s.error)
  const bootstrap = useAuthStore((s) => s.bootstrap)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const clearError = useAuthStore((s) => s.clearError)

  return {
    status,
    user,
    error,
    bootstrap,
    login,
    logout,
    clearError,
    isAuthenticated: status === "authenticated",
  }
}
