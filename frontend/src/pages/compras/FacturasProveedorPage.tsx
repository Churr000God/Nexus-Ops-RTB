import { useCallback, useState } from "react"
import { FileText } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import { getSupplierInvoices } from "@/services/comprasService"
import type { SupplierInvoiceListItem, PaymentStatus } from "@/types/compras"
import { cn } from "@/lib/utils"

const INVOICE_STATUS_COLORS: Record<string, string> = {
  RECEIVED:  "border-blue-500/30 bg-blue-500/10 text-blue-400",
  VALIDATED: "border-teal-500/30 bg-teal-500/10 text-teal-400",
  PAID:      "border-green-500/30 bg-green-500/10 text-green-400",
  CANCELLED: "border-red-900/30 bg-red-900/10 text-red-600",
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  RECEIVED:  "Recibida",
  VALIDATED: "Validada",
  PAID:      "Pagada",
  CANCELLED: "Cancelada",
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  UNPAID:  "border-red-500/30 bg-red-500/10 text-red-400",
  PARTIAL: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  PAID:    "border-green-500/30 bg-green-500/10 text-green-400",
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID:  "Sin pagar",
  PARTIAL: "Parcial",
  PAID:    "Pagada",
}

const TYPE_LABELS: Record<string, string> = {
  GOODS:    "Bienes",
  SERVICES: "Servicios",
  MIXED:    "Mixta",
}

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("es-MX") : "—"

const COLUMNS: DataTableColumn<SupplierInvoiceListItem>[] = [
  { key: "invoice_number", header: "# Factura",      cell: (r) => r.invoice_number },
  { key: "invoice_type",   header: "Tipo",            cell: (r) => TYPE_LABELS[r.invoice_type] ?? r.invoice_type },
  { key: "invoice_date",   header: "Fecha factura",   cell: (r) => fmtDate(r.invoice_date) },
  {
    key: "status",
    header: "Estatus",
    cell: (r) => (
      <span className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        INVOICE_STATUS_COLORS[r.status] ?? INVOICE_STATUS_COLORS.RECEIVED
      )}>
        {INVOICE_STATUS_LABELS[r.status] ?? r.status}
      </span>
    ),
  },
  {
    key: "payment_status",
    header: "Pago",
    cell: (r) => (
      <span className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        PAYMENT_STATUS_COLORS[r.payment_status] ?? PAYMENT_STATUS_COLORS.UNPAID
      )}>
        {PAYMENT_STATUS_LABELS[r.payment_status] ?? r.payment_status}
      </span>
    ),
  },
  { key: "is_credit", header: "Crédito", cell: (r) => r.is_credit ? "Sí (PPD)" : "No (PUE)" },
  { key: "total",     header: "Total",   cell: (r) => r.total != null ? fmt.format(r.total) : "—" },
]

const PAYMENT_OPTIONS: { value: PaymentStatus | ""; label: string }[] = [
  { value: "",        label: "Todos los estados de pago" },
  { value: "UNPAID",  label: "Sin pagar" },
  { value: "PARTIAL", label: "Parcial" },
  { value: "PAID",    label: "Pagada" },
]

export default function FacturasProveedorPage() {
  const [filterPayment, setFilterPayment] = useState<PaymentStatus | "">("")

  const fetcher = useCallback(
    (signal: AbortSignal) => getSupplierInvoices({ payment_status: filterPayment || undefined }, signal),
    [filterPayment],
  )
  const { data, status } = useApi(fetcher)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-[hsl(var(--primary))]" />
        <h1 className="text-xl font-semibold text-white">Facturas de Proveedor</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-md border border-white/10 bg-background px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
          value={filterPayment}
          onChange={(e) => setFilterPayment(e.target.value as PaymentStatus | "")}
        >
          {PAYMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={COLUMNS}
        rows={data ?? []}
        rowKey={(r) => String(r.invoice_id)}
        emptyLabel={
          status === "loading" ? "Cargando…"
          : status === "error" ? "Error al cargar facturas"
          : "Sin facturas registradas"
        }
      />
    </div>
  )
}
