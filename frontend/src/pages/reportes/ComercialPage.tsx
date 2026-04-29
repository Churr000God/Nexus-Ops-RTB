import { useCallback, useState } from "react"
import { BarChart3 } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import {
  getSalesByPeriod,
  getTopCustomers,
  getQuoteConversion,
  getSalesRepPerformance,
} from "@/services/analyticsService"
import type {
  SalesByPeriodRow,
  TopCustomerRow,
  QuoteConversionRow,
  SalesRepRow,
} from "@/types/analytics"
import { cn } from "@/lib/utils"

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("es-MX") : "—")
const fmtPct = (v: number | null) => (v != null ? `${v.toFixed(1)}%` : "—")
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

// ── Columnas ─────────────────────────────────────────────────────────────────

const VENTAS_COLS: DataTableColumn<SalesByPeriodRow>[] = [
  { key: "year",         header: "Año",          cell: (r) => r.year },
  { key: "month",        header: "Mes",          cell: (r) => MONTHS[r.month - 1] ?? r.month },
  { key: "num_orders",   header: "Pedidos",      cell: (r) => r.num_orders },
  { key: "total",        header: "Ventas",       cell: (r) => (r.total != null ? fmt.format(r.total) : "—") },
  { key: "cost",         header: "Costo",        cell: (r) => (r.cost != null ? fmt.format(r.cost) : "—") },
  { key: "gross_margin", header: "Margen bruto", cell: (r) => (r.gross_margin != null ? fmt.format(r.gross_margin) : "—") },
  { key: "margin_pct",   header: "% Margen",     cell: (r) => fmtPct(r.margin_pct) },
]

const CLIENTES_COLS: DataTableColumn<TopCustomerRow>[] = [
  { key: "code",                  header: "Código",        cell: (r) => r.code },
  { key: "business_name",         header: "Cliente",       cell: (r) => r.business_name },
  { key: "locality",              header: "Ciudad",        cell: (r) => r.locality ?? "—" },
  { key: "num_orders",            header: "Pedidos",       cell: (r) => r.num_orders },
  { key: "total_revenue",         header: "Revenue",       cell: (r) => (r.total_revenue != null ? fmt.format(r.total_revenue) : "—") },
  { key: "gross_margin",          header: "Margen",        cell: (r) => (r.gross_margin != null ? fmt.format(r.gross_margin) : "—") },
  { key: "margin_pct",            header: "% Margen",      cell: (r) => fmtPct(r.margin_pct) },
  { key: "avg_order_value",       header: "Ticket prom.",  cell: (r) => (r.avg_order_value != null ? fmt.format(r.avg_order_value) : "—") },
  { key: "last_order_date",       header: "Último pedido", cell: (r) => fmtDate(r.last_order_date) },
  { key: "days_since_last_order", header: "Días",          cell: (r) => r.days_since_last_order ?? "—" },
]

const CONVERSION_COLS: DataTableColumn<QuoteConversionRow>[] = [
  { key: "year",           header: "Año",          cell: (r) => r.year },
  { key: "month",          header: "Mes",          cell: (r) => MONTHS[r.month - 1] ?? r.month },
  { key: "total_quotes",   header: "Total cot.",   cell: (r) => r.total_quotes },
  { key: "approved",       header: "Aprobadas",    cell: (r) => r.approved },
  { key: "rejected",       header: "Rechazadas",   cell: (r) => r.rejected },
  { key: "expired",        header: "Vencidas",     cell: (r) => r.expired },
  { key: "still_open",     header: "Abiertas",     cell: (r) => r.still_open },
  { key: "conversion_pct", header: "% Conversión", cell: (r) => fmtPct(r.conversion_pct) },
  { key: "total_quoted",   header: "Cotizado",     cell: (r) => (r.total_quoted != null ? fmt.format(r.total_quoted) : "—") },
  { key: "total_won",      header: "Ganado",       cell: (r) => (r.total_won != null ? fmt.format(r.total_won) : "—") },
]

const VENDEDOR_COLS: DataTableColumn<SalesRepRow>[] = [
  { key: "sales_rep",         header: "Vendedor",      cell: (r) => r.sales_rep },
  { key: "quotes_created",    header: "Cotizaciones",  cell: (r) => r.quotes_created },
  { key: "quotes_approved",   header: "Aprobadas",     cell: (r) => r.quotes_approved },
  { key: "conversion_pct",    header: "% Conversión",  cell: (r) => fmtPct(r.conversion_pct) },
  { key: "revenue_generated", header: "Revenue",       cell: (r) => (r.revenue_generated != null ? fmt.format(r.revenue_generated) : "—") },
  { key: "margin_generated",  header: "Margen",        cell: (r) => (r.margin_generated != null ? fmt.format(r.margin_generated) : "—") },
  { key: "avg_order_value",   header: "Ticket prom.",  cell: (r) => (r.avg_order_value != null ? fmt.format(r.avg_order_value) : "—") },
]

