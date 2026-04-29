import { useCallback, useState } from "react"
import { FileText } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import { getDeliveryNotes } from "@/services/ventasLogisticaService"
import type { DeliveryNote, DeliveryNoteStatus } from "@/types/ventasLogistica"
import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<DeliveryNoteStatus, string> = {
  DRAFT: "border-slate-500/30 bg-slate-500/10 text-slate-400",
  ISSUED: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  DELIVERED: "border-teal-500/30 bg-teal-500/10 text-teal-400",
  TRANSFORMED: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  PARTIALLY_INVOICED: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  INVOICED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  CANCELLED: "border-red-900/30 bg-red-900/10 text-red-600",
}

const STATUS_LABELS: Record<DeliveryNoteStatus, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitida",
  DELIVERED: "Entregada",
  TRANSFORMED: "Transformada",
  PARTIALLY_INVOICED: "Parcialmente facturada",
  INVOICED: "Facturada",
  CANCELLED: "Cancelada",
}

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })

export default function NotasRemisionPage() {
  const [filterStatus, setFilterStatus] = useState("")

  const api = useApi(
    useCallback(
      (_signal: AbortSignal) => getDeliveryNotes({ status: filterStatus || undefined, limit: 100 }),
      [filterStatus]
    )
  )

  const notes = (api.data ?? []) as DeliveryNote[]

  const columns: DataTableColumn<DeliveryNote>[] = [
    { key: "note_number", header: "NR", className: "font-mono text-xs", cell: (r) => r.note_number },
    { key: "customer_id", header: "Cliente ID", className: "text-xs", cell: (r) => String(r.customer_id) },
    { key: "issue_date", header: "Emisión", className: "text-xs", cell: (r) => String(r.issue_date) },
    { key: "delivery_date", header: "Entrega", className: "text-xs", cell: (r) => r.delivery_date ?? "—" },
    {
      key: "status",
      header: "Estado",
      cell: (r) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
            STATUS_COLORS[r.status] ?? "border-slate-500/30 bg-slate-500/10 text-slate-400"
          )}
        >
          {STATUS_LABELS[r.status] ?? r.status}
        </span>
      ),
    },
    { key: "customer_po_number", header: "OC Cliente", className: "text-xs", cell: (r) => r.customer_po_number ?? "—" },
    {
      key: "total",
      header: "Total",
      cell: (r) => (
        <span className="font-mono text-xs font-semibold text-emerald-400">{fmt.format(r.total)}</span>
      ),
    },
    {
      key: "items",
      header: "Partidas",
      cell: (r) => <span className="text-xs text-slate-400">{r.items.length}</span>,
    },
  ]

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-base font-semibold text-slate-200">
          <FileText className="h-5 w-5 text-amber-400" />
          Notas de Remisión
        </h1>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-8 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-slate-300 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={notes}
        rowKey={(r) => String(r.delivery_note_id)}
        emptyLabel="Sin notas de remisión"
      />
    </div>
  )
}
