import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  BoxesIcon,
  Download,
  FileText,
  Mail,
  Package,
  Search,
  TrendingDown,
  TrendingUp,
  Warehouse,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { AlmacenEmailReportModal } from "@/components/common/AlmacenEmailReportModal"
import { AlmacenReportModal } from "@/components/common/AlmacenReportModal"
import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { KpiCard } from "@/components/common/KpiCard"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/useApi"
import { useFilters } from "@/hooks/useFilters"
import { formatCurrencyMXN, formatNumber } from "@/lib/utils"
import { assetsService } from "@/services/assetsService"
import { inventarioService } from "@/services/inventarioService"
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
  OK: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  BELOW_MIN: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  OUT: "border-red-500/30 bg-red-500/10 text-red-600",
}

function StockBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STOCK_STATUS_COLORS[status] ?? "border-slate-500/30 bg-slate-500/10 text-slate-500",
      )}
    >
      {STOCK_STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ── Sort options ──────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: "total_value", label: "Valor Total" },
  { value: "quantity_on_hand", label: "Stock Real" },
  { value: "name", label: "Nombre" },
  { value: "sku", label: "SKU" },
  { value: "category", label: "Categoría" },
  { value: "avg_unit_cost", label: "Costo Prom." },
  { value: "stock_status", label: "Estado" },
]

// ── Table columns ─────────────────────────────────────────────────────────────

