import { useCallback, useState } from "react"
import {
  Package,
  ChevronUp,
  Eye,
  CheckCircle2,
  Clock,
  Loader2,
  PackageCheck,
  Search,
  X,
  FileText,
  Filter,
  Boxes,
} from "lucide-react"
import { toast } from "sonner"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useApi } from "@/hooks/useApi"
import { CACHE_KEYS, STALE } from "@/lib/queryCache"
import { getOrders, updateOrder, packOrderItem } from "@/services/ventasLogisticaService"
import type { Order, OrderItem, OrderUpdate } from "@/types/ventasLogistica"
import { cn } from "@/lib/utils"

// ─── Status maps ─────────────────────────────────────────────────────────────

const ORDER_STATUS_COLORS: Record<string, string> = {
  CREATED:           "border-amber-300 bg-amber-50 text-amber-700",
  CONFIRMED:         "border-blue-300 bg-blue-50 text-blue-700",
  IN_PRODUCTION:     "border-violet-300 bg-violet-50 text-violet-700",
  READY_TO_SHIP:     "border-teal-300 bg-teal-50 text-teal-700",
  PARTIALLY_SHIPPED: "border-amber-300 bg-amber-50 text-amber-700",
  SHIPPED:           "border-sky-300 bg-sky-50 text-sky-700",
  DELIVERED:         "border-emerald-300 bg-emerald-50 text-emerald-700",
  INVOICED:          "border-purple-300 bg-purple-50 text-purple-700",
  PARTIALLY_PAID:    "border-orange-300 bg-orange-50 text-orange-700",
  PAID:              "border-green-300 bg-green-50 text-green-700",
  CANCELLED:         "border-red-300 bg-red-50 text-red-700",
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  CREATED:           "Creado",
  CONFIRMED:         "Confirmado",
  IN_PRODUCTION:     "En producción",
  READY_TO_SHIP:     "Listo para envío",
  PARTIALLY_SHIPPED: "Parcialmente enviado",
  SHIPPED:           "Enviado",
  DELIVERED:         "Entregado",
  INVOICED:          "Facturado",
  PARTIALLY_PAID:    "Parcialmente pagado",
  PAID:              "Pagado",
  CANCELLED:         "Cancelado",
}

const PACKING_COLORS: Record<string, string> = {
  NOT_STARTED:      "border-slate-300 bg-slate-100 text-slate-700",
  IN_PROGRESS:      "border-amber-300 bg-amber-50 text-amber-700",
  READY:            "border-emerald-300 bg-emerald-50 text-emerald-700",
  PACKED_FOR_ROUTE: "border-teal-300 bg-teal-50 text-teal-700",
  DISPATCHED:       "border-blue-300 bg-blue-50 text-blue-700",
}

const PACKING_LABELS: Record<string, string> = {
  NOT_STARTED:      "Sin iniciar",
  IN_PROGRESS:      "Empacando",
  READY:            "Listo",
  PACKED_FOR_ROUTE: "En ruta",
  DISPATCHED:       "Despachado",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })

function StatusBadge({ value, colorMap, labelMap }: {
  value: string
  colorMap: Record<string, string>
  labelMap: Record<string, string>
}) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
      colorMap[value] ?? "border-slate-300 bg-slate-100 text-slate-700"
    )}>
      {labelMap[value] ?? value}
    </span>
  )
}

// ─── Order detail panel ───────────────────────────────────────────────────────

