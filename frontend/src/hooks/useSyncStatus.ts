import { useCallback, useEffect, useRef, useState } from "react"

import { syncService, type SyncState, type SyncStatus } from "@/services/syncService"
import { useAuthStore } from "@/stores/authStore"
import { useSyncStore } from "@/stores/syncStore"

const POLL_INTERVAL_MS = 3000

const IDLE_STATUS: SyncStatus = {
  state: "idle",
  started_at: null,
  finished_at: null,
  error: null,
  csvs_received: [],
  total_expected: 19,
}

export function useSyncStatus() {
  const token = useAuthStore((s) => s.accessToken)
  const bumpSyncVersion = useSyncStore((s) => s.bumpSyncVersion)
  const [status, setStatus] = useState<SyncStatus>(IDLE_STATUS)
  const [triggering, setTriggering] = useState(false)
  const [triggerError, setTriggerError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevStateRef = useRef<SyncState>("idle")

  const isActive = (state: SyncState) => state === "syncing" || state === "importing"

  const fetchStatus = useCallback(async () => {
    if (!token) return
    try {
      const s = await syncService.status(token)
      setStatus(s)
      if (!isActive(s.state)) {
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
        // Si veníamos de un estado activo y ahora terminó, bump para refrescar dashboards
        if (isActive(prevStateRef.current) && s.state === "done") {
          bumpSyncVersion()
        }
      }
      prevStateRef.current = s.state
    } catch {
      // ignore poll errors
    }
  }, [token, bumpSyncVersion])

  const startPolling = useCallback(() => {
    if (pollRef.current) return
    pollRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS)
  }, [fetchStatus])

  // Fetch once on mount
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Auto-start polling if syncing state is detected
  useEffect(() => {
    if (isActive(status.state)) {
      startPolling()
    }
    return () => {
      if (pollRef.current && !isActive(status.state)) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [status.state, startPolling])

  const trigger = useCallback(async () => {
    if (!token || triggering) return
    setTriggering(true)
    setTriggerError(null)
    try {
      await syncService.trigger(token)
      setStatus((prev) => ({ ...prev, state: "syncing", error: null }))
      startPolling()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al iniciar sincronización"
      setTriggerError(msg)
    } finally {
      setTriggering(false)
    }
  }, [token, triggering, startPolling])

  return { status, triggering, triggerError, trigger }
}
