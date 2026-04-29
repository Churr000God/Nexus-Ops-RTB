import { useCallback, useState } from "react"
import { Package } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import { getOrders } from "@/services/ventasLogisticaService"
import type { Order } from "@/types/ventasLogistica"
import { cn } from "@/lib/utils"

const ORDER_STATUS_COLORS: Record<string, string> = {
  CREATED: "border-slate-500/30 bg-slate-500/10 text-slate-400",
  CONFIRMED: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  IN_PRODUCTION: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  READY_TO_SHIP: "border-teal-500/30 bg-teal-500/10 text-teal-400",
  PARTIALLY_SHIPPED: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  SHIPPED: "border-blue-400/30 bg-blue-400/10 text-blue-300",
  DELIVERED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  INVOICED: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  PARTIALLY_PAID: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  PAID: "border-green-500/30 bg-green-500/10 text-green-400",
  CANCELLED: "border-red-900/30 bg-red-900/10 text-red-600",
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  CREATED: "Creado",
  CONFIRMED: "Confirmado",
  IN_PRODUCTION: "En producción",
  READY_TO_SHIP: "Listo para envío",
  PARTIALLY_SHIPPED: "Parcialmente enviado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  INVOICED: "Facturado",
  PARTIALLY_PAID: "Parcialmente pagado",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
}

const PACKING_STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: "border-slate-500/30 bg-slate-500/10 text-slate-400",
  IN_PROGRESS: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  READY: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  PACKED_FOR_ROUTE: "border-teal-500/30 bg-teal-500/10 text-teal-400",
  DISPATCHED: "border-blue-500/30 bg-blue-500/10 text-blue-400",
}

const PACKING_LABELS: Record<string, string> = {
  NOT_STARTED: "Sin iniciar",
  IN_PROGRESS: "Empacando",
  READY: "Listo",
  PACKED_FOR_ROUTE: "En ruta",
  DISPATCHED: "Despachado",
}

function Badge({
  value,
  colorMap,
  labelMap,
}: {
  value: string
  colorMap: Record<string, string>
  labelMap: Record<string, string>
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        colorMap[value] ?? "border-slate-500/30 bg-slate-500/10 text-slate-400"
      )}
    >
      {labelMap[value] ?? value}
    </span>
  )
}

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })

export default function PedidosPage() {
  const [filterStatus, setFilterStatus] = useState("")
  const [filterPacking, setFilterPacking] = useState("")

  const ordersApi = useApi(
    useCallback(
      (_signal: AbortSignal) =>
        getOrders({
          status: filterStatus || undefined,
          packing_status: filterPacking || undefined,
          limit: 100,
        }),
      [filterStatus, filterPacking]
    )
  )

  const orders = (ordersApi.data ?? []) as Order[]

  const columns: DataTableColumn<Order>[] = [
    { key: "order_number", header: "Pedido", className: "font-mono text-xs", cell: (r) => r.order_number },
    { key: "customer_id", header: "Cliente ID", className: "text-xs", cell: (r) => String(r.customer_id) },
    { key: "order_date", header: "Fecha", className: "text-xs", cell: (r) => String(r.order_date) },
    {
      key: "status",
      header: "Estado",
      cell: (r) => <Badge value={r.status} colorMap={ORDER_STATUS_COLORS} labelMap={ORDER_STATUS_LABELS} />,
    },
    {
      key: "packing_status",
      header: "Empacado",
      cell: (r) => <Badge value={r.packing_status} colorMap={PACKING_STATUS_COLORS} labelMap={PACKING_LABELS} />,
    },
    {
      key: "total",
      header: "Total",
      cell: (r) => (
        <span className="font-mono text-xs font-semibold text-emerald-400">{fmt.format(r.total)}</span>
      ),
    },
    {
      key: "amount_paid",
      header: "Pagado",
      cell: (r) => <span className="font-mono text-xs text-slate-400">{fmt.format(r.amount_paid)}</span>,
    },
  ]

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-base font-semibold text-slate-200">
          <Package className="h-5 w-5 text-violet-400" />
          Pedidos
        </h1>
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-8 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-slate-300 focus:outline-none"
          >
            <option value="">Todos los estados</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filterPacking}
            onChange={(e) => setFilterPacking(e.target.value)}
            className="h-8 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-slate-300 focus:outline-none"
          >
            <option value="">Todo empacado</option>
            {Object.entries(PACKING_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={orders}
        rowKey={(r) => String(r.order_id)}
        emptyLabel="Sin pedidos"
      />
    </div>
  )
}