function OrderDetailPanel({
  order,
  onClose,
  onUpdate,
}: {
  order: Order
  onClose: () => void
  onUpdate: () => void
}) {
  const [packInputs, setPackInputs] = useState<Record<number, string>>(
    Object.fromEntries(order.items.map((it) => [it.order_item_id, String(it.quantity_packed)]))
  )
  const [saving, setSaving] = useState<number | null>(null)

  const handleSavePack = async (item: OrderItem) => {
    const val = parseFloat(packInputs[item.order_item_id] ?? "0")
    if (isNaN(val) || val < 0 || val > item.quantity_ordered) {
      toast.error("Cantidad inválida")
      return
    }
    setSaving(item.order_item_id)
    try {
      await packOrderItem(order.order_id, item.order_item_id, { quantity_packed: val })
      toast.success("Empacado actualizado")
      onUpdate()
    } catch {
      toast.error("Error al actualizar empacado")
    } finally {
      setSaving(null)
    }
  }

  const totalPacked = order.items.reduce((s, i) => s + i.quantity_packed, 0)
  const totalOrdered = order.items.reduce((s, i) => s + i.quantity_ordered, 0)
  const packPct = totalOrdered > 0 ? Math.round((totalPacked / totalOrdered) * 100) : 0

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">{order.order_number}</CardTitle>
              <StatusBadge value={order.status} colorMap={ORDER_STATUS_COLORS} labelMap={ORDER_STATUS_LABELS} />
              <StatusBadge value={order.packing_status} colorMap={PACKING_COLORS} labelMap={PACKING_LABELS} />
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Cliente #{order.customer_id}</span>
              <span>·</span>
              <span>Pedido: {String(order.order_date)}</span>
              {order.requested_delivery_date && (
                <>
                  <span>·</span>
                  <span>Entrega: {String(order.requested_delivery_date)}</span>
                </>
              )}
            </div>
            {order.internal_notes && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <FileText className="h-3 w-3 shrink-0" />
                {order.internal_notes}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Packing progress bar */}
        {totalOrdered > 0 && (
          <div className="space-y-2 rounded-xl border border-border bg-accent/30 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <Boxes className="h-3.5 w-3.5" />
                Progreso de empacado
              </span>
              <span className={cn(
                "font-semibold",
                packPct >= 100 ? "text-emerald-600" : packPct > 0 ? "text-amber-600" : "text-muted-foreground"
              )}>
                {packPct}% ({totalPacked}/{totalOrdered})
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  packPct >= 100 ? "bg-emerald-500" : "bg-amber-500"
                )}
                style={{ width: `${Math.min(packPct, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Items table */}
        {order.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-accent/20 p-6 text-center text-sm text-muted-foreground">
            <Package className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2">Sin partidas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">#</th>
                  <th className="pb-2 pr-3 font-medium">SKU</th>
                  <th className="pb-2 pr-3 font-medium">Descripción</th>
                  <th className="pb-2 pr-3 text-right font-medium">Ordenado</th>
                  <th className="pb-2 pr-3 font-medium">Empacar</th>
                  <th className="pb-2 pr-3 text-right font-medium">Precio</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it, idx) => {
                  const packed = parseFloat(packInputs[it.order_item_id] ?? "0")
                  const rowPct = it.quantity_ordered > 0 ? packed / it.quantity_ordered : 0
                  return (
                    <tr key={it.order_item_id} className="border-b border-border/50 transition-colors hover:bg-accent/30">
                      <td className="py-2.5 pr-3 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2.5 pr-3 font-mono text-muted-foreground">{it.sku ?? "—"}</td>
                      <td className="py-2.5 pr-3 max-w-[200px] truncate text-foreground">
                        {it.description}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono">{it.quantity_ordered}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="w-12 overflow-hidden rounded-full bg-muted" style={{ height: 4 }}>
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                rowPct >= 1 ? "bg-emerald-500" : rowPct > 0 ? "bg-amber-500" : "bg-slate-300"
                              )}
                              style={{ width: `${Math.min(rowPct * 100, 100)}%` }}
                            />
                          </div>
                          <Input
                            type="number"
                            min={0}
                            max={it.quantity_ordered}
                            step="any"
                            value={packInputs[it.order_item_id] ?? ""}
                            onChange={(e) =>
                              setPackInputs((p) => ({ ...p, [it.order_item_id]: e.target.value }))
                            }
                            className="h-7 w-16 px-1.5 text-right text-xs"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                            disabled={saving === it.order_item_id}
                            onClick={() => void handleSavePack(it)}
                          >
                            {saving === it.order_item_id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono text-muted-foreground">
                        {fmt.format(it.unit_price)}
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold text-emerald-600">
                        {fmt.format(it.total)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="rounded-xl border border-border bg-accent/30 p-4">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Subtotal</p>
              <p className="font-mono font-semibold text-foreground">{fmt.format(order.subtotal)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">IVA</p>
              <p className="font-mono font-semibold text-foreground">{fmt.format(order.tax_amount)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Total</p>
              <p className="font-mono font-semibold text-emerald-600">{fmt.format(order.total)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Pagado</p>
              <p className="font-mono font-semibold text-blue-600">{fmt.format(order.amount_paid)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PedidosPage() {
  const [filterStatus, setFilterStatus] = useState("")
  const [filterPacking, setFilterPacking] = useState("")
  const [search, setSearch] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [statusLoading, setStatusLoading] = useState<number | null>(null)

  const ordersApi = useApi(
    useCallback(
      (_signal: AbortSignal) =>
        getOrders({
          status: filterStatus || undefined,
          packing_status: filterPacking || undefined,
          limit: 150,
        }),
      [filterStatus, filterPacking]
    ),
    { cacheKey: `${CACHE_KEYS.PEDIDOS}-${filterStatus}-${filterPacking}`, staleTime: STALE.MEDIUM },
  )

  const orders = (ordersApi.data ?? []) as Order[]

  const filtered = orders.filter((o) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      o.order_number.toLowerCase().includes(q) ||
      String(o.customer_id).includes(q) ||
      (o.internal_notes ?? "").toLowerCase().includes(q)
    )
  })

  const kpiCreated   = orders.filter((o) => o.status === "CREATED").length
  const kpiNotPacked = orders.filter((o) => o.packing_status === "NOT_STARTED").length
  const kpiReady     = orders.filter((o) => o.packing_status === "READY").length

  const handleStatusUpdate = async (order: Order, newStatus: string) => {
    setStatusLoading(order.order_id)
    try {
      await updateOrder(order.order_id, { status: newStatus as OrderUpdate["status"] })
      toast.success(`Pedido actualizado a "${ORDER_STATUS_LABELS[newStatus] ?? newStatus}"`)
      ordersApi.refetch()
      if (selectedOrder?.order_id === order.order_id) {
        setSelectedOrder((prev) => prev ? { ...prev, status: newStatus as Order["status"] } : prev)
      }
    } catch {
      toast.error("Error al actualizar estado del pedido")
    } finally {
      setStatusLoading(null)
    }
  }

  const columns: DataTableColumn<Order>[] = [
    {
      key: "order_number",
      header: "Pedido",
      className: "font-mono text-xs font-semibold",
      cell: (r) => r.order_number,
    },
    {
      key: "customer_id",
      header: "Cliente",
      className: "text-xs",
      cell: (r) => `#${r.customer_id}`,
    },
    {
      key: "order_date",
      header: "Fecha",
      className: "text-xs text-muted-foreground",
      cell: (r) => String(r.order_date),
    },
    {
      key: "requested_delivery_date",
      header: "Entrega req.",
      className: "text-xs text-muted-foreground",
      cell: (r) => r.requested_delivery_date ?? "—",
    },
    {
      key: "status",
      header: "Estado",
      cell: (r) => (
        <StatusBadge value={r.status} colorMap={ORDER_STATUS_COLORS} labelMap={ORDER_STATUS_LABELS} />
      ),
    },
    {
      key: "packing_status",
      header: "Empacado",
      cell: (r) => (
        <StatusBadge value={r.packing_status} colorMap={PACKING_COLORS} labelMap={PACKING_LABELS} />
      ),
    },
    {
      key: "items_count",
      header: "Partidas",
      className: "text-xs text-right",
      cell: (r) => <span className="text-muted-foreground">{r.items.length}</span>,
    },
    {
      key: "total",
      header: "Total",
      className: "text-right",
      cell: (r) => (
        <span className="font-mono text-xs font-semibold text-emerald-600">{fmt.format(r.total)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setSelectedOrder(selectedOrder?.order_id === r.order_id ? null : r)}
            title="Ver detalle"
          >
            {selectedOrder?.order_id === r.order_id ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
          {r.status === "CREATED" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-blue-600 hover:text-blue-500"
              disabled={statusLoading === r.order_id}
              onClick={() => void handleStatusUpdate(r, "CONFIRMED")}
              title="Confirmar pedido"
            >
              {statusLoading === r.order_id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PackageCheck className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Package className="h-5 w-5 text-violet-600" />
          Pedidos
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pedido, cliente, NR…"
              className="h-8 w-full pl-8 text-xs sm:w-56"
            />
          </div>
          <div className="relative">
            <Filter className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background pl-8 pr-6 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Todos los estados</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Boxes className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={filterPacking}
              onChange={(e) => setFilterPacking(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background pl-8 pr-6 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Todo empacado</option>
              {Object.entries(PACKING_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total pedidos", value: orders.length, icon: Package,      color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Nuevos",        value: kpiCreated,    icon: Clock,         color: "text-amber-600",  bg: "bg-amber-50" },
          { label: "Sin empacar",   value: kpiNotPacked,  icon: Package,       color: "text-red-600",    bg: "bg-red-50" },
          { label: "Listos",        value: kpiReady,      icon: CheckCircle2,  color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((kpi) => (
          <Card key={kpi.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", kpi.bg)}>
                  <kpi.icon className={cn("h-4 w-4 shrink-0", kpi.color)} />
                </div>
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="mt-2 font-mono text-2xl font-semibold text-foreground">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => String(r.order_id)}
        emptyLabel="Sin pedidos"
        selectedRowKey={selectedOrder ? String(selectedOrder.order_id) : undefined}
      />

      {/* Detail panel */}
      {selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={() => ordersApi.refetch()}
        />
      )}
    </div>
  )
}
