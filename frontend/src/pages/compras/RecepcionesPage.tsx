import { useCallback } from "react"
import { Package } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import { getGoodsReceipts } from "@/services/comprasService"
import type { GoodsReceiptListItem } from "@/types/compras"
import { cn } from "@/lib/utils"

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("es-MX") : "—"
const fmtPct = (n: number | null) => n != null ? `${(n * 100).toFixed(1)}%` : "—"

const COLUMNS: DataTableColumn<GoodsReceiptListItem>[] = [
  { key: "receipt_number",    header: "# Recepción", cell: (r) => r.receipt_number },
  { key: "po_id",             header: "OC",           cell: (r) => `PO #${r.po_id}` },
  { key: "receipt_date",      header: "Fecha",        cell: (r) => fmtDate(r.receipt_date) },
  {
    key: "physical_validation",
    header: "Val. física",
    cell: (r) => (
      <span className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        r.physical_validation
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-slate-500/30 bg-slate-500/10 text-slate-400"
      )}>
        {r.physical_validation ? "Validada" : "Pendiente"}
      </span>
    ),
  },
  { key: "delivery_pct", header: "% Entrega",  cell: (r) => fmtPct(r.delivery_pct) },
  { key: "created_at",   header: "Registrada", cell: (r) => fmtDate(r.created_at) },
]

export default function RecepcionesPage() {
  const fetcher = useCallback(
    (signal: AbortSignal) => getGoodsReceipts({}, signal),
    [],
  )
  const { data, status } = useApi(fetcher)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Package className="h-6 w-6 text-[hsl(var(--primary))]" />
        <h1 className="text-xl font-semibold text-white">Recepciones de Mercancía</h1>
      </div>

      <DataTable
        columns={COLUMNS}
        rows={data ?? []}
        rowKey={(r) => String(r.receipt_id)}
        emptyLabel={
          status === "loading" ? "Cargando…"
          : status === "error" ? "Error al cargar recepciones"
          : "Sin recepciones registradas"
        }
      />
    </div>
  )
}
