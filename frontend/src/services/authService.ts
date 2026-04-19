import { requestJson } from "@/lib/http"
import type { LoginRequest, RefreshResponse, TokenResponse, User } from "@/types/auth"

export const authService = {
  login(payload: LoginRequest) {
    return requestJson<TokenResponse>("/api/auth/login", { method: "POST", body: payload })
  },
  refresh() {
    return requestJson<RefreshResponse>("/api/auth/refresh", { method: "POST", body: {} })
  },
  logout() {
    return requestJson<void>("/api/auth/logout", { method: "POST", body: {} })
  },
  me(token: string) {
    return requestJson<User>("/api/auth/me", { token })
  },
}
