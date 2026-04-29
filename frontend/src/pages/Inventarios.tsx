import { useCallback, useState } from "react"
import {
  AlertTriangle,
  BoxesIcon,
  Download,
  FileText,
  Laptop,
  Mail,
  Package,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"

import { AlmacenEmailReportModal } from "@/components/common/AlmacenEmailReportModal"
import { AlmacenReportModal } from "@/components/common/AlmacenReportModal"
import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { DateRangePicker } from "@/components/common/DateRangePicker"
import { KpiCard } from "@/components/common/KpiCard"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/useApi"
import { useFilters } from "@/hooks/useFilters"
import { inventarioService } from "@/services/inventarioService"
import { assetsService } from "@/services/assetsService"
import { useAuthStore } from "@/stores/authStore"
import { cn, formatCurrencyMXN, formatNumber } from "@/lib/utils"
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

type Tab = "vendible" | "interno"

export function AlmacenPage() {
  const token = useAuthStore((s) => s.accessToken)
  const { datePreset, startDate, endDate, setDatePreset, setDateRange, reset } = useFilters()
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>("vendible")
  const [filterStatus, setFilterStatus] = useState("")

  // KPIs v2
  const kpisFetcher = useCallback((signal: AbortSignal) => assetsService.getKpisV2(signal), [])
  const { data: kpis, status: kpisStatus } = useApi(kpisFetcher)

  // Product list (switches by tab)
  const vendibleFetcher = useCallback(
    (signal: AbortSignal) =>
      assetsService.getVendible({ stock_status: filterStatus || undefined, limit: 500 }, signal),
    [filterStatus],
  )
  const internfetcher = useCallback(
    (signal: AbortSignal) =>
      assetsService.getInterno({ stock_status: filterStatus || undefined, limit: 500 }, signal),
    [filterStatus],
  )

  const { data: vendible, status: vendibleStatus } = useApi(vendibleFetcher, {
    enabled: activeTab === "vendible",
  })
  const { data: interno, status: internoStatus } = useApi(internfetcher, {
    enabled: activeTab === "interno",
  })

  const rows = activeTab === "vendible" ? (vendible ?? []) : (interno ?? [])
  const tableStatus = activeTab === "vendible" ? vendibleStatus : internoStatus

  const loadingKpis = kpisStatus === "loading"

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="surface-card border-white/70 bg-white p-5 md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge variant="success">En vivo</StatusBadge>
              <StatusBadge variant="info">Reportería conectada</StatusBadge>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-[30px]">
              Control de Inventarios y Almacén
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Stock en tiempo real desde movimientos de inventario. Valor calculado por costo promedio ponderado.
            </p>
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

      {/* Date picker for reports */}
      <DateRangePicker
        preset={datePreset}
        startDate={startDate}
        endDate={endDate}
        onPresetChange={setDatePreset}
        onRangeChange={setDateRange}
        onReset={reset}
      />

      {/* KPI cards (v2) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Valor Total Real"
          value={loadingKpis ? "—" : formatCurrencyMXN(kpis?.valor_total_real ?? 0)}
          description="Costo promedio ponderado × stock actual"
          icon={TrendingUp}
          tone="green"
        />
        <KpiCard
          title="Valor Vendible"
          value={loadingKpis ? "—" : formatCurrencyMXN(kpis?.valor_total_vendible ?? 0)}
          description="Productos para venta (is_saleable = true)"
          icon={Package}
          tone="blue"
        />
        <KpiCard
          title="Valor Interno"
          value={loadingKpis ? "—" : formatCurrencyMXN(kpis?.valor_total_interno ?? 0)}
          description="Materiales y consumibles internos"
          icon={BoxesIcon}
          tone="purple"
        />
        <KpiCard
          title="Equipos Registrados"
          value={loadingKpis ? "—" : formatNumber(kpis?.total_assets ?? 0)}
          description="Activos físicos gestionados"
          icon={Laptop}
          tone="neutral"
          badge={
            kpis && kpis.assets_en_reparacion > 0
              ? { label: `${kpis.assets_en_reparacion} en reparación`, variant: "warning" }
              : undefined
          }
        />
        <KpiCard
          title="Sin Stock"
          value={loadingKpis ? "—" : formatNumber(kpis?.productos_out_of_stock ?? 0)}
          description="SKUs con stock = 0"
          icon={AlertTriangle}
          tone="red"
          badge={
            kpis && kpis.productos_out_of_stock > 0
              ? { label: "Reponer", variant: "warning" }
              : undefined
          }
        />
        <KpiCard
          title="Bajo Mínimo"
          value={loadingKpis ? "—" : formatNumber(kpis?.productos_below_min ?? 0)}
          description="SKUs por debajo del stock mínimo"
          icon={AlertTriangle}
          tone="orange"
        />
        <KpiCard
          title="Total SKUs"
          value={loadingKpis ? "—" : formatNumber(kpis?.total_productos ?? 0)}
          description="Productos con al menos un movimiento"
          icon={Package}
          tone="neutral"
        />
      </div>

      {/* Inventory tabs */}
      <div className="rounded-xl border border-white/10 bg-white/5">
        {/* Tab header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-3">
          <div className="flex gap-1">
            {(["vendible", "interno"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === tab
                    ? "bg-[hsl(var(--primary))] text-white"
                    : "text-white/50 hover:text-white",
                )}
              >
                {tab === "vendible" ? "Inventario Vendible" : "Inventario Interno"}
              </button>
            ))}
          </div>

          <select
            className="rounded-md border border-white/10 bg-background px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="OK">OK</option>
            <option value="BELOW_MIN">Bajo mínimo</option>
            <option value="OUT">Sin stock</option>
          </select>
        </div>

        {/* Table */}
        <div className="p-1">
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
      </div>

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
