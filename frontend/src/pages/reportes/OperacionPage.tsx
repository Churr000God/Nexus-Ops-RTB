import { useCallback, useState } from "react"
import { AlertTriangle, Package, Truck } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { KpiCard } from "@/components/common/KpiCard"
import { useApi } from "@/hooks/useApi"
import {
  getWarehouseKpis,
  getNcBySupplier,
  getRouteEfficiency,
} from "@/services/analyticsService"
import type {
  WarehouseKpis,
  NcBySupplierRow,
  RouteEfficiencyRow,
} from "@/types/analytics"
import { cn } from "@/lib/utils"

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("es-MX") : "—")

// ── Columnas ─────────────────────────────────────────────────────────────────

const NC_COLS: DataTableColumn<NcBySupplierRow>[] = [
  { key: "supplier_code",           header: "Código",          cell: (r) => r.supplier_code ?? "—" },
  { key: "business_name",           header: "Proveedor",       cell: (r) => r.business_name ?? "—" },
  { key: "total_ncs",               header: "Total NCs",       cell: (r) => r.total_ncs },
  { key: "ncs_last_90d",            header: "Últ. 90 días",    cell: (r) => r.ncs_last_90d },
  {
    key: "open_ncs",
    header: "Abiertas",
    cell: (r) => (
      <span className={cn(r.open_ncs > 0 ? "font-semibold text-amber-400" : "text-white/50")}>
        {r.open_ncs}
      </span>
    ),
  },
  { key: "total_quantity_affected", header: "Unidades afect.", cell: (r) => r.total_quantity_affected ?? "—" },
]

const RUTA_COLS: DataTableColumn<RouteEfficiencyRow>[] = [
  { key: "route_number",       header: "Ruta",          cell: (r) => r.route_number ?? "—" },
  { key: "route_date",         header: "Fecha",         cell: (r) => fmtDate(r.route_date) },
  { key: "driver",             header: "Conductor",     cell: (r) => r.driver ?? "—" },
  { key: "total_stops",        header: "Paradas",       cell: (r) => r.total_stops },
  { key: "completed_stops",    header: "Completadas",   cell: (r) => r.completed_stops },
  {
    key: "failed_stops",
    header: "Fallidas",
    cell: (r) =>
      r.failed_stops > 0 ? (
        <span className="font-semibold text-red-400">{r.failed_stops}</span>
      ) : (
        r.failed_stops
      ),
  },
  {
    key: "completion_pct",
    header: "% Completado",
    cell: (r) => `${r.completion_pct.toFixed(0)}%`,
  },
  {
    key: "duration_hours",
    header: "Duración",
    cell: (r) => (r.duration_hours != null ? `${r.duration_hours.toFixed(1)}h` : "—"),
  },
  {
    key: "total_distance_km",
    header: "Km",
    cell: (r) => (r.total_distance_km != null ? `${r.total_distance_km.toFixed(0)} km` : "—"),
  },
]

// ── Sub-tabs ─────────────────────────────────────────────────────────────────

function NcsTab() {
  const fetcher = useCallback((signal: AbortSignal) => getNcBySupplier(signal), [])
  const { data, status } = useApi(fetcher)

  return (
    <DataTable
      columns={NC_COLS}
      rows={data ?? []}
      rowKey={(r) => r.supplier_code ?? r.business_name ?? "unknown"}
      emptyLabel={
        status === "loading" ? "Cargando…"
        : status === "error" ? "Error al cargar datos"
        : "Sin no conformidades registradas"
      }
    />
  )
}

function RutasTab() {
  const fetcher = useCallback(
    (signal: AbortSignal) => getRouteEfficiency({ limit: 50 }, signal),
    [],
  )
  const { data, status } = useApi(fetcher)

  const completadas = (data ?? []).filter((r) => r.completion_pct >= 100).length
  const avgCompletionPct =
    data && data.length > 0
      ? data.reduce((s, r) => s + r.completion_pct, 0) / data.length
      : null

  return (
    <div className="flex flex-col gap-4">
      {data && data.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">Total rutas</p>
            <p className="mt-1 text-lg font-semibold text-white">{data.length}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">100% completadas</p>
            <p className="mt-1 text-lg font-semibold text-emerald-400">{completadas}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">% Completado prom.</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {avgCompletionPct != null ? `${avgCompletionPct.toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>
      )}
      <DataTable
        columns={RUTA_COLS}
        rows={data ?? []}
        rowKey={(r) => String(r.route_id)}
        emptyLabel={
          status === "loading" ? "Cargando…"
          : status === "error" ? "Error al cargar datos"
          : "Sin rutas registradas"
        }
      />
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

type OperacionTab = "ncs" | "rutas"

const TABS: { id: OperacionTab; label: string }[] = [
  { id: "ncs",   label: "No Conformidades" },
  { id: "rutas", label: "Eficiencia de Rutas" },
]

export function OperacionPage() {
  const [tab, setTab] = useState<OperacionTab>("ncs")

  const kpiFetcher = useCallback((signal: AbortSignal) => getWarehouseKpis(signal), [])
  const { data: kpis } = useApi<WarehouseKpis>(kpiFetcher)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Package className="h-6 w-6 text-[hsl(var(--primary))]" />
        <h1 className="text-xl font-semibold text-white">Reportes de Operación</h1>
      </div>

      {kpis && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            title="SKUs activos"
            value={String(kpis.active_skus_saleable)}
            tone="blue"
            icon={Package}
          />
          <KpiCard
            title="SKUs sin stock"
            value={String(kpis.skus_out_of_stock)}
            tone={kpis.skus_out_of_stock > 0 ? "red" : "neutral"}
          />
          <KpiCard
            title="SKUs bajo mínimo"
            value={String(kpis.skus_below_min)}
            tone={kpis.skus_below_min > 0 ? "orange" : "neutral"}
          />
          <KpiCard
            title="Valor inventario"
            value={kpis.total_inventory_value != null ? fmt.format(kpis.total_inventory_value) : "—"}
            tone="green"
          />
          <KpiCard
            title="Recepciones este mes"
            value={String(kpis.receipts_this_month)}
            tone="blue"
          />
          <KpiCard
            title="Salidas este mes"
            value={String(kpis.issues_this_month)}
            tone="neutral"
          />
          <KpiCard
            title="Pedidos activos"
            value={String(kpis.active_orders)}
            tone="purple"
            icon={Truck}
          />
          <KpiCard
            title="NCs abiertas"
            value={String(kpis.open_non_conformities)}
            tone={kpis.open_non_conformities > 0 ? "orange" : "neutral"}
            icon={AlertTriangle}
          />
        </div>
      )}

      <div className="flex gap-1 border-b border-white/10">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === id
                ? "border-[hsl(var(--primary))] text-white"
                : "border-transparent text-white/50 hover:text-white",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "ncs"   && <NcsTab />}
      {tab === "rutas" && <RutasTab />}
    </div>
  )
}
