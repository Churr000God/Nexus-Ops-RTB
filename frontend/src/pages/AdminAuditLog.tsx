import { useCallback, useState } from "react"
import { ClipboardList, Filter, X } from "lucide-react"

import { DataTable } from "@/components/common/DataTable"
import type { DataTableColumn } from "@/components/common/DataTable"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useApi } from "@/hooks/useApi"
import { usePermission } from "@/hooks/usePermission"
import { adminService } from "@/services/adminService"
import { useAuthStore } from "@/stores/authStore"
import type { AuditLogEntry, AuditLogParams } from "@/types/admin"
import { cn, formatIsoDate } from "@/lib/utils"

const LIMIT = 50

const ACTION_STYLES: Record<string, string> = {
  INSERT: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
  UPDATE: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  DELETE: "border-red-500/30 bg-red-500/15 text-red-400",
}

type DiffModalProps = {
  entry: AuditLogEntry
  onClose: () => void
}

function DiffModal({ entry, onClose }: DiffModalProps) {
  const hasBefore = entry.before_data !== null
  const hasAfter = entry.after_data !== null
  const cols = hasBefore && hasAfter ? 2 : 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 surface-card w-full max-w-2xl space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">
              {entry.entity_type}
              <span
                className={cn(
                  "ml-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  ACTION_STYLES[entry.action] ?? "border-border bg-muted/50 text-muted-foreground"
                )}
              >
                {entry.action}
              </span>
            </p>
            <p className="font-mono text-xs text-muted-foreground">{entry.entity_id}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={cn("grid gap-4", cols === 2 ? "grid-cols-2" : "grid-cols-1")}>
          {hasBefore && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">
                Antes
              </p>
              <pre className="max-h-72 overflow-auto rounded-[var(--radius-md)] bg-muted/30 p-3 text-[11px] leading-relaxed text-foreground/80">
                {JSON.stringify(entry.before_data, null, 2)}
              </pre>
            </div>
          )}
          {hasAfter && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
                Después
              </p>
              <pre className="max-h-72 overflow-auto rounded-[var(--radius-md)] bg-muted/30 p-3 text-[11px] leading-relaxed text-foreground/80">
                {JSON.stringify(entry.after_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type FilterDraft = {
  entity_type: string
  entity_id: string
  user_id: string
  from_date: string
  to_date: string
}

const EMPTY_DRAFT: FilterDraft = {
  entity_type: "",
  entity_id: "",
  user_id: "",
  from_date: "",
  to_date: "",
}

export function AdminAuditLogPage() {
  const token = useAuthStore((s) => s.accessToken)
  const canView = usePermission("audit.view")

  const [draft, setDraft] = useState<FilterDraft>(EMPTY_DRAFT)
  const [filters, setFilters] = useState<AuditLogParams>({ offset: 0, limit: LIMIT })
  const [diffEntry, setDiffEntry] = useState<AuditLogEntry | null>(null)

  function applyFilters() {
    const applied: AuditLogParams = { offset: 0, limit: LIMIT }
    if (draft.entity_type) applied.entity_type = draft.entity_type
    if (draft.entity_id) applied.entity_id = draft.entity_id
    if (draft.user_id) applied.user_id = draft.user_id
    if (draft.from_date) applied.from_date = draft.from_date
    if (draft.to_date) applied.to_date = draft.to_date
    setFilters(applied)
  }

  function clearFilters() {
    setDraft(EMPTY_DRAFT)
    setFilters({ offset: 0, limit: LIMIT })
  }

  function setDraftField(field: keyof FilterDraft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  const fetchLog = useCallback(
    (signal: AbortSignal) => adminService.listAuditLog(token, filters, signal),
    [token, filters]
  )

  const { data: page, status, error } = useApi(fetchLog, { enabled: canView })

  const totalPages = page ? Math.ceil(page.total / LIMIT) : 0
  const currentPage = filters.offset != null ? Math.floor(filters.offset / LIMIT) + 1 : 1

  function goToPage(p: number) {
    setFilters((prev) => ({ ...prev, offset: (p - 1) * LIMIT }))
  }

  const columns: DataTableColumn<AuditLogEntry>[] = [
    {
      key: "changed_at",
      header: "Fecha",
      cell: (e) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatIsoDate(e.changed_at)}
        </span>
      ),
    },
    {
      key: "entity_type",
      header: "Entidad",
      cell: (e) => <span className="font-mono text-[12px]">{e.entity_type}</span>,
    },
    {
      key: "entity_id",
      header: "ID",
      cell: (e) => (
        <span
          className="font-mono text-[11px] text-muted-foreground"
          title={e.entity_id}
        >
          {e.entity_id.length > 12 ? `${e.entity_id.slice(0, 12)}…` : e.entity_id}
        </span>
      ),
    },
    {
      key: "action",
      header: "Acción",
      cell: (e) => (
        <span
          className={cn(
            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
            ACTION_STYLES[e.action] ?? "border-border bg-muted/50 text-muted-foreground"
          )}
        >
          {e.action}
        </span>
      ),
    },
    {
      key: "user_id",
      header: "Usuario",
      cell: (e) => (
        <span className="font-mono text-[11px] text-muted-foreground" title={e.user_id ?? ""}>
          {e.user_id ? `${e.user_id.slice(0, 8)}…` : "—"}
        </span>
      ),
    },
    {
      key: "diff",
      header: "Cambios",
      cell: (e) => {
        const hasData = e.before_data !== null || e.after_data !== null
        if (!hasData) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <button
            onClick={() => setDiffEntry(e)}
            className="text-[11px] text-primary hover:underline"
          >
            Ver diff
          </button>
        )
      },
    },
  ]

  if (!canView) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Sin acceso</AlertTitle>
          <AlertDescription>No tienes permiso para ver la bitácora.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const isDirty = Object.values(draft).some(Boolean)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-primary/10">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Bitácora de Auditoría</h1>
          <p className="text-sm text-muted-foreground">
            Registro de cambios en usuarios, roles y permisos
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="surface-card space-y-4 p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filtros
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Tipo de entidad
            </label>
            <Input
              placeholder="users, user_roles…"
              value={draft.entity_type}
              onChange={(e) => setDraftField("entity_type", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              ID de entidad
            </label>
            <Input
              placeholder="UUID o número"
              value={draft.entity_id}
              onChange={(e) => setDraftField("entity_id", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              ID de usuario
            </label>
            <Input
              placeholder="UUID del usuario"
              value={draft.user_id}
              onChange={(e) => setDraftField("user_id", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Desde
            </label>
            <Input
              type="datetime-local"
              value={draft.from_date}
              onChange={(e) => setDraftField("from_date", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Hasta
            </label>
            <Input
              type="datetime-local"
              value={draft.to_date}
              onChange={(e) => setDraftField("to_date", e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={applyFilters}>
            Buscar
          </Button>
          {isDirty && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error al cargar bitácora</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <DataTable
        columns={columns}
        rows={page?.items ?? []}
        rowKey={(e) => String(e.audit_id)}
        emptyLabel={status === "loading" ? "Cargando registros…" : "Sin registros para los filtros aplicados"}
        toolbar={
          page != null ? (
            <span className="text-sm text-muted-foreground">
              {page.total} registro{page.total !== 1 ? "s" : ""}
            </span>
          ) : undefined
        }
        maxHeight="520px"
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1 || status === "loading"}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages || status === "loading"}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {diffEntry && (
        <DiffModal entry={diffEntry} onClose={() => setDiffEntry(null)} />
      )}
    </div>
  )
}
