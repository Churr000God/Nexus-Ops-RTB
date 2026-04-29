import { useCallback, useState } from "react"
import { ClipboardList } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import { getPurchaseRequests } from "@/services/comprasService"
import type { PurchaseRequestListItem, PRStatus } from "@/types/compras"
import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<string, string> = {
  DRAFT:              "border-slate-500/30 bg-slate-500/10 text-slate-400",
  APPROVED:           "border-blue-500/30 bg-blue-500/10 text-blue-400",
  PARTIALLY_ORDERED:  "border-amber-500/30 bg-amber-500/10 text-amber-400",
  ORDERED:            "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  REJECTED:           "border-red-900/30 bg-red-900/10 text-red-600",
  CANCELLED:          "border-slate-700/30 bg-slate-700/10 text-slate-500",
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT:              "Borrador",
  APPROVED:           "Aprobada",
  PARTIALLY_ORDERED:  "Parcialmente ordenada",
  ORDERED:            "Ordenada",
  REJECTED:           "Rechazada",
  CANCELLED:          "Cancelada",
}

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("es-MX") : "—"

const COLUMNS: DataTableColumn<PurchaseRequestListItem>[] = [
  { key: "request_number", header: "# Solicitud", cell: (r) => r.request_number },
  { key: "request_date",   header: "Fecha",        cell: (r) => fmtDate(r.request_date) },
  {
    key: "status",
    header: "Estatus",
    cell: (r) => (
      <span className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STATUS_COLORS[r.status] ?? STATUS_COLORS.DRAFT
      )}>
        {STATUS_LABELS[r.status] ?? r.status}
      </span>
    ),
  },
  { key: "notes",      header: "Notas",   cell: (r) => r.notes ?? "—" },
  { key: "created_at", header: "Creada",  cell: (r) => fmtDate(r.created_at) },
]

const STATUS_OPTIONS: { value: PRStatus | ""; label: string }[] = [
  { value: "", label: "Todos los estatus" },
  { value: "DRAFT",             label: "Borrador" },
  { value: "APPROVED",          label: "Aprobada" },
  { value: "PARTIALLY_ORDERED", label: "Parcialmente ordenada" },
  { value: "ORDERED",           label: "Ordenada" },
  { value: "REJECTED",          label: "Rechazada" },
  { value: "CANCELLED",         label: "Cancelada" },
]

export default function SolicitudesPage() {
  const [filterStatus, setFilterStatus] = useState<PRStatus | "">("")

  const fetcher = useCallback(
    (signal: AbortSignal) => getPurchaseRequests({ status: filterStatus || undefined }, signal),
    [filterStatus],
  )
  const { data, status } = useApi(fetcher)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-[hsl(var(--primary))]" />
        <h1 className="text-xl font-semibold text-white">Solicitudes de Material</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-md border border-white/10 bg-background px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as PRStatus | "")}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={COLUMNS}
        rows={data ?? []}
        rowKey={(r) => String(r.request_id)}
        emptyLabel={
          status === "loading" ? "Cargando…"
          : status === "error" ? "Error al cargar solicitudes"
          : "Sin solicitudes"
        }
      />
    </div>
  )
}
