import { useCallback, useState } from "react"
import { Truck } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import { getShipments } from "@/services/ventasLogisticaService"
import type { Shipment, ShipmentStatus } from "@/types/ventasLogistica"
import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<ShipmentStatus, string> = {
  PREPARING: "border-slate-500/30 bg-slate-500/10 text-slate-400",
  READY: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  IN_TRANSIT: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  DELIVERED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  RETURNED: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  INCIDENT: "border-red-500/30 bg-red-500/10 text-red-400",
  CANCELLED: "border-red-900/30 bg-red-900/10 text-red-600",
}

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  PREPARING: "Preparando",
  READY: "Listo",
  IN_TRANSIT: "En tránsito",
  DELIVERED: "Entregado",
  RETURNED: "Devuelto",
  INCIDENT: "Incidente",
  CANCELLED: "Cancelado",
}

export default function EnviosPage() {
  const [filterStatus, setFilterStatus] = useState("")

  const api = useApi(
    useCallback(
      (_signal: AbortSignal) => getShipments({ status: filterStatus || undefined, limit: 100 }),
      [filterStatus]
    )
  )

  const shipments = (api.data ?? []) as Shipment[]

  const columns: DataTableColumn<Shipment>[] = [
    { key: "shipment_number", header: "Envío", className: "font-mono text-xs", cell: (r) => r.shipment_number },
    { key: "order_id", header: "Pedido ID", className: "text-xs", cell: (r) => String(r.order_id) },
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
    { key: "tracking_number", header: "Guía", className: "font-mono text-xs", cell: (r) => r.tracking_number ?? "—" },
    { key: "shipping_date", header: "Salida", className: "text-xs", cell: (r) => r.shipping_date ?? "—" },
    { key: "estimated_arrival", header: "ETA", className: "text-xs", cell: (r) => r.estimated_arrival ?? "—" },
    { key: "actual_arrival", header: "Llegada real", className: "text-xs", cell: (r) => r.actual_arrival ?? "—" },
    { key: "received_by_name", header: "Recibió", className: "text-xs text-slate-400", cell: (r) => r.received_by_name ?? "—" },
    {
      key: "tracking_events",
      header: "Tracking",
      cell: (r) => <span className="text-xs text-slate-400">{r.tracking_events.length} eventos</span>,
    },
  ]

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-base font-semibold text-slate-200">
          <Truck className="h-5 w-5 text-blue-400" />
          Envíos
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
        rows={shipments}
        rowKey={(r) => String(r.shipment_id)}
        emptyLabel="Sin envíos"
      />
    </div>
  )
}
