import { useCallback, useState } from "react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import { assetsService } from "@/services/assetsService"
import { useAuthStore } from "@/stores/authStore"
import { cn } from "@/lib/utils"
import type { InventoryCurrentItem } from "@/types/assets"

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })
const fmtQty = (n: number) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(n)

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
  if (!status) return <span className="text-white/30">—</span>
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

// ── Table columns ─────────────────────────────────────────────────────────────

const COLUMNS: DataTableColumn<InventoryCurrentItem>[] = [
  { key: "sku",              header: "SKU",         cell: (r) => r.sku ?? "—" },
  { key: "name",             header: "Nombre",      cell: (r) => r.name },
  { key: "category",        header: "Categoría",   cell: (r) => r.category ?? "—" },
  { key: "quantity_on_hand", header: "Stock",       cell: (r) => fmtQty(r.quantity_on_hand) },
  { key: "avg_unit_cost",    header: "Costo Prom.", cell: (r) => r.avg_unit_cost != null ? fmt.format(r.avg_unit_cost) : "—" },
  { key: "total_value",      header: "Valor Total", cell: (r) => r.total_value != null ? fmt.format(r.total_value) : "—" },
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

  return (
    <div className="space-y-6">
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
