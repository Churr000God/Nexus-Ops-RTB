import { useCallback, useState } from "react"
import { Globe, Monitor, Smartphone } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/useApi"
import { formatIsoDateTime } from "@/lib/utils"
import { cuentaService } from "@/services/cuentaService"
import { useAuthStore } from "@/stores/authStore"
import type { SessionInfo } from "@/types/cuenta"

function parseDevice(userAgent: string | null): { label: string; Icon: React.ElementType } {
  if (!userAgent) return { label: "Dispositivo desconocido", Icon: Globe }
  const ua = userAgent.toLowerCase()
  if (/mobile|android|iphone|ipad/.test(ua)) return { label: "Dispositivo móvil", Icon: Smartphone }
  return { label: "Navegador de escritorio", Icon: Monitor }
}

function parseBrowser(userAgent: string | null): string {
  if (!userAgent) return ""
  if (/edg\//.test(userAgent)) return "Edge"
  if (/chrome\//.test(userAgent)) return "Chrome"
  if (/firefox\//.test(userAgent)) return "Firefox"
  if (/safari\//.test(userAgent) && !/chrome/.test(userAgent)) return "Safari"
  if (/opera|opr\//.test(userAgent)) return "Opera"
  return ""
}

function SessionCard({
  session,
  onRevoke,
  revoking,
}: {
  session: SessionInfo
  onRevoke: (id: string) => void
  revoking: boolean
}) {
  const { label, Icon } = parseDevice(session.user_agent)
  const browser = parseBrowser(session.user_agent)
  const deviceLabel = browser ? `${label} · ${browser}` : label

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md border border-border bg-muted/40 p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{deviceLabel}</span>
            {session.is_current && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                Sesión actual
              </span>
            )}
          </div>
          {session.ip_address && (
            <p className="text-xs text-muted-foreground">IP: {session.ip_address}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Iniciada: {formatIsoDateTime(session.created_at)}
            {session.last_used_at && (
              <> · Última actividad: {formatIsoDateTime(session.last_used_at)}</>
            )}
          </p>
        </div>
      </div>

      {!session.is_current && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
          disabled={revoking}
          onClick={() => onRevoke(session.id)}
        >
          {revoking ? "Cerrando…" : "Cerrar"}
        </Button>
      )}
    </div>
  )
}

export function SesionesPage() {
  const token = useAuthStore((s) => s.accessToken)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revokingAll, setRevokingAll] = useState(false)

  const fetcher = useCallback(
    (signal: AbortSignal) => cuentaService.listSessions(token!, signal),
    [token]
  )
  const { data: sessions, status, refetch } = useApi<SessionInfo[]>(fetcher, { enabled: !!token })

  async function handleRevoke(sessionId: string) {
    if (!token) return
    setRevokingId(sessionId)
    try {
      await cuentaService.revokeSession(token, sessionId)
      toast.success("Sesión cerrada")
      refetch()
    } catch {
      toast.error("No se pudo cerrar la sesión")
    } finally {
      setRevokingId(null)
    }
  }

  async function handleRevokeAll() {
    if (!token) return
    setRevokingAll(true)
    try {
      await cuentaService.revokeAllOtherSessions(token)
      toast.success("Sesiones cerradas")
      refetch()
    } catch {
      toast.error("No se pudo cerrar las sesiones")
    } finally {
      setRevokingAll(false)
    }
  }

  const otherSessions = sessions?.filter((s) => !s.is_current) ?? []

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {status === "loading"
            ? "Cargando sesiones…"
            : `${sessions?.length ?? 0} sesión${(sessions?.length ?? 0) !== 1 ? "es" : ""} activa${(sessions?.length ?? 0) !== 1 ? "s" : ""}`}
        </p>
        {otherSessions.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-destructive"
            disabled={revokingAll}
            onClick={handleRevokeAll}
          >
            {revokingAll ? "Cerrando…" : "Cerrar todas las demás"}
          </Button>
        )}
      </div>

      {status === "error" && (
        <p className="text-sm text-destructive">No se pudieron cargar las sesiones.</p>
      )}

      <div className="space-y-3">
        {sessions?.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onRevoke={handleRevoke}
            revoking={revokingId === session.id}
          />
        ))}
        {status === "success" && sessions?.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay sesiones activas.</p>
        )}
      </div>
    </div>
  )
}
