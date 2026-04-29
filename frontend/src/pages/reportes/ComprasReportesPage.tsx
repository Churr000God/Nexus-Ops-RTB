import { useCallback, useState } from "react"
import { ShoppingBag } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import {
  getTopSuppliers,
  getSupplierPerformance,
  getSupplierInvoicesAging,
} from "@/services/analyticsService"
import type {
  AgingBucket,
  SupplierInvoicesAgingRow,
  SupplierPerformanceRow,
  TopSupplierRow,
} from "@/types/analytics"
import { cn } from "@/lib/utils"

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("es-MX") : "—")
const fmtPct = (v: number | null) => (v != null ? `${v.toFixed(1)}%` : "—")
const fmtDays = (v: number | null) => (v != null ? `${v.toFixed(0)}d` : "—")

const AGING_COLORS: Record<AgingBucket, string> = {
  PAID:            "border-teal-500/30 bg-teal-500/10 text-teal-400",
  CURRENT:         "border-blue-500/30 bg-blue-500/10 text-blue-400",
  OVERDUE_0_30:    "border-amber-500/30 bg-amber-500/10 text-amber-400",
  OVERDUE_30_60:   "border-orange-500/30 bg-orange-500/10 text-orange-400",
  OVERDUE_60_PLUS: "border-red-900/30 bg-red-900/10 text-red-500",
}

const AGING_LABELS: Record<AgingBucket, string> = {
  PAID:            "Pagada",
  CURRENT:         "Vigente",
  OVERDUE_0_30:    "0-30 días",
  OVERDUE_30_60:   "30-60 días",
  OVERDUE_60_PLUS: ">60 días",
}

// ── Columnas ─────────────────────────────────────────────────────────────────

const TOP_PROV_COLS: DataTableColumn<TopSupplierRow>[] = [
  { key: "code",                   header: "Código",           cell: (r) => r.code },
  { key: "business_name",          header: "Proveedor",        cell: (r) => r.business_name },
  { key: "supplier_type",          header: "Tipo",             cell: (r) => r.supplier_type ?? "—" },
  { key: "num_pos",                header: "# OCs",            cell: (r) => r.num_pos },
  { key: "total_purchased",        header: "Total comprado",   cell: (r) => (r.total_purchased != null ? fmt.format(r.total_purchased) : "—") },
  { key: "avg_po_value",           header: "OC prom.",         cell: (r) => (r.avg_po_value != null ? fmt.format(r.avg_po_value) : "—") },
  { key: "avg_payment_time_days",  header: "Días pago prom.",  cell: (r) => fmtDays(r.avg_payment_time_days) },
  { key: "last_po_date",           header: "Última OC",        cell: (r) => fmtDate(r.last_po_date) },
  { key: "days_since_last_po",     header: "Días sin OC",      cell: (r) => r.days_since_last_po ?? "—" },
]

const DESEMPENO_COLS: DataTableColumn<SupplierPerformanceRow>[] = [
  { key: "code",                    header: "Código",          cell: (r) => r.code },
  { key: "business_name",           header: "Proveedor",       cell: (r) => r.business_name },
  { key: "pos_completed",           header: "OCs complet.",    cell: (r) => r.pos_completed },
  { key: "avg_actual_lead_days",    header: "Lead real",       cell: (r) => fmtDays(r.avg_actual_lead_days) },
  { key: "avg_estimated_lead_days", header: "Lead estimado",   cell: (r) => fmtDays(r.avg_estimated_lead_days) },
  {
    key: "avg_delay_days",
    header: "Retraso prom.",
    cell: (r) => (
      <span className={cn(r.avg_delay_days != null && r.avg_delay_days > 0 ? "text-amber-400" : "")}>
        {fmtDays(r.avg_delay_days)}
      </span>
    ),
  },
  {
    key: "on_time_pct",
    header: "% A tiempo",
    cell: (r) => (
      <span
        className={cn(
          "font-semibold",
          r.on_time_pct >= 80
            ? "text-emerald-400"
            : r.on_time_pct >= 50
              ? "text-amber-400"
              : "text-red-400",
        )}
      >
        {fmtPct(r.on_time_pct)}
      </span>
    ),
  },
  {
    key: "total_ncs",
    header: "NCs",
    cell: (r) =>
      r.total_ncs > 0 ? (
        <span className="font-semibold text-amber-400">{r.total_ncs}</span>
      ) : (
        r.total_ncs
      ),
  },
]

