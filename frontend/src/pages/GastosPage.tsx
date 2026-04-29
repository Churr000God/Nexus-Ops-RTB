import { useCallback, useState } from "react"
import { Receipt } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import { getOperatingExpenses } from "@/services/comprasService"
import type { OperatingExpense } from "@/types/compras"
import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<string, string> = {
  Pendiente:    "border-amber-500/30 bg-amber-500/10 text-amber-400",
  "En Proceso": "border-blue-500/30 bg-blue-500/10 text-blue-400",
  Realizado:    "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  Rechazado:    "border-red-900/30 bg-red-900/10 text-red-600",
  Cancelado:    "border-slate-700/30 bg-slate-700/10 text-slate-500",
}

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("es-MX") : "—"

const COLUMNS: DataTableColumn<OperatingExpense>[] = [
  { key: "concept",        header: "Concepto",     cell: (r) => r.concept },
  { key: "category",       header: "Categoría",    cell: (r) => r.category ?? "—" },
  { key: "expense_date",   header: "Fecha",        cell: (r) => fmtDate(r.expense_date) },
  { key: "subtotal",       header: "Subtotal",     cell: (r) => r.subtotal != null ? fmt.format(r.subtotal) : "—" },
  { key: "total",          header: "Total",        cell: (r) => r.total != null ? fmt.format(r.total) : "—" },
  {
    key: "is_deductible",
    header: "Deducible",
    cell: (r) => r.is_deductible ? (
      <span className="inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[11px] font-medium text-teal-400">
        Sí
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-[11px] font-medium text-slate-400">
        No
      </span>
    ),
  },
  { key: "payment_method", header: "Método pago",  cell: (r) => r.payment_method ?? r.sat_payment_form_id ?? "—" },
  {
    key: "status",
    header: "Estatus",
    cell: (r) => r.status ? (
      <span className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STATUS_COLORS[r.status] ?? "border-slate-500/30 bg-slate-500/10 text-slate-400"
      )}>
        {r.status}
      </span>
    ) : "—",
  },
  { key: "supplier_name",  header: "Proveedor",    cell: (r) => r.supplier_name ?? "—" },
]

const CATEGORIES = [
  "Servicios", "Viáticos", "Fijos", "Combustibles",
  "Mantenimiento", "Honorarios", "Otros",
]

export default function GastosPage() {
  const [filterCategory, setFilterCategory] = useState("")
  const [filterDeductible, setFilterDeductible] = useState<"" | "true" | "false">("")

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      getOperatingExpenses(
        {
          category: filterCategory || undefined,
          is_deductible: filterDeductible !== "" ? filterDeductible === "true" : undefined,
        },
        signal,
      ),
    [filterCategory, filterDeductible],
  )
  const { data, status } = useApi(fetcher)

  const total = (data ?? []).reduce((sum, r) => sum + (r.total ?? 0), 0)
  const deductible = (data ?? []).reduce(
    (sum, r) => sum + (r.is_deductible ? (r.total ?? 0) : 0),
    0,
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Receipt className="h-6 w-6 text-[hsl(var(--primary))]" />
        <h1 className="text-xl font-semibold text-white">Gastos Operativos RTB</h1>
      </div>

      {data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">Total del periodo</p>
            <p className="mt-1 text-lg font-semibold text-white">{fmt.format(total)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">Gastos deducibles</p>
            <p className="mt-1 text-lg font-semibold text-teal-400">{fmt.format(deductible)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">% Deducible</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {total > 0 ? `${((deductible / total) * 100).toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-md border border-white/10 bg-background px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          className="rounded-md border border-white/10 bg-background px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
          value={filterDeductible}
          onChange={(e) => setFilterDeductible(e.target.value as "" | "true" | "false")}
        >
          <option value="">Deducible / No deducible</option>
          <option value="true">Deducibles</option>
          <option value="false">No deducibles</option>
        </select>
      </div>

      <DataTable
        columns={COLUMNS}
        rows={data ?? []}
        rowKey={(r) => r.id}
        emptyLabel={
          status === "loading" ? "Cargando…"
          : status === "error" ? "Error al cargar gastos"
          : "Sin gastos registrados"
        }
      />
    </div>
  )
}
