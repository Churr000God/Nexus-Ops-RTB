import { requestJson } from "@/lib/http"

export type SyncState = "idle" | "syncing" | "importing" | "done" | "error"

export interface SyncStatus {
  state: SyncState
  started_at: string | null
  finished_at: string | null
  error: string | null
  csvs_received: string[]
  total_expected: number
}

export const syncService = {
  trigger(token: string): Promise<{ ok: boolean; message: string }> {
    return requestJson("/api/sync/trigger", { method: "POST", token })
  },

  status(token: string, signal?: AbortSignal): Promise<SyncStatus> {
    return requestJson("/api/sync/status", { token, signal })
  },
}
