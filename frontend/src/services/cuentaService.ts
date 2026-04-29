import { requestJson } from "@/lib/http"
import type { User } from "@/types/auth"
import type { ChangeOwnPasswordRequest, SessionInfo, UpdateProfileRequest } from "@/types/cuenta"

export const cuentaService = {
  updateProfile(token: string, payload: UpdateProfileRequest) {
    return requestJson<User>("/api/auth/me", { method: "PATCH", token, body: payload })
  },

  changeOwnPassword(token: string, payload: ChangeOwnPasswordRequest) {
    return requestJson<void>("/api/auth/me/password", { method: "POST", token, body: payload })
  },

  listSessions(token: string, signal?: AbortSignal) {
    return requestJson<SessionInfo[]>("/api/auth/me/sessions", { token, signal })
  },

  revokeSession(token: string, sessionId: string) {
    return requestJson<void>(`/api/auth/me/sessions/${sessionId}`, { method: "DELETE", token })
  },

  revokeAllOtherSessions(token: string) {
    return requestJson<void>("/api/auth/me/sessions", { method: "DELETE", token })
  },
}
