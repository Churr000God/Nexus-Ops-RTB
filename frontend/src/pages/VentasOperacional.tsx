import { useCallback } from "react"
import { AlertTriangle, Package, Truck } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import { getIncompleteOrders, getShipmentsOverview } from "@/services/ventasLogisticaService"
import type { IncompleteOrder, ShipmentOverview } from "@/types/ventasLogistica"
import { cn } from "@/lib/utils"

const SHIPMENT_STATUS_COLORS: Record<string, string> = {
  PREPARING: "border-slate-500/30 bg-slate-500/10 text-slate-400",
  READY: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  IN_TRANSIT: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  DELIVERED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  RETURNED: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  INCIDENT: "border-red-500/30 bg-red-500/10 text-red-400",
  CANCELLED: "border-red-900/30 bg-red-900/10 text-red-600",
}

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  PREPARING: "Preparando",
  READY: "Listo",
  IN_TRANSIT: "En tránsito",
  DELIVERED: "Entregado",
  RETURNED: "Devuelto",
  INCIDENT: "Incidente",
  CANCELLED: "Cancelado",
}

function DaysOpenBadge({ days }: { days: number }) {
  const color =
    days > 30
      ? "border-red-500/30 bg-red-500/10 text-red-400"
      : days > 15
        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", color)}>
      {days}d
    </span>
  )
}

const incompleteColumns: DataTableColumn<IncompleteOrder>[] = [
  { key: "order_number", header: "Pedido", className: "font-mono text-xs", cell: (r) => r.order_number },
  { key: "customer", header: "Cliente", cell: (r) => r.customer },
  {
    key: "days_open",
    header: "Días abierto",
    cell: (r) => <DaysOpenBadge days={r.days_open} />,
  },
  {
    key: "qty_pending_to_ship",
    header: "Pend. embarque",
    cell: (r) => (
      <span className="font-mono text-xs text-amber-400">
        {Number(r.qty_pending_to_ship).toFixed(0)} / {Number(r.qty_total).toFixed(0)}
      </span>
    ),
  },
  { key: "status", header: "Estado", className: "text-xs text-slate-400", cell: (r) => r.status },
]

const shipmentColumns: DataTableColumn<ShipmentOverview>[] = [
  { key: "shipment_number", header: "Envío", className: "font-mono text-xs", cell: (r) => r.shipment_number },
  { key: "order_number", header: "Pedido", className: "font-mono text-xs", cell: (r) => r.order_number },
  { key: "customer", header: "Cliente", cell: (r) => r.customer },
  {
    key: "status",
    header: "Estado",
    cell: (r) => (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
          SHIPMENT_STATUS_COLORS[r.status] ?? "border-slate-500/30 bg-slate-500/10 text-slate-400"
        )}
      >
        {SHIPMENT_STATUS_LABELS[r.status] ?? r.status}
      </span>
    ),
  },
  { key: "carrier_name", header: "Fletera", cell: (r) => r.carrier_name ?? "—" },
  { key: "tracking_number", header: "Guía", className: "font-mono text-xs", cell: (r) => r.tracking_number ?? "—" },
  {
    key: "days_in_transit",
    header: "Días en tránsito",
    cell: (r) => (r.days_in_transit != null ? <DaysOpenBadge days={r.days_in_transit} /> : "—"),
  },
]

export default function VentasOperacional() {
  const incompleteApi = useApi(useCallback((_signal: AbortSignal) => getIncompleteOrders(), []))
  const shipmentsApi = useApi(useCallback((_signal: AbortSignal) => getShipmentsOverview(), []))

  const incomplete = (incompleteApi.data ?? []) as IncompleteOrder[]
  const shipments = (shipmentsApi.data ?? []) as ShipmentOverview[]

  const activeShipments = shipments.filter((s) => !["DELIVERED", "CANCELLED"].includes(s.status))
  const urgentOrders = incomplete.filter((o) => o.days_open > 15)

  return (
    <div className="space-y-6 p-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Pedidos incompletos", value: incomplete.length, icon: Package, color: "text-amber-400" },
          { label: "Urgentes (+15 días)", value: urgentOrders.length, icon: AlertTriangle, color: "text-red-400" },
          { label: "Envíos activos", value: activeShipments.length, icon: Truck, color: "text-blue-400" },
          { label: "En tránsito", value: shipments.filter((s) => s.status === "IN_TRANSIT").length, icon: Truck, color: "text-violet-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Icon className={cn("h-4 w-4", color)} />
              {label}
            </div>
            <p className={cn("mt-1 text-2xl font-bold", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Pedidos incompletos */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Package className="h-4 w-4 text-amber-400" />
          Pedidos incompletos — material pendiente de embarque
        </h2>
        <DataTable
          columns={incompleteColumns}
          rows={incomplete}
          rowKey={(r) => r.order_number}
          emptyLabel="Sin pedidos incompletos"
        />
      </section>

      {/* Envíos activos */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Truck className="h-4 w-4 text-blue-400" />
          Envíos activos
        </h2>
        <DataTable
          columns={shipmentColumns}
          rows={activeShipments}
          rowKey={(r) => r.shipment_number}
          emptyLabel="Sin envíos activos"
        />
      </section>
    </div>
  )
}
