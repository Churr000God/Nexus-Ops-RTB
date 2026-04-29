import { useCallback } from "react"
import { CheckCircle2, Truck, XCircle } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import { getCarriers } from "@/services/ventasLogisticaService"
import type { Carrier } from "@/types/ventasLogistica"
import { cn } from "@/lib/utils"

export default function FleterasPage() {
  const api = useApi(useCallback((_signal: AbortSignal) => getCarriers(false), []))
  const carriers = (api.data ?? []) as Carrier[]

  const columns: DataTableColumn<Carrier>[] = [
    { key: "code", header: "Código", className: "font-mono text-xs", cell: (r) => r.code },
    { key: "name", header: "Nombre", cell: (r) => r.name },
    {
      key: "is_internal",
      header: "Tipo",
      cell: (r) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
            r.is_internal
              ? "border-violet-500/30 bg-violet-500/10 text-violet-400"
              : "border-slate-500/30 bg-slate-500/10 text-slate-400"
          )}
        >
          {r.is_internal ? "Propia" : "Externa"}
        </span>
      ),
    },
    { key: "contact_name", header: "Contacto", className: "text-xs", cell: (r) => r.contact_name ?? "—" },
    { key: "phone", header: "Teléfono", className: "text-xs font-mono", cell: (r) => r.phone ?? "—" },
    { key: "email", header: "Email", className: "text-xs", cell: (r) => r.email ?? "—" },
    {
      key: "tracking_url_template",
      header: "URL tracking",
      cell: (r) =>
        r.tracking_url_template ? (
          <span className="max-w-[180px] truncate text-xs text-blue-400">{r.tracking_url_template}</span>
        ) : (
          "—"
        ),
    },
    {
      key: "is_active",
      header: "Activa",
      cell: (r) =>
        r.is_active ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <XCircle className="h-4 w-4 text-red-400" />
        ),
    },
  ]

  return (
    <div className="space-y-4 p-6">
      <h1 className="flex items-center gap-2 text-base font-semibold text-slate-200">
        <Truck className="h-5 w-5 text-slate-400" />
        Fleteras
      </h1>
      <DataTable
        columns={columns}
        rows={carriers}
        rowKey={(r) => String(r.carrier_id)}
        emptyLabel="Sin fleteras registradas"
      />
    </div>
  )
}
