import { useCallback, useMemo, useState } from "react"
import { Package, TrendingDown, TrendingUp, Warehouse } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import { assetsService } from "@/services/assetsService"
import { useAuthStore } from "@/stores/authStore"
import { cn } from "@/lib/utils"
import type { InventoryCurrentItem } from "@/types/assets"

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })
const fmtQty = (n: number) =>
  new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(n)

// ── Stock badge ───────────────────────────────────────────────────────────────

const STOCK_STATUS_LABELS: Record<string, string> = {
  OK: "OK",
  BELOW_MIN: "Bajo mínimo",
  OUT: "Sin stock",
}

const STOCK_STATUS_COLORS: Record<string, string> = {
  OK: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  BELOW_MIN: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  OUT: "border-red-500/30 bg-red-500/10 text-red-400",
}

function StockBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-slate-500">—</span>
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STOCK_STATUS_COLORS[status] ?? "border-slate-500/30 bg-slate-500/10 text-slate-400",
      )}
    >
      {STOCK_STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

type KpiTone = "green" | "red" | "amber" | "blue" | "violet" | "neutral"

const KPI_TONE: Record<KpiTone, string> = {
  green:   "border-emerald-500/30 bg-emerald-500/10",
  red:     "border-red-500/30    bg-red-500/10",
  amber:   "border-amber-500/30  bg-amber-500/10",
  blue:    "border-blue-500/30   bg-blue-500/10",
  violet:  "border-violet-500/30 bg-violet-500/10",
  neutral: "border-slate-500/30  bg-slate-500/10",
}

const KPI_ICON_TONE: Record<KpiTone, string> = {
  green:   "text-emerald-400",
  red:     "text-red-400",
  amber:   "text-amber-400",
  blue:    "text-blue-400",
  violet:  "text-violet-400",
  neutral: "text-slate-400",
}

const KPI_VALUE_TONE: Record<KpiTone, string> = {
  green:   "text-emerald-300",
  red:     "text-red-300",
  amber:   "text-amber-300",
  blue:    "text-blue-300",
  violet:  "text-violet-300",
  neutral: "text-slate-300",
}

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "neutral",
}: {
  title: string
  value: string
  description?: string
  icon: React.ElementType
  tone?: KpiTone
}) {
  return (
    <div className={cn("rounded-xl border p-4", KPI_TONE[tone])}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-4 w-4", KPI_ICON_TONE[tone])} aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      </div>
      <p className={cn("text-xl font-bold", KPI_VALUE_TONE[tone])}>{value}</p>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
    </div>
  )
}

// ── Table columns ─────────────────────────────────────────────────────────────

