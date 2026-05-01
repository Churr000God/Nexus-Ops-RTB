import { useCallback, useState } from "react"
import { CheckCircle2, ChevronLeft, ClipboardList, Plus } from "lucide-react"
import { toast } from "sonner"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { CreateCountModal } from "@/components/assets/CreateCountModal"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/useApi"
import { assetsService } from "@/services/assetsService"
import { useAuthStore } from "@/stores/authStore"
import { cn } from "@/lib/utils"
import type { PhysicalCountLineRead, PhysicalCountRead } from "@/types/assets"

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  CONFIRMED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  CANCELLED: "border-slate-500/30 bg-slate-500/10 text-slate-500",
}

export default function ConteosPage() {
  const token = useAuthStore((s) => s.accessToken)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedCount, setSelectedCount] = useState<PhysicalCountRead | null>(null)
  const [countsKey, setCountsKey] = useState(0)
  const [linesKey, setLinesKey] = useState(0)
  const [confirming, setConfirming] = useState(false)

  const countsFetcher = useCallback(
    (signal: AbortSignal) => assetsService.listCounts(token, {}, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, countsKey],
  )
  const { data: counts, status: countsStatus } = useApi(countsFetcher)

  const linesFetcher = useCallback(
    (signal: AbortSignal) =>
      selectedCount
        ? assetsService.getCountLines(token, selectedCount.id, signal)
        : Promise.resolve([] as PhysicalCountLineRead[]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, selectedCount?.id, linesKey],
  )
  const { data: lines, status: linesStatus } = useApi(linesFetcher)

  function refreshCounts() {
    setCountsKey((k) => k + 1)
  }

  function refreshLines() {
    setLinesKey((k) => k + 1)
  }

  async function toggleFound(line: PhysicalCountLineRead, found: boolean) {
    if (!selectedCount || selectedCount.status !== "DRAFT") return
    try {
      await assetsService.updateCountLine(token, selectedCount.id, line.id, { found })
      refreshLines()
      refreshCounts()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar línea")
    }
  }

  async function handleConfirm() {
    if (!selectedCount) return
    setConfirming(true)
    try {
      const updated = await assetsService.confirmCount(token, selectedCount.id)
      toast.success("Conteo confirmado")
      setSelectedCount(updated)
      refreshCounts()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar conteo")
    } finally {
      setConfirming(false)
    }
  }

  const countColumns: DataTableColumn<PhysicalCountRead>[] = [
    {
      key: "count_date",
      header: "Fecha",
      cell: (r) => new Date(r.count_date + "T12:00:00").toLocaleDateString("es-MX"),
    },
    {
      key: "status",
      header: "Estado",
      cell: (r) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
            STATUS_COLORS[r.status] ?? STATUS_COLORS.CANCELLED,
          )}
        >
          {STATUS_LABELS[r.status] ?? r.status}
        </span>
      ),
    },
    {
      key: "location_filter",
      header: "Ubicación",
      cell: (r) => r.location_filter ?? <span className="text-muted-foreground italic">Todos</span>,
    },
    {
      key: "total_lines",
      header: "Activos",
      cell: (r) => String(r.total_lines),
    },
    {
      key: "found_count",
      header: "Encontrados",
      cell: (r) => (
        <span className={r.found_count > 0 ? "text-emerald-600" : "text-muted-foreground"}>
          {r.found_count}
        </span>
      ),
    },
    {
      key: "not_found_count",
      header: "No hallados",
      cell: (r) => (
        <span className={r.not_found_count > 0 ? "text-red-500" : "text-muted-foreground"}>
          {r.not_found_count}
        </span>
      ),
    },
    {
      key: "pending_count",
      header: "Pendientes",
      cell: (r) => (
        <span className={r.pending_count > 0 ? "text-amber-600" : "text-muted-foreground"}>
          {r.pending_count}
        </span>
      ),
    },
  ]

  const lineColumns: DataTableColumn<PhysicalCountLineRead>[] = [
    {
      key: "found",
      header: "",
      cell: (r) => {
        if (selectedCount?.status !== "DRAFT") {
          return r.found === true ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : r.found === false ? (
            <span className="text-xs text-red-500 font-medium">✗</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )
        }
        return (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void toggleFound(r, true) }}
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px] font-medium border transition-colors",
                r.found === true
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600"
                  : "border-border text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-600",
              )}
            >
              ✓
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void toggleFound(r, false) }}
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px] font-medium border transition-colors",
                r.found === false
                  ? "border-red-500/40 bg-red-500/10 text-red-500"
                  : "border-border text-muted-foreground hover:border-red-500/40 hover:text-red-500",
              )}
            >
              ✗
            </button>
          </div>
        )
      },
    },
    { key: "asset_code", header: "Código", cell: (r) => <span className="font-mono text-xs">{r.asset_code}</span> },
    { key: "asset_name", header: "Activo", cell: (r) => r.asset_name },
    { key: "expected_location", header: "Ubicación esperada", cell: (r) => r.expected_location ?? "—" },
    { key: "scanned_location", header: "Ubicación hallada", cell: (r) => r.scanned_location ?? "—" },
    { key: "notes", header: "Notas", cell: (r) => r.notes ?? "—" },
  ]

  if (selectedCount) {
    const isDraft = selectedCount.status === "DRAFT"
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedCount(null)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Conteos
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex flex-1 items-center gap-3">
            <div>
              <h1 className="text-sm font-semibold text-foreground">
                Conteo {new Date(selectedCount.count_date + "T12:00:00").toLocaleDateString("es-MX")}
              </h1>
              <p className="text-xs text-muted-foreground">
                {selectedCount.location_filter ? `Ubicación: ${selectedCount.location_filter} · ` : ""}
                {selectedCount.total_lines} activos · {selectedCount.found_count} encontrados · {selectedCount.not_found_count} no hallados · {selectedCount.pending_count} pendientes
              </p>
            </div>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                STATUS_COLORS[selectedCount.status],
              )}
            >
              {STATUS_LABELS[selectedCount.status]}
            </span>
          </div>
          {isDraft && (
            <Button onClick={() => void handleConfirm()} disabled={confirming}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {confirming ? "Confirmando…" : "Confirmar Conteo"}
            </Button>
          )}
        </div>

        {/* Lines table */}
        <div className="surface-card flex-1 overflow-hidden">
          <DataTable
            columns={lineColumns}
            rows={lines ?? []}
            rowKey={(r) => r.id}
            emptyLabel={
              linesStatus === "loading" || linesStatus === "idle"
                ? "Cargando…"
                : "Sin líneas en este conteo"
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h1 className="text-lg font-semibold text-foreground">Conteos Físicos</h1>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Nuevo Conteo
        </Button>
      </div>

      {/* KPI strip */}
      {counts && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total conteos", value: counts.length },
            { label: "En borrador", value: counts.filter((c) => c.status === "DRAFT").length },
            { label: "Confirmados", value: counts.filter((c) => c.status === "CONFIRMED").length },
          ].map((kpi) => (
            <div key={kpi.label} className="surface-card px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {kpi.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Counts table */}
      <div className="surface-card flex-1 overflow-hidden">
        <DataTable
          columns={countColumns}
          rows={counts ?? []}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelectedCount(r)}
          emptyLabel={
            countsStatus === "loading" || countsStatus === "idle"
              ? "Cargando…"
              : "Sin conteos registrados"
          }
        />
      </div>

      <CreateCountModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={(count) => {
          refreshCounts()
          setSelectedCount(count)
        }}
      />
    </div>
  )
}
