import { useCallback, useState } from "react"
import { CheckCircle2, FileText, XCircle } from "lucide-react"
import { toast } from "sonner"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/useApi"
import { usePermission } from "@/hooks/usePermission"
import { approveQuote, getQuotes, rejectQuote } from "@/services/ventasLogisticaService"
import type { Quote } from "@/types/ventasLogistica"
import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "border-slate-500/30 bg-slate-500/10 text-slate-400",
  SUBMITTED: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  APPROVED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  REJECTED: "border-red-500/30 bg-red-500/10 text-red-400",
  EXPIRED: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  CANCELLED: "border-red-900/30 bg-red-900/10 text-red-600",
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Enviada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  EXPIRED: "Vencida",
  CANCELLED: "Cancelada",
}

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })

export default function CotizacionesPage() {
  const canApprove = usePermission("quote.approve")
  const [filterStatus, setFilterStatus] = useState<string>("")
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const quotesApi = useApi(
    useCallback((_signal: AbortSignal) => getQuotes({ status: filterStatus || undefined, limit: 100 }), [filterStatus])
  )

  const quotes = (quotesApi.data ?? []) as Quote[]

  const handleApprove = async (id: number) => {
    setActionLoading(id)
    try {
      await approveQuote(id, {})
      toast.success("Cotización aprobada")
      quotesApi.refetch()
    } catch {
      toast.error("No se pudo aprobar la cotización")
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id: number) => {
    const reason = window.prompt("Motivo de rechazo:")
    if (!reason) return
    setActionLoading(id)
    try {
      await rejectQuote(id, { rejection_reason: reason })
      toast.success("Cotización rechazada")
      quotesApi.refetch()
    } catch {
      toast.error("No se pudo rechazar la cotización")
    } finally {
      setActionLoading(null)
    }
  }

  const columns: DataTableColumn<Quote>[] = [
    { key: "quote_number", header: "Cotización", className: "font-mono text-xs", cell: (r) => r.quote_number },
    { key: "customer_id", header: "Cliente ID", className: "text-xs", cell: (r) => String(r.customer_id) },
    { key: "issue_date", header: "Fecha", className: "text-xs", cell: (r) => String(r.issue_date) },
    { key: "expiry_date", header: "Vence", className: "text-xs", cell: (r) => r.expiry_date ?? "—" },
    {
      key: "total",
      header: "Total",
      cell: (r) => (
        <span className="font-mono text-xs font-semibold text-emerald-400">{fmt.format(r.total)}</span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (r) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
            STATUS_COLORS[r.status] ?? "border-slate-500/30 bg-slate-500/10 text-slate-400"
          )}
        >
          {STATUS_LABELS[r.status] ?? r.status}
        </span>
      ),
    },
    ...(canApprove
      ? [
          {
            key: "actions",
            header: "",
            cell: (r: Quote) =>
              ["DRAFT", "SUBMITTED"].includes(r.status) ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px] text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    disabled={actionLoading === r.quote_id}
                    onClick={() => handleApprove(r.quote_id)}
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px] text-red-400 border-red-500/30 hover:bg-red-500/10"
                    disabled={actionLoading === r.quote_id}
                    onClick={() => handleReject(r.quote_id)}
                  >
                    <XCircle className="mr-1 h-3 w-3" /> Rechazar
                  </Button>
                </div>
              ) : null,
          } as DataTableColumn<Quote>,
        ]
      : []),
  ]

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-base font-semibold text-slate-200">
          <FileText className="h-5 w-5 text-blue-400" />
          Cotizaciones
        </h1>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-8 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-slate-300 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={quotes}
        rowKey={(r) => String(r.quote_id)}
        emptyLabel="Sin cotizaciones"
      />
    </div>
  )
}
