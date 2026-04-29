import { useCallback, useState } from "react"
import { BarChart2 } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import {
  getAccountsReceivable,
  getAccountsPayable,
  getCashFlowProjection,
  getExpensesByCategory,
  getCfdiSummaryByPeriod,
  getPaymentsUnapplied,
} from "@/services/analyticsService"
import type {
  AccountsPayableRow,
  AccountsReceivableRow,
  CashFlowRow,
  CfdiSummaryByPeriodRow,
  ExpensesByCategoryRow,
  PaymentUnappliedRow,
} from "@/types/analytics"
import { cn } from "@/lib/utils"

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("es-MX") : "—")
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

// ── Columnas ─────────────────────────────────────────────────────────────────

const AR_COLS: DataTableColumn<AccountsReceivableRow>[] = [
  { key: "code",           header: "Código",    cell: (r) => r.code },
  { key: "business_name",  header: "Cliente",   cell: (r) => r.business_name },
  { key: "billed",         header: "Facturado", cell: (r) => (r.billed != null ? fmt.format(r.billed) : "—") },
  { key: "collected",      header: "Cobrado",   cell: (r) => fmt.format(r.collected) },
  {
    key: "outstanding",
    header: "Saldo",
    cell: (r) =>
      r.outstanding != null ? (
        <span className="font-semibold text-amber-400">{fmt.format(r.outstanding)}</span>
      ) : "—",
  },
  { key: "bucket_0_30",   header: "0-30d",    cell: (r) => (r.bucket_0_30 > 0 ? fmt.format(r.bucket_0_30) : "—") },
  { key: "bucket_31_60",  header: "31-60d",   cell: (r) => (r.bucket_31_60 > 0 ? fmt.format(r.bucket_31_60) : "—") },
  {
    key: "bucket_61_90",
    header: "61-90d",
    cell: (r) =>
      r.bucket_61_90 > 0 ? (
        <span className="text-amber-400">{fmt.format(r.bucket_61_90)}</span>
      ) : "—",
  },
  {
    key: "bucket_90_plus",
    header: ">90d",
    cell: (r) =>
      r.bucket_90_plus > 0 ? (
        <span className="text-red-400">{fmt.format(r.bucket_90_plus)}</span>
      ) : "—",
  },
]

const AP_COLS: DataTableColumn<AccountsPayableRow>[] = [
  { key: "code",                   header: "Código",         cell: (r) => r.code },
  { key: "business_name",          header: "Proveedor",      cell: (r) => r.business_name },
  {
    key: "outstanding",
    header: "Saldo",
    cell: (r) =>
      r.outstanding != null ? (
        <span className="font-semibold">{fmt.format(r.outstanding)}</span>
      ) : "—",
  },
  { key: "bucket_current",         header: "Vigente",         cell: (r) => (r.bucket_current != null ? fmt.format(r.bucket_current) : "—") },
  {
    key: "bucket_overdue_30",
    header: "0-30d vencido",
    cell: (r) =>
      r.bucket_overdue_30 != null && r.bucket_overdue_30 > 0 ? (
        <span className="text-amber-400">{fmt.format(r.bucket_overdue_30)}</span>
      ) : "—",
  },
  {
    key: "bucket_overdue_60",
    header: "30-60d",
    cell: (r) =>
      r.bucket_overdue_60 != null && r.bucket_overdue_60 > 0 ? (
        <span className="text-orange-400">{fmt.format(r.bucket_overdue_60)}</span>
      ) : "—",
  },
  {
    key: "bucket_overdue_60_plus",
    header: ">60d",
    cell: (r) =>
      r.bucket_overdue_60_plus != null && r.bucket_overdue_60_plus > 0 ? (
        <span className="text-red-400">{fmt.format(r.bucket_overdue_60_plus)}</span>
      ) : "—",
  },
]

const FLUJO_COLS: DataTableColumn<CashFlowRow>[] = [
  { key: "period",  header: "Período",  cell: (r) => r.period },
  {
    key: "inflow",
    header: "Entradas",
    cell: (r) => <span className="text-emerald-400">{fmt.format(r.inflow)}</span>,
  },
  {
    key: "outflow",
    header: "Salidas",
    cell: (r) => <span className="text-red-400">{fmt.format(r.outflow)}</span>,
  },
  {
    key: "net",
    header: "Neto",
    cell: (r) => (
      <span className={cn("font-semibold", r.net >= 0 ? "text-emerald-400" : "text-red-400")}>
        {fmt.format(r.net)}
      </span>
    ),
  },
]