const COLUMNS: DataTableColumn<InventoryCurrentItem>[] = [
  { key: "sku", header: "SKU", cell: (r) => r.sku ?? "—" },
  { key: "name", header: "Nombre", cell: (r) => r.name },
  { key: "category", header: "Categoría", cell: (r) => r.category ?? "—" },
  {
    key: "quantity_on_hand",
    header: "Stock Real",
    cell: (r) => fmtQty(r.quantity_on_hand),
  },
  {
    key: "theoretical_qty",
    header: "Stock Teórico",
    cell: (r) => (r.theoretical_qty != null ? fmtQty(r.theoretical_qty) : "—"),
  },
  {
    key: "avg_unit_cost",
    header: "Costo Prom.",
    cell: (r) => (r.avg_unit_cost != null ? fmt.format(r.avg_unit_cost) : "—"),
  },
  {
    key: "total_value",
    header: "Valor Real",
    cell: (r) => (r.total_value != null ? fmt.format(r.total_value) : "—"),
  },
  {
    key: "theoretical_value",
    header: "Valor Teórico",
    cell: (r) => (r.theoretical_value != null ? fmt.format(r.theoretical_value) : "—"),
  },
  {
    key: "stock_status",
    header: "Estado",
    cell: (r) => <StockBadge status={r.stock_status ?? null} />,
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export function AlmacenPage() {
  const token = useAuthStore((s) => s.accessToken)
  const { startDate, endDate } = useFilters()
  const [stockTab, setStockTab] = useState<"vendible" | "interno">("vendible")
  const [filterStatus, setFilterStatus] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [sortBy, setSortBy] = useState("total_value")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)

  const PAGE_SIZE = 100
  const [page, setPage] = useState(0)

  // Debounce búsqueda
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Reset página al cambiar filtros o tab
  useEffect(() => {
    setPage(0)
  }, [filterStatus, debouncedSearch, categoryFilter, sortBy, sortOrder, stockTab])

  const kpisFetcher = useCallback(
    (signal: AbortSignal) => assetsService.getKpisV2(token, signal),
    [token],
  )
  const { data: kpisV2 } = useApi(kpisFetcher)

  const vendibleFetcher = useCallback(
    (signal: AbortSignal) =>
      assetsService.getVendible(
        token,
        {
          stock_status: filterStatus || undefined,
          search: debouncedSearch || undefined,
          category: categoryFilter || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        },
        signal,
      ),
    [token, filterStatus, debouncedSearch, categoryFilter, sortBy, sortOrder, page],
  )

  const internoFetcher = useCallback(
    (signal: AbortSignal) =>
      assetsService.getInterno(
        token,
        {
          stock_status: filterStatus || undefined,
          search: debouncedSearch || undefined,
          category: categoryFilter || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        },
        signal,
      ),
    [token, filterStatus, debouncedSearch, categoryFilter, sortBy, sortOrder, page],
  )

  const { data: vendible, status: vendibleStatus } = useApi(vendibleFetcher)
  const { data: interno, status: internoStatus } = useApi(internoFetcher)

  const rows = stockTab === "vendible" ? (vendible ?? []) : (interno ?? [])
  const tableStatus = stockTab === "vendible" ? vendibleStatus : internoStatus

  const tabKpis =
    stockTab === "vendible"
      ? {
          conStock: kpisV2?.con_stock_vendible ?? 0,
          sinStock: kpisV2?.sin_stock_vendible ?? 0,
          stockNegativo: kpisV2?.stock_negativo_vendible ?? 0,
          montoReal: kpisV2?.valor_total_vendible ?? 0,
          total: kpisV2?.total_vendible ?? 0,
        }
      : {
          conStock: kpisV2?.con_stock_interno ?? 0,
          sinStock: kpisV2?.sin_stock_interno ?? 0,
          stockNegativo: kpisV2?.stock_negativo_interno ?? 0,
          montoReal: kpisV2?.valor_total_interno ?? 0,
          total: kpisV2?.total_interno ?? 0,
        }

  const totalPages = Math.ceil(tabKpis.total / PAGE_SIZE)

  const hasActiveFilters = filterStatus || debouncedSearch || categoryFilter

  const clearFilters = () => {
    setFilterStatus("")
    setSearchQuery("")
    setDebouncedSearch("")
    setCategoryFilter("")
    setSortBy("total_value")
    setSortOrder("desc")
    setPage(0)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="surface-card">
        <div className="panel-header p-5 md:p-6">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge variant="success">En vivo</StatusBadge>
              <StatusBadge variant="info">
                {stockTab === "vendible" ? "Productos vendibles" : "Productos internos"}
              </StatusBadge>
            </div>
            <div className="flex items-center gap-3">
              <Warehouse className="h-6 w-6 text-[hsl(var(--primary))]" aria-hidden="true" />
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Control de Almacén
                </h1>
                <p className="text-sm text-muted-foreground">
                  Stock en tiempo real desde movimientos de inventario · Costo promedio ponderado
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 xl:min-w-[200px]">
            <Button type="button" variant="outline" onClick={() => setReportModalOpen(true)}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Reporte
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                toast.info("Generando CSV, espera un momento…")
                try {
                  const result = await inventarioService.downloadAlmacenCsv(token ?? "", {
                    startDate,
                    endDate,
                    sections: ["kpis", "valor", "alertas", "dormidos"],
                  })
                  const url = URL.createObjectURL(result.blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = result.filename
                  a.click()
                  URL.revokeObjectURL(url)
                  toast.success("CSV descargado correctamente")
                } catch {
                  toast.error("Error al descargar el CSV")
                }
              }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => setEmailModalOpen(true)}>
              <Mail className="h-4 w-4" aria-hidden="true" />
              Email
            </Button>
          </div>
        </div>
      </section>

      {/* Tab strip */}
      <div className="surface-card overflow-hidden">
        <div className="flex border-b border-border">
          {(["vendible", "interno"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setStockTab(t)}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium transition-colors",
                stockTab === t
                  ? "border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "vendible" ? "Inventario Vendible" : "Inventario Interno"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          title="Valor Total"
          value={formatCurrencyMXN(tabKpis.montoReal)}
          description={`Costo promedio × stock real (${stockTab === "vendible" ? "vendible" : "interno"})`}
          icon={TrendingUp}
          tone="blue"
        />
        <KpiCard
          title="Con Stock"
          value={formatNumber(tabKpis.conStock)}
          description="SKUs con cantidad > 0"
          icon={Package}
          tone="green"
        />
        <KpiCard
          title="Sin Stock"
          value={formatNumber(tabKpis.sinStock)}
          description="SKUs con cantidad = 0"
          icon={BoxesIcon}
          tone="neutral"
        />
        <KpiCard
          title="Stock Negativo"
          value={formatNumber(tabKpis.stockNegativo)}
          description="Salidas sin entrada registrada"
          icon={TrendingDown}
          tone="red"
          badge={tabKpis.stockNegativo > 0 ? { label: "Revisar", variant: "warning" } : undefined}
        />
        <KpiCard
          title="Bajo Mínimo"
          value={formatNumber(
            stockTab === "vendible"
              ? (kpisV2?.productos_below_min_vendible ?? 0)
              : (kpisV2?.productos_below_min_interno ?? 0),
          )}
          description="SKUs por debajo del stock mínimo"
          icon={AlertTriangle}
          tone="orange"
          badge={
            (stockTab === "vendible"
              ? kpisV2?.productos_below_min_vendible
              : kpisV2?.productos_below_min_interno) ?? 0
              ? { label: "Atención", variant: "warning" }
              : undefined
          }
        />
        <KpiCard
          title="Sin Stock"
          value={formatNumber(
            stockTab === "vendible"
              ? (kpisV2?.productos_out_of_stock_vendible ?? 0)
              : (kpisV2?.productos_out_of_stock_interno ?? 0),
          )}
          description="SKUs agotados"
          icon={ArrowLeftRight}
          tone="purple"
        />
      </div>

      {/* Toolbar: búsqueda, filtros y ordenamiento */}
      <div className="surface-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Búsqueda */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por SKU o nombre..."
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filtro categoría */}
          <div className="relative min-w-[180px]">
            <input
              type="text"
              placeholder="Filtrar categoría..."
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            />
          </div>

          {/* Filtro estado */}
          <select
            className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="OK">OK</option>
            <option value="BELOW_MIN">Bajo mínimo</option>
            <option value="OUT">Sin stock</option>
          </select>

          {/* Ordenamiento */}
          <div className="flex items-center gap-1">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent"
              title={sortOrder === "asc" ? "Ascendente" : "Descendente"}
            >
              {sortOrder === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Limpiar filtros */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-3.5 w-3.5" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <DataTable
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.product_id}
        maxHeight="calc(100vh - 560px)"
        emptyLabel={
          tableStatus === "loading" || tableStatus === "idle"
            ? "Cargando…"
            : tableStatus === "error"
              ? "Error al cargar inventario"
              : "Sin productos"
        }
      />
      <Pagination
        page={page}
        totalPages={totalPages}
        total={tabKpis.total}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />

      <AlmacenReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        startDate={startDate}
        endDate={endDate}
      />
      <AlmacenEmailReportModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPage: (p: number) => void
}) {
  if (totalPages <= 1) return null
  const start = page * pageSize + 1
  const end = Math.min((page + 1) * pageSize, total)
  return (
    <div className="flex items-center justify-between gap-4 px-1 py-2 text-sm text-muted-foreground">
      <span>
        Mostrando {start}–{end} de {total} productos
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
        >
          ← Anterior
        </Button>
        <span className="px-3 text-sm font-medium text-foreground">
          {page + 1} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages - 1}
        >
          Siguiente →
        </Button>
      </div>
    </div>
  )
}
