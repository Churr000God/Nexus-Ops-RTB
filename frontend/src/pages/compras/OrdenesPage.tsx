import { useCallback, useState } from "react"
import { ShoppingCart } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import { getPurchaseOrders } from "@/services/comprasService"
import type { PurchaseOrderListItem, POStatus } from "@/types/compras"
import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<string, string> = {
  DRAFT:            "border-slate-500/30 bg-slate-500/10 text-slate-400",
  SENT:             "border-blue-500/30 bg-blue-500/10 text-blue-400",
  CONFIRMED:        "border-teal-500/30 bg-teal-500/10 text-teal-400",
  PARTIAL_RECEIVED: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  RECEIVED:         "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  INVOICED:         "border-violet-500/30 bg-violet-500/10 text-violet-400",
  PAID:             "border-green-500/30 bg-green-500/10 text-green-400",
  CANCELLED:        "border-red-900/30 bg-red-900/10 text-red-600",
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT:            "Borrador",
  SENT:             "Enviada",
  CONFIRMED:        "Confirmada",
  PARTIAL_RECEIVED: "Recepción parcial",
  RECEIVED:         "Recibida",
  INVOICED:         "Facturada",
  PAID:             "Pagada",
  CANCELLED:        "Cancelada",
}

const TYPE_LABELS: Record<string, string> = {
  GOODS:    "Bienes",
  SERVICES: "Servicios",
  MIXED:    "Mixta",
}

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("es-MX") : "—"

const COLUMNS: DataTableColumn<PurchaseOrderListItem>[] = [
  { key: "po_number",             header: "# OC",            cell: (r) => r.po_number },
  { key: "po_type",               header: "Tipo",            cell: (r) => TYPE_LABELS[r.po_type] ?? r.po_type },
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
  { key: "issue_date",            header: "Fecha emisión",   cell: (r) => fmtDate(r.issue_date) },
  { key: "estimated_pickup_date", header: "Est. recolección", cell: (r) => fmtDate(r.estimated_pickup_date) },
  { key: "total",                 header: "Total",            cell: (r) => r.total != null ? fmt.format(r.total) : "—" },
]

const STATUS_OPTIONS: { value: POStatus | ""; label: string }[] = [
  { value: "",                 label: "Todos los estatus" },
  { value: "DRAFT",            label: "Borrador" },
  { value: "SENT",             label: "Enviada" },
  { value: "CONFIRMED",        label: "Confirmada" },
  { value: "PARTIAL_RECEIVED", label: "Recepción parcial" },
  { value: "RECEIVED",         label: "Recibida" },
  { value: "INVOICED",         label: "Facturada" },
  { value: "PAID",             label: "Pagada" },
  { value: "CANCELLED",        label: "Cancelada" },
]

export default function OrdenesPage() {
  const [filterStatus, setFilterStatus] = useState<POStatus | "">("")

  const fetcher = useCallback(
    (signal: AbortSignal) => getPurchaseOrders({ status: filterStatus || undefined }, signal),
    [filterStatus],
  )
  const { data, status } = useApi(fetcher)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-6 w-6 text-[hsl(var(--primary))]" />
        <h1 className="text-xl font-semibold text-white">Órdenes de Compra</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-md border border-white/10 bg-background px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as POStatus | "")}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={COLUMNS}
        rows={data ?? []}
        rowKey={(r) => String(r.po_id)}
        emptyLabel={
          status === "loading" ? "Cargando…"
          : status === "error" ? "Error al cargar órdenes"
          : "Sin órdenes de compra"
        }
      />
    </div>
  )
}