const COLUMNS: DataTableColumn<InventoryCurrentItem>[] = [
  { key: "sku",            header: "SKU",              cell: (r) => r.sku ?? "—" },
  { key: "name",           header: "Nombre",           cell: (r) => r.name },
  { key: "category",       header: "Categoría",        cell: (r) => r.category ?? "—" },
  { key: "quantity_on_hand", header: "Stock Real",     cell: (r) => fmtQty(r.quantity_on_hand) },
  {
    key: "theoretical_qty",
    header: "Stock Teórico",
    cell: (r) => r.theoretical_qty != null ? fmtQty(r.theoretical_qty) : "—",
  },
  {
    key: "avg_unit_cost",
    header: "Costo Prom.",
    cell: (r) => r.avg_unit_cost != null ? fmt.format(r.avg_unit_cost) : "—",
  },
  {
    key: "total_value",
    header: "Valor Real",
    cell: (r) => r.total_value != null ? fmt.format(r.total_value) : "—",
  },
  {
    key: "theoretical_value",
    header: "Valor Teórico",
    cell: (r) => r.theoretical_value != null ? fmt.format(r.theoretical_value) : "—",
  },
  {
    key: "stock_status",
    header: "Estado",
    cell: (r) => <StockBadge status={r.stock_status ?? null} />,
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

type StockTab = "vendible" | "interno"

export function AlmacenPage() {
  const token = useAuthStore((s) => s.accessToken)
  const [stockTab, setStockTab] = useState<StockTab>("vendible")
  const [filterStatus, setFilterStatus] = useState("")

  const vendibleFetcher = useCallback(
    (signal: AbortSignal) =>
      assetsService.getVendible(token, { stock_status: filterStatus || undefined, limit: 500 }, signal),
    [token, filterStatus],
  )
  const internoFetcher = useCallback(
    (signal: AbortSignal) =>
      assetsService.getInterno(token, { stock_status: filterStatus || undefined, limit: 500 }, signal),
    [token, filterStatus],
  )

  const { data: vendible, status: vendibleStatus } = useApi(vendibleFetcher, {
    enabled: stockTab === "vendible",
  })
  const { data: interno, status: internoStatus } = useApi(internoFetcher, {
    enabled: stockTab === "interno",
  })

  const rows = stockTab === "vendible" ? (vendible ?? []) : (interno ?? [])
  const tableStatus = stockTab === "vendible" ? vendibleStatus : internoStatus

  // KPIs computados desde las filas cargadas
  const kpis = useMemo(() => {
    const conStock      = rows.filter((r) => r.quantity_on_hand > 0).length
    const sinStock      = rows.filter((r) => r.quantity_on_hand === 0).length
    const stockNegativo = rows.filter((r) => r.quantity_on_hand < 0).length
    const montoReal     = rows.reduce((s, r) => s + (r.total_value ?? 0), 0)
    const montoTeorico  = rows.reduce((s, r) => s + (r.theoretical_value ?? 0), 0)
    return { conStock, sinStock, stockNegativo, montoReal, montoTeorico }
  }, [rows])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Warehouse className="h-6 w-6 text-[hsl(var(--primary))]" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Control de Almacén</h1>
            <p className="text-sm text-gray-500">
              Stock en tiempo real desde movimientos de inventario · Costo promedio ponderado
            </p>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          title="Con Stock"
          value={String(kpis.conStock)}
          description="SKUs con cantidad > 0"
          icon={Package}
          tone="green"
        />
        <KpiCard
          title="Sin Stock"
          value={String(kpis.sinStock)}
          description="SKUs con cantidad = 0"
          icon={Package}
          tone="amber"
        />
        <KpiCard
          title="Stock Negativo"
          value={String(kpis.stockNegativo)}
          description="SKUs con cantidad < 0"
          icon={TrendingDown}
          tone="red"
        />
        <KpiCard
          title="Valor Real"
          value={fmt.format(kpis.montoReal)}
          description="Costo prom. × stock real"
          icon={TrendingUp}
          tone="blue"
        />
        <KpiCard
          title="Valor Teórico"
          value={kpis.montoTeorico > 0 ? fmt.format(kpis.montoTeorico) : "—"}
          description="Costo prom. × stock teórico"
          icon={TrendingUp}
          tone="violet"
        />
      </div>

      {/* Tab strip + filtro */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {(["vendible", "interno"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStockTab(tab)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                stockTab === tab
                  ? "bg-[hsl(var(--primary))] text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50",
              )}
            >
              {tab === "vendible" ? "Inventario Vendible" : "Inventario Interno"}
            </button>
          ))}
        </div>

        <select
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="OK">OK</option>
          <option value="BELOW_MIN">Bajo mínimo</option>
          <option value="OUT">Sin stock</option>
        </select>
      </div>

      {/* Tabla */}
      <DataTable
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.product_id}
        maxHeight="calc(100vh - 430px)"
        emptyLabel={
          tableStatus === "loading" || tableStatus === "idle"
            ? "Cargando…"
            : tableStatus === "error"
              ? "Error al cargar inventario"
              : "Sin productos"
        }
      />
    </div>
  )
}