// ── Sub-tabs ─────────────────────────────────────────────────────────────────

function VentasTab({ year }: { year: number | undefined }) {
  const fetcher = useCallback(
    (signal: AbortSignal) => getSalesByPeriod({ year }, signal),
    [year],
  )
  const { data, status } = useApi(fetcher)

  const totalVentas = (data ?? []).reduce((s, r) => s + (r.total ?? 0), 0)
  const totalMargen = (data ?? []).reduce((s, r) => s + (r.gross_margin ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      {data && data.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">Ventas totales</p>
            <p className="mt-1 text-lg font-semibold text-white">{fmt.format(totalVentas)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">Margen bruto</p>
            <p className="mt-1 text-lg font-semibold text-emerald-400">{fmt.format(totalMargen)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">% Margen</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {totalVentas > 0 ? `${((totalMargen / totalVentas) * 100).toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>
      )}
      <DataTable
        columns={VENTAS_COLS}
        rows={data ?? []}
        rowKey={(r) => `${r.year}-${r.month}`}
        emptyLabel={
          status === "loading" ? "Cargando…"
          : status === "error" ? "Error al cargar datos"
          : "Sin datos de ventas"
        }
      />
    </div>
  )
}

function ClientesTab() {
  const fetcher = useCallback(
    (signal: AbortSignal) => getTopCustomers({ limit: 50 }, signal),
    [],
  )
  const { data, status } = useApi(fetcher)

  return (
    <DataTable
      columns={CLIENTES_COLS}
      rows={data ?? []}
      rowKey={(r) => String(r.customer_id)}
      emptyLabel={
        status === "loading" ? "Cargando…"
        : status === "error" ? "Error al cargar datos"
        : "Sin clientes registrados"
      }
    />
  )
}

function ConversionTab({ year }: { year: number | undefined }) {
  const fetcher = useCallback(
    (signal: AbortSignal) => getQuoteConversion({ year }, signal),
    [year],
  )
  const { data, status } = useApi(fetcher)

  const totalCotizaciones = (data ?? []).reduce((s, r) => s + r.total_quotes, 0)
  const totalAprobadas = (data ?? []).reduce((s, r) => s + r.approved, 0)

  return (
    <div className="flex flex-col gap-4">
      {data && data.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">Total cotizaciones</p>
            <p className="mt-1 text-lg font-semibold text-white">{totalCotizaciones}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">Aprobadas</p>
            <p className="mt-1 text-lg font-semibold text-emerald-400">{totalAprobadas}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">% Conversión</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {totalCotizaciones > 0
                ? `${((totalAprobadas / totalCotizaciones) * 100).toFixed(1)}%`
                : "—"}
            </p>
          </div>
        </div>
      )}
      <DataTable
        columns={CONVERSION_COLS}
        rows={data ?? []}
        rowKey={(r) => `${r.year}-${r.month}`}
        emptyLabel={
          status === "loading" ? "Cargando…"
          : status === "error" ? "Error al cargar datos"
          : "Sin datos de cotizaciones"
        }
      />
    </div>
  )
}

function VendedoresTab() {
  const fetcher = useCallback((signal: AbortSignal) => getSalesRepPerformance(signal), [])
  const { data, status } = useApi(fetcher)

  return (
    <DataTable
      columns={VENDEDOR_COLS}
      rows={data ?? []}
      rowKey={(r) => r.user_id}
      emptyLabel={
        status === "loading" ? "Cargando…"
        : status === "error" ? "Error al cargar datos"
        : "Sin datos de vendedores"
      }
    />
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

type ComercialTab = "ventas" | "clientes" | "conversion" | "vendedores"

const TABS: { id: ComercialTab; label: string }[] = [
  { id: "ventas",      label: "Ventas por Período" },
  { id: "clientes",    label: "Top Clientes" },
  { id: "conversion",  label: "Conversión" },
  { id: "vendedores",  label: "Por Vendedor" },
]

const YEARS = [2024, 2025, 2026]

export function ComercialPage() {
  const [tab, setTab] = useState<ComercialTab>("ventas")
  const [year, setYear] = useState<number | undefined>(undefined)

  const showYear = tab === "ventas" || tab === "conversion"

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <BarChart3 className="h-6 w-6 text-[hsl(var(--primary))]" />
        <h1 className="text-xl font-semibold text-white">Reportes Comerciales</h1>
        {showYear && (
          <select
            className="ml-auto rounded-md border border-white/10 bg-background px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
            value={year ?? ""}
            onChange={(e) =>
              setYear(e.target.value ? Number(e.target.value) : undefined)
            }
          >
            <option value="">Todos los años</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
      </div>

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

      {tab === "ventas"     && <VentasTab year={year} />}
      {tab === "clientes"   && <ClientesTab />}
      {tab === "conversion" && <ConversionTab year={year} />}
      {tab === "vendedores" && <VendedoresTab />}
    </div>
  )
}
