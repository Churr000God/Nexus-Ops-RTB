import { useCallback, useState } from "react"
import { MapPin } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import { getRoutes } from "@/services/ventasLogisticaService"
import type { Route, RouteStatus } from "@/types/ventasLogistica"
import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<RouteStatus, string> = {
  PLANNING: "border-slate-500/30 bg-slate-500/10 text-slate-400",
  ASSIGNED: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  IN_PROGRESS: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  COMPLETED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  CANCELLED: "border-red-900/30 bg-red-900/10 text-red-600",
}

const STATUS_LABELS: Record<RouteStatus, string> = {
  PLANNING: "Planeando",
  ASSIGNED: "Asignada",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
}

export default function RutasPage() {
  const [filterStatus, setFilterStatus] = useState("")

  const api = useApi(
    useCallback(
      (_signal: AbortSignal) => getRoutes({ status: filterStatus || undefined, limit: 100 }),
      [filterStatus]
    )
  )

  const routes = (api.data ?? []) as Route[]

  const columns: DataTableColumn<Route>[] = [
    { key: "route_number", header: "Ruta", className: "font-mono text-xs", cell: (r) => r.route_number },
    { key: "route_date", header: "Fecha", className: "text-xs", cell: (r) => String(r.route_date) },
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
    { key: "vehicle_plate", header: "Placas", className: "text-xs font-mono", cell: (r) => r.vehicle_plate ?? "—" },
    { key: "vehicle_label", header: "Vehículo", className: "text-xs", cell: (r) => r.vehicle_label ?? "—" },
    {
      key: "stops",
      header: "Paradas",
      cell: (r) => (
        <div className="flex gap-2 text-xs">
          <span className="text-teal-400">
            {r.stops.filter((s) => s.stop_type === "DELIVERY").length} entregas
          </span>
          <span className="text-violet-400">
            {r.stops.filter((s) => s.stop_type === "PICKUP").length} recolecciones
          </span>
        </div>
      ),
    },
    {
      key: "total_distance_km",
      header: "Km",
      className: "text-xs text-slate-400",
      cell: (r) => (r.total_distance_km != null ? `${r.total_distance_km} km` : "—"),
    },
  ]

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-base font-semibold text-slate-200">
          <MapPin className="h-5 w-5 text-teal-400" />
          Rutas
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
        rows={routes}
        rowKey={(r) => String(r.route_id)}
        emptyLabel="Sin rutas"
      />
    </div>
  )
}