const GASTOS_COLS: DataTableColumn<ExpensesByCategoryRow>[] = [
  { key: "year",          header: "Año",          cell: (r) => r.year },
  { key: "month",         header: "Mes",          cell: (r) => MONTHS[r.month - 1] ?? r.month },
  { key: "category",      header: "Categoría",    cell: (r) => r.category ?? "—" },
  { key: "num_expenses",  header: "# Gastos",     cell: (r) => r.num_expenses },
  { key: "subtotal",      header: "Subtotal",     cell: (r) => (r.subtotal != null ? fmt.format(r.subtotal) : "—") },
  { key: "tax",           header: "IVA",          cell: (r) => (r.tax != null ? fmt.format(r.tax) : "—") },
  { key: "total",         header: "Total",        cell: (r) => (r.total != null ? fmt.format(r.total) : "—") },
  { key: "deductible",    header: "Deducible",    cell: (r) => (r.deductible != null ? fmt.format(r.deductible) : "—") },
  { key: "non_deductible", header: "No deducible", cell: (r) => (r.non_deductible != null ? fmt.format(r.non_deductible) : "—") },
]

const CFDI_PERIODO_COLS: DataTableColumn<CfdiSummaryByPeriodRow>[] = [
  { key: "year",      header: "Año",      cell: (r) => r.year },
  { key: "month",     header: "Mes",      cell: (r) => MONTHS[r.month - 1] ?? r.month },
  { key: "cfdi_type", header: "Tipo",     cell: (r) => r.cfdi_type },
  { key: "status",    header: "Estatus",  cell: (r) => r.status },
  { key: "num_cfdis", header: "# CFDIs",  cell: (r) => r.num_cfdis },
  { key: "subtotal",  header: "Subtotal", cell: (r) => (r.subtotal != null ? fmt.format(r.subtotal) : "—") },
  { key: "tax",       header: "IVA",      cell: (r) => (r.tax != null ? fmt.format(r.tax) : "—") },
  { key: "total",     header: "Total",    cell: (r) => (r.total != null ? fmt.format(r.total) : "—") },
]

const SIN_APLICAR_COLS: DataTableColumn<PaymentUnappliedRow>[] = [
  { key: "payment_number",   header: "# Pago",      cell: (r) => r.payment_number ?? "—" },
  { key: "payment_date",     header: "Fecha",       cell: (r) => fmtDate(r.payment_date) },
  { key: "customer",         header: "Cliente",     cell: (r) => r.customer ?? "—" },
  { key: "amount",           header: "Monto",       cell: (r) => fmt.format(r.amount) },
  { key: "amount_applied",   header: "Aplicado",    cell: (r) => fmt.format(r.amount_applied) },
  {
    key: "amount_unapplied",
    header: "Sin aplicar",
    cell: (r) => (
      <span className="font-semibold text-amber-400">{fmt.format(r.amount_unapplied)}</span>
    ),
  },
  { key: "bank_reference",   header: "Referencia",  cell: (r) => r.bank_reference ?? "—" },
]

// ── Sub-tabs ─────────────────────────────────────────────────────────────────

function ArTab() {
  const fetcher = useCallback((signal: AbortSignal) => getAccountsReceivable(signal), [])
  const { data, status } = useApi(fetcher)

  const totalOutstanding = (data ?? []).reduce((s, r) => s + (r.outstanding ?? 0), 0)
  const totalOverdue60 = (data ?? []).reduce(
    (s, r) => s + r.bucket_61_90 + r.bucket_90_plus,
    0,
  )

  return (
    <div className="flex flex-col gap-4">
      {data && data.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">Saldo por cobrar</p>
            <p className="mt-1 text-lg font-semibold text-white">{fmt.format(totalOutstanding)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">Vencido &gt;60 días</p>
            <p className="mt-1 text-lg font-semibold text-red-400">{fmt.format(totalOverdue60)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">Clientes con saldo</p>
            <p className="mt-1 text-lg font-semibold text-white">{data.length}</p>
          </div>
        </div>
      )}
      <DataTable
        columns={AR_COLS}
        rows={data ?? []}
        rowKey={(r) => String(r.customer_id)}
        emptyLabel={
          status === "loading" ? "Cargando…"
          : status === "error" ? "Error al cargar datos"
          : "Sin saldos por cobrar"
        }
      />
    </div>
  )
}

function ApTab() {
  const fetcher = useCallback((signal: AbortSignal) => getAccountsPayable(signal), [])
  const { data, status } = useApi(fetcher)

  const totalOutstanding = (data ?? []).reduce((s, r) => s + (r.outstanding ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      {data && data.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 w-fit">
          <p className="text-xs text-white/50">Total por pagar</p>
          <p className="mt-1 text-lg font-semibold text-white">{fmt.format(totalOutstanding)}</p>
        </div>
      )}
      <DataTable
        columns={AP_COLS}
        rows={data ?? []}
        rowKey={(r) => String(r.supplier_id)}
        emptyLabel={
          status === "loading" ? "Cargando…"
          : status === "error" ? "Error al cargar datos"
          : "Sin saldos por pagar"
        }
      />
    </div>
  )
}

function FlujoCajaTab() {
  const fetcher = useCallback((signal: AbortSignal) => getCashFlowProjection(signal), [])
  const { data, status } = useApi(fetcher)

  const netTotal = (data ?? []).reduce((s, r) => s + r.net, 0)

  return (
    <div className="flex flex-col gap-4">
      {data && data.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 w-fit">
          <p className="text-xs text-white/50">Flujo neto proyectado</p>
          <p
            className={cn(
              "mt-1 text-lg font-semibold",
              netTotal >= 0 ? "text-emerald-400" : "text-red-400",
            )}
          >
            {fmt.format(netTotal)}
          </p>
        </div>
      )}
      <DataTable
        columns={FLUJO_COLS}
        rows={data ?? []}
        rowKey={(r) => r.period}
        emptyLabel={
          status === "loading" ? "Cargando…"
          : status === "error" ? "Error al cargar datos"
          : "Sin datos de flujo de caja"
        }
      />
    </div>
  )
}