const AGING_COLS: DataTableColumn<SupplierInvoicesAgingRow>[] = [
  { key: "invoice_number",   header: "Factura",      cell: (r) => r.invoice_number },
  { key: "supplier",         header: "Proveedor",    cell: (r) => r.supplier },
  { key: "invoice_date",     header: "Fecha",        cell: (r) => fmtDate(r.invoice_date) },
  { key: "payment_due_date", header: "Vencimiento",  cell: (r) => fmtDate(r.payment_due_date) },
  { key: "total",            header: "Total",        cell: (r) => (r.total != null ? fmt.format(r.total) : "—") },
  {
    key: "aging_bucket",
    header: "Antigüedad",
    cell: (r) => (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
          AGING_COLORS[r.aging_bucket],
        )}
      >
        {AGING_LABELS[r.aging_bucket]}
      </span>
    ),
  },
  {
    key: "days_overdue",
    header: "Días vencida",
    cell: (r) =>
      r.days_overdue != null && r.days_overdue > 0 ? (
        <span className="font-semibold text-red-400">{r.days_overdue}</span>
      ) : (
        "—"
      ),
  },
]

// ── Sub-tabs ─────────────────────────────────────────────────────────────────

function TopProveedoresTab() {
  const fetcher = useCallback(
    (signal: AbortSignal) => getTopSuppliers({ limit: 50 }, signal),
    [],
  )
  const { data, status } = useApi(fetcher)

  return (
    <DataTable
      columns={TOP_PROV_COLS}
      rows={data ?? []}
      rowKey={(r) => String(r.supplier_id)}
      emptyLabel={
        status === "loading" ? "Cargando…"
        : status === "error" ? "Error al cargar datos"
        : "Sin proveedores registrados"
      }
    />
  )
}

function DesempenoTab() {
  const fetcher = useCallback((signal: AbortSignal) => getSupplierPerformance(signal), [])
  const { data, status } = useApi(fetcher)

  return (
    <DataTable
      columns={DESEMPENO_COLS}
      rows={data ?? []}
      rowKey={(r) => String(r.supplier_id)}
      emptyLabel={
        status === "loading" ? "Cargando…"
        : status === "error" ? "Error al cargar datos"
        : "Sin datos de desempeño"
      }
    />
  )
}

function AgingTab() {
  const fetcher = useCallback(
    (signal: AbortSignal) => getSupplierInvoicesAging(signal),
    [],
  )
  const { data, status } = useApi(fetcher)

  const totalVencido = (data ?? [])
    .filter((r) => r.aging_bucket !== "PAID" && r.aging_bucket !== "CURRENT")
    .reduce((s, r) => s + (r.total ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      {data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">Facturas pendientes</p>
            <p className="mt-1 text-lg font-semibold text-white">{data.length}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">Monto vencido</p>
            <p className="mt-1 text-lg font-semibold text-red-400">{fmt.format(totalVencido)}</p>
          </div>
        </div>
      )}
      <DataTable
        columns={AGING_COLS}
        rows={data ?? []}
        rowKey={(r) => String(r.invoice_id)}
        emptyLabel={
          status === "loading" ? "Cargando…"
          : status === "error" ? "Error al cargar datos"
          : "Sin facturas pendientes"
        }
      />
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

type ComprasTab = "top" | "desempeno" | "aging"

const TABS: { id: ComprasTab; label: string }[] = [
  { id: "top",       label: "Top Proveedores" },
  { id: "desempeno", label: "Desempeño" },
  { id: "aging",     label: "Aging Facturas" },
]

export function ComprasReportesPage() {
  const [tab, setTab] = useState<ComprasTab>("top")

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <ShoppingBag className="h-6 w-6 text-[hsl(var(--primary))]" />
        <h1 className="text-xl font-semibold text-white">Reportes de Compras</h1>
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

      {tab === "top"       && <TopProveedoresTab />}
      {tab === "desempeno" && <DesempenoTab />}
      {tab === "aging"     && <AgingTab />}
    </div>
  )
}
