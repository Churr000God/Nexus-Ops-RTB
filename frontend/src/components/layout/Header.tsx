import { AlertCircle, CheckCircle2, LogOut, Menu, RefreshCw, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { SyncState, SyncStatus } from "@/services/syncService"

type HeaderProps = {
  onOpenSidebar: () => void
  title?: string
  subtitle?: string
  userLabel?: string
  onLogout: () => void
  syncStatus?: SyncStatus
  triggering?: boolean
  onSync?: () => void
}

function SyncBadge({ state, csvs_received, total_expected }: SyncStatus) {
  if (state === "idle") return null

  if (state === "done") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Actualizado
      </span>
    )
  }

  if (state === "error") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        Error
      </span>
    )
  }

  if (state === "syncing") {
    const pct = total_expected > 0 ? Math.round((csvs_received.length / total_expected) * 100) : 0
    return (
      <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400">
        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
        {`Descargando ${pct}%`}
      </span>
    )
  }

  if (state === "importing") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
        Importando BD…
      </span>
    )
  }

  return null
}

function syncLabel(state: SyncState, triggering: boolean): string {
  if (triggering) return "Iniciando…"
  if (state === "syncing") return "Descargando…"
  if (state === "importing") return "Importando…"
  return "Actualizar datos"
}

export function Header({
  onOpenSidebar,
  title,
  subtitle,
  userLabel,
  onLogout,
  syncStatus,
  triggering = false,
  onSync,
}: HeaderProps) {
  const isBusy = triggering || syncStatus?.state === "syncing" || syncStatus?.state === "importing"

  return (
    <header className="fixed inset-x-0 top-0 z-20 border-b border-border/80 bg-card/95 backdrop-blur md:left-[220px]">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSidebar}
          className="rounded-[var(--radius-md)] md:hidden"
          aria-label="Abrir navegación"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>

        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold tracking-tight text-foreground">
            {title ?? "Panel"}
          </div>
          {subtitle ? (
            <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>

        {syncStatus && <SyncBadge {...syncStatus} />}

        {onSync ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={isBusy}
            aria-label="Actualizar datos desde Notion"
            className="hidden sm:flex"
          >
            <RefreshCw className={`h-4 w-4 ${isBusy ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>{syncLabel(syncStatus?.state ?? "idle", triggering)}</span>
          </Button>
        ) : null}

        {userLabel ? (
          <div className="hidden items-center gap-2 rounded-full border bg-background px-3 py-2 text-xs text-muted-foreground shadow-soft-sm sm:flex">
            <ShieldCheck className="h-4 w-4 text-[hsl(var(--primary))]" aria-hidden="true" />
            <span className="truncate">{userLabel}</span>
          </div>
        ) : null}

        <Button variant="outline" size="sm" onClick={onLogout} aria-label="Cerrar sesión">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Salir</span>
        </Button>
      </div>
    </header>
  )
}
