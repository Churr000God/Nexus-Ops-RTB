import { requestJson } from "@/lib/http"
import type { LoginRequest, RefreshResponse, TokenResponse, User } from "@/types/auth"

export type LoginResponse = {
  mfa_token: string
  totp_configured: boolean
}

export type TotpSetupData = {
  secret: string
  qr_uri: string
}

export type TotpSetupConfirmResponse = {
  access_token: string
  token_type: string
  backup_codes: string[]
}

export const authService = {
  login(payload: LoginRequest) {
    return requestJson<LoginResponse>("/api/auth/login", { method: "POST", body: payload })
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
  forgotPassword(email: string) {
    return requestJson<void>("/api/auth/forgot-password", {
      method: "POST",
      body: { email },
    })
  },
  resetPassword(token: string, new_password: string) {
    return requestJson<void>("/api/auth/reset-password", {
      method: "POST",
      body: { token, new_password },
    })
  },
  getTotpSetup(mfaToken: string) {
    return requestJson<TotpSetupData>("/api/auth/totp/setup", {
      method: "POST",
      token: mfaToken,
    })
  },
  confirmTotpSetup(mfaToken: string, code: string) {
    return requestJson<TotpSetupConfirmResponse>("/api/auth/totp/setup/confirm", {
      method: "POST",
      token: mfaToken,
      body: { code },
    })
  },
  verifyTotp(mfaToken: string, code: string) {
    return requestJson<TokenResponse>("/api/auth/totp/verify", {
      method: "POST",
      token: mfaToken,
      body: { code },
    })
  },
}
