import { useCallback, useState } from "react"
import { TrendingUp } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import {
  getProductMargin,
  getCategoryMargin,
  getCustomerProfitability,
} from "@/services/analyticsService"
import type {
  ProductMarginRow,
  CategoryMarginRow,
  CustomerProfitabilityRow,
} from "@/types/analytics"
import { cn } from "@/lib/utils"

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })
const fmtPct = (v: number | null) => (v != null ? `${v.toFixed(1)}%` : "—")

// ── Columnas ─────────────────────────────────────────────────────────────────

const PRODUCTO_COLS: DataTableColumn<ProductMarginRow>[] = [
  { key: "sku",                    header: "SKU",           cell: (r) => r.sku },
  { key: "name",                   header: "Producto",      cell: (r) => r.name },
  { key: "category",               header: "Categoría",     cell: (r) => r.category ?? "—" },
  { key: "times_sold",             header: "Veces",         cell: (r) => r.times_sold },
  { key: "units_sold",             header: "Unidades",      cell: (r) => r.units_sold ?? "—" },
  { key: "revenue",                header: "Revenue",       cell: (r) => (r.revenue != null ? fmt.format(r.revenue) : "—") },
  { key: "gross_margin",           header: "Margen",        cell: (r) => (r.gross_margin != null ? fmt.format(r.gross_margin) : "—") },
  { key: "actual_margin_pct",      header: "% Real",        cell: (r) => fmtPct(r.actual_margin_pct) },
  { key: "category_target_margin", header: "% Target",      cell: (r) => fmtPct(r.category_target_margin) },
  { key: "current_avg_cost",       header: "Costo prom.",   cell: (r) => (r.current_avg_cost != null ? fmt.format(r.current_avg_cost) : "—") },
]

const CATEGORIA_COLS: DataTableColumn<CategoryMarginRow>[] = [
  { key: "category",          header: "Categoría",   cell: (r) => r.category },
  { key: "target_margin",     header: "% Target",    cell: (r) => fmtPct(r.target_margin) },
  { key: "items_sold",        header: "Artículos",   cell: (r) => r.items_sold ?? "—" },
  { key: "revenue",           header: "Revenue",     cell: (r) => (r.revenue != null ? fmt.format(r.revenue) : "—") },
  { key: "cost",              header: "Costo",       cell: (r) => (r.cost != null ? fmt.format(r.cost) : "—") },
  { key: "margin",            header: "Margen",      cell: (r) => (r.margin != null ? fmt.format(r.margin) : "—") },
  { key: "actual_margin_pct", header: "% Real",      cell: (r) => fmtPct(r.actual_margin_pct) },
]

const CLIENTE_COLS: DataTableColumn<CustomerProfitabilityRow>[] = [
  { key: "code",               header: "Código",      cell: (r) => r.code },
  { key: "business_name",      header: "Cliente",     cell: (r) => r.business_name },
  { key: "num_orders",         header: "Pedidos",     cell: (r) => r.num_orders },
  { key: "revenue",            header: "Revenue",     cell: (r) => (r.revenue != null ? fmt.format(r.revenue) : "—") },
  { key: "gross_margin",       header: "Margen",      cell: (r) => (r.gross_margin != null ? fmt.format(r.gross_margin) : "—") },
  { key: "margin_pct",         header: "% Margen",    cell: (r) => fmtPct(r.margin_pct) },
  { key: "amount_collected",   header: "Cobrado",     cell: (r) => fmt.format(r.amount_collected) },
  { key: "amount_outstanding", header: "Saldo",       cell: (r) => (r.amount_outstanding != null ? fmt.format(r.amount_outstanding) : "—") },
  { key: "avg_days_to_pay",    header: "Días pago",   cell: (r) => (r.avg_days_to_pay != null ? `${r.avg_days_to_pay.toFixed(0)}d` : "—") },
]

// ── Sub-tabs ─────────────────────────────────────────────────────────────────

function ProductosTab() {
  const fetcher = useCallback((signal: AbortSignal) => getProductMargin(signal), [])
  const { data, status } = useApi(fetcher)

  return (
    <DataTable
      columns={PRODUCTO_COLS}
      rows={data ?? []}
      rowKey={(r) => r.product_id}
      emptyLabel={
        status === "loading" ? "Cargando…"
        : status === "error" ? "Error al cargar datos"
        : "Sin datos de productos"
      }
    />
  )
}

function CategoriasTab() {
  const fetcher = useCallback((signal: AbortSignal) => getCategoryMargin(signal), [])
  const { data, status } = useApi(fetcher)

  return (
    <DataTable
      columns={CATEGORIA_COLS}
      rows={data ?? []}
      rowKey={(r) => r.category_id}
      emptyLabel={
        status === "loading" ? "Cargando…"
        : status === "error" ? "Error al cargar datos"
        : "Sin datos de categorías"
      }
    />
  )
}

function ClientesRentabilidadTab() {
  const fetcher = useCallback(
    (signal: AbortSignal) => getCustomerProfitability({ limit: 50 }, signal),
    [],
  )
  const { data, status } = useApi(fetcher)

  return (
    <DataTable
      columns={CLIENTE_COLS}
      rows={data ?? []}
      rowKey={(r) => String(r.customer_id)}
      emptyLabel={
        status === "loading" ? "Cargando…"
        : status === "error" ? "Error al cargar datos"
        : "Sin datos de clientes"
      }
    />
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

type MargenTab = "productos" | "categorias" | "clientes"

const TABS: { id: MargenTab; label: string }[] = [
  { id: "productos",  label: "Por Producto" },
  { id: "categorias", label: "Por Categoría" },
  { id: "clientes",   label: "Rentabilidad Clientes" },
]

export function MargenPage() {
  const [tab, setTab] = useState<MargenTab>("productos")

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-[hsl(var(--primary))]" />
        <h1 className="text-xl font-semibold text-white">Margen y Rentabilidad</h1>
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

      {tab === "productos"  && <ProductosTab />}
      {tab === "categorias" && <CategoriasTab />}
      {tab === "clientes"   && <ClientesRentabilidadTab />}
    </div>
  )
}