function GastosTab({ year }: { year: number | undefined }) {
  const fetcher = useCallback(
    (signal: AbortSignal) => getExpensesByCategory({ year }, signal),
    [year],
  )
  const { data, status } = useApi(fetcher)

  const totalGastos = (data ?? []).reduce((s, r) => s + (r.total ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      {data && data.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 w-fit">
          <p className="text-xs text-white/50">Total gastos</p>
          <p className="mt-1 text-lg font-semibold text-white">{fmt.format(totalGastos)}</p>
        </div>
      )}
      <DataTable
        columns={GASTOS_COLS}
        rows={data ?? []}
        rowKey={(r) => `${r.year}-${r.month}-${r.category ?? "null"}`}
        emptyLabel={
          status === "loading" ? "Cargando…"
          : status === "error" ? "Error al cargar datos"
          : "Sin gastos registrados"
        }
      />
    </div>
  )
}

function CfdiPeriodoTab({ year }: { year: number | undefined }) {
  const fetcher = useCallback(
    (signal: AbortSignal) => getCfdiSummaryByPeriod({ year }, signal),
    [year],
  )
  const { data, status } = useApi(fetcher)

  return (
    <DataTable
      columns={CFDI_PERIODO_COLS}
      rows={data ?? []}
      rowKey={(r) => `${r.year}-${r.month}-${r.cfdi_type}-${r.status}`}
      emptyLabel={
        status === "loading" ? "Cargando…"
        : status === "error" ? "Error al cargar datos"
        : "Sin datos de facturación"
      }
    />
  )
}

function SinAplicarTab() {
  const fetcher = useCallback((signal: AbortSignal) => getPaymentsUnapplied(signal), [])
  const { data, status } = useApi(fetcher)

  const totalSinAplicar = (data ?? []).reduce((s, r) => s + r.amount_unapplied, 0)

  return (
    <div className="flex flex-col gap-4">
      {data && data.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 w-fit">
          <p className="text-xs text-white/50">Total sin aplicar</p>
          <p className="mt-1 text-lg font-semibold text-amber-400">{fmt.format(totalSinAplicar)}</p>
        </div>
      )}
      <DataTable
        columns={SIN_APLICAR_COLS}
        rows={data ?? []}
        rowKey={(r) => String(r.payment_id)}
        emptyLabel={
          status === "loading" ? "Cargando…"
          : status === "error" ? "Error al cargar datos"
          : "Sin pagos pendientes de aplicar"
        }
      />
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

type FinancieroTab = "ar" | "ap" | "flujo" | "gastos" | "cfdi-periodo" | "sin-aplicar"

const TABS: { id: FinancieroTab; label: string }[] = [
  { id: "ar",           label: "Cuentas x Cobrar" },
  { id: "ap",           label: "Cuentas x Pagar" },
  { id: "flujo",        label: "Flujo de Caja" },
  { id: "gastos",       label: "Gastos" },
  { id: "cfdi-periodo", label: "CFDI por Período" },
  { id: "sin-aplicar",  label: "Pagos Sin Aplicar" },
]

const YEARS = [2024, 2025, 2026]

export function FinancieroPage() {
  const [tab, setTab] = useState<FinancieroTab>("ar")
  const [year, setYear] = useState<number | undefined>(undefined)

  const showYear = tab === "gastos" || tab === "cfdi-periodo"

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <BarChart2 className="h-6 w-6 text-[hsl(var(--primary))]" />
        <h1 className="text-xl font-semibold text-white">Reportes Financieros</h1>
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

      <div className="flex flex-wrap gap-1 border-b border-white/10">
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

      {tab === "ar"           && <ArTab />}
      {tab === "ap"           && <ApTab />}
      {tab === "flujo"        && <FlujoCajaTab />}
      {tab === "gastos"       && <GastosTab year={year} />}
      {tab === "cfdi-periodo" && <CfdiPeriodoTab year={year} />}
      {tab === "sin-aplicar"  && <SinAplicarTab />}
    </div>
  )
}
