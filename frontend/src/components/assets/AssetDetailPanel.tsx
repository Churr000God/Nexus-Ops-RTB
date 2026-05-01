import { useCallback, useState } from "react"
import { AlertTriangle, GitBranch, History, Pencil, Plus, Trash2, UserCheck, Wrench, X } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/useApi"
import { formatCurrencyMXN } from "@/lib/utils"
import { assetsService } from "@/services/assetsService"
import { useAuthStore } from "@/stores/authStore"
import { cn } from "@/lib/utils"
import type { AssetAssignment, AssetComponentDetail, AssetComponentHistoryItem, AssetRead, WorkOrderRead } from "@/types/assets"
import { AssignAssetModal } from "./AssignAssetModal"
import { InstallComponentModal } from "./InstallComponentModal"
import { RemoveComponentModal } from "./RemoveComponentModal"
import { RetireAssetModal } from "./RetireAssetModal"
import { WorkOrderFormModal } from "./WorkOrderFormModal"

const ASSET_TYPE_LABELS: Record<string, string> = {
  COMPUTER: "Computadora",
  LAPTOP: "Laptop",
  PRINTER: "Impresora",
  MACHINE: "Máquina",
  VEHICLE: "Vehículo",
  TOOL: "Herramienta",
  OTHER: "Otro",
}

const ASSET_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  IN_REPAIR: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  IDLE: "border-slate-500/30 bg-slate-500/10 text-slate-500",
  RETIRED: "border-red-500/30 bg-red-500/10 text-red-600",
  DISMANTLED: "border-red-700/30 bg-red-700/10 text-red-700",
}

const ASSET_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  IN_REPAIR: "En Reparación",
  IDLE: "Inactivo",
  RETIRED: "Retirado",
  DISMANTLED: "Desmantelado",
}

const OPERATION_LABELS: Record<string, string> = {
  INSTALL: "Instalado",
  REMOVE: "Removido",
  REPLACE: "Reemplazado",
}

const OPERATION_COLORS: Record<string, string> = {
  INSTALL: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  REMOVE: "border-red-500/30 bg-red-500/10 text-red-600",
  REPLACE: "border-blue-500/30 bg-blue-500/10 text-blue-600",
}

type Tab = "info" | "components" | "history" | "assignments" | "children" | "maintenance"

interface AssetDetailPanelProps {
  asset: AssetRead
  onClose: () => void
  onEdit: () => void
  onRefresh: () => void
}

export function AssetDetailPanel({ asset, onClose, onEdit, onRefresh }: AssetDetailPanelProps) {
  const token = useAuthStore((s) => s.accessToken)
  const [tab, setTab] = useState<Tab>("info")
  const [installOpen, setInstallOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<AssetComponentDetail | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [compKey, setCompKey] = useState(0)
  const [assignKey, setAssignKey] = useState(0)
  const [retireOpen, setRetireOpen] = useState(false)
  const [woOpen, setWoOpen] = useState(false)
  const [woTarget, setWoTarget] = useState<WorkOrderRead | null>(null)
  const [woKey, setWoKey] = useState(0)

  const componentsFetcher = useCallback(
    (signal: AbortSignal) => assetsService.getComponents(token, asset.id, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, asset.id, compKey],
  )
  const { data: components, status: compStatus } = useApi(componentsFetcher)

  const historyFetcher = useCallback(
    (signal: AbortSignal) => assetsService.getHistory(token, asset.id, {}, signal),
    [token, asset.id],
  )
  const { data: history, status: histStatus } = useApi(historyFetcher)

  const assignmentsFetcher = useCallback(
    (signal: AbortSignal) => assetsService.getAssignments(token, asset.id, {}, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, asset.id, assignKey],
  )
  const { data: assignments, status: assignStatus } = useApi(assignmentsFetcher)

  const childrenFetcher = useCallback(
    (signal: AbortSignal) => assetsService.getChildren(token, asset.id, signal),
    [token, asset.id],
  )
  const { data: children, status: childrenStatus } = useApi(childrenFetcher)

  const woFetcher = useCallback(
    (signal: AbortSignal) => assetsService.listWorkOrders(token, asset.id, {}, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, asset.id, woKey],
  )
  const { data: workOrders, status: woStatus } = useApi(woFetcher)

  function refreshWo() { setWoKey((k) => k + 1) }

  const parentFetcher = useCallback(
    (signal: AbortSignal) =>
      asset.parent_asset_id
        ? assetsService.getAsset(token, asset.parent_asset_id, signal)
        : Promise.resolve(null),
    [token, asset.parent_asset_id],
  )
  const { data: parentAsset } = useApi(parentFetcher)

  function refreshComponents() {
    setCompKey((k) => k + 1)
    onRefresh()
  }

  function refreshAssignments() {
    setAssignKey((k) => k + 1)
    onRefresh()
  }

  const componentColumns: DataTableColumn<AssetComponentDetail>[] = [
    { key: "component_name", header: "Componente", cell: (r) => r.component_name ?? "—" },
    { key: "component_sku", header: "SKU", cell: (r) => r.component_sku ?? "—" },
    { key: "quantity", header: "Cant.", cell: (r) => String(r.quantity) },
    { key: "serial_number", header: "S/N", cell: (r) => r.serial_number ?? "—" },
    {
      key: "installed_at",
      header: "Instalado",
      cell: (r) => new Date(r.installed_at).toLocaleDateString("es-MX"),
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setRemoveTarget(r) }}
          className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
          title="Remover componente"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ]

  const historyColumns: DataTableColumn<AssetComponentHistoryItem>[] = [
    {
      key: "occurred_at",
      header: "Fecha",
      cell: (r) => new Date(r.occurred_at).toLocaleDateString("es-MX"),
    },
    {
      key: "operation",
      header: "Operación",
      cell: (r) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
            OPERATION_COLORS[r.operation] ?? "border-slate-500/30 bg-slate-500/10 text-slate-500",
          )}
        >
          {OPERATION_LABELS[r.operation] ?? r.operation}
        </span>
      ),
    },
    { key: "component_name", header: "Componente", cell: (r) => r.component_name ?? "—" },
    { key: "serial_number", header: "S/N", cell: (r) => r.serial_number ?? "—" },
    { key: "performed_by", header: "Realizado por", cell: (r) => r.performed_by ?? "—" },
    { key: "reason", header: "Motivo", cell: (r) => r.reason ?? "—" },
  ]

  const assignmentColumns: DataTableColumn<AssetAssignment>[] = [
    {
      key: "assigned_at",
      header: "Fecha",
      cell: (r) => new Date(r.assigned_at).toLocaleDateString("es-MX"),
    },
    {
      key: "user_name",
      header: "Asignado a",
      cell: (r) =>
        r.user_name ? (
          <div>
            <p className="text-sm text-foreground">{r.user_name}</p>
            <p className="text-xs text-muted-foreground">{r.user_email}</p>
          </div>
        ) : (
          <span className="text-muted-foreground italic">Sin asignar</span>
        ),
    },
    { key: "location", header: "Ubicación", cell: (r) => r.location ?? "—" },
    { key: "assigned_by_email", header: "Registrado por", cell: (r) => r.assigned_by_email ?? "—" },
    { key: "notes", header: "Notas", cell: (r) => r.notes ?? "—" },
  ]

  const WO_TYPE_LABELS: Record<string, string> = {
    PREVENTIVE: "Preventivo", CORRECTIVE: "Correctivo", INSPECTION: "Inspección", UPGRADE: "Mejora",
  }
  const WO_PRIORITY_COLORS: Record<string, string> = {
    LOW: "text-slate-500", MEDIUM: "text-amber-600", HIGH: "text-orange-500", URGENT: "text-red-600",
  }
  const WO_STATUS_COLORS: Record<string, string> = {
    OPEN: "border-amber-500/30 bg-amber-500/10 text-amber-600",
    IN_PROGRESS: "border-blue-500/30 bg-blue-500/10 text-blue-600",
    DONE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
    CANCELLED: "border-slate-500/30 bg-slate-500/10 text-slate-500",
  }
  const WO_STATUS_LABELS: Record<string, string> = {
    OPEN: "Abierta", IN_PROGRESS: "En Proceso", DONE: "Completada", CANCELLED: "Cancelada",
  }

  const workOrderColumns: DataTableColumn<WorkOrderRead>[] = [
    {
      key: "status",
      header: "Estado",
      cell: (r) => (
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", WO_STATUS_COLORS[r.status] ?? WO_STATUS_COLORS.OPEN)}>
          {WO_STATUS_LABELS[r.status] ?? r.status}
        </span>
      ),
    },
    {
      key: "priority",
      header: "P",
      cell: (r) => (
        <span className={cn("text-xs font-bold", WO_PRIORITY_COLORS[r.priority] ?? "text-muted-foreground")}>
          {r.priority[0]}
        </span>
      ),
    },
    { key: "title", header: "Título", cell: (r) => <span className="text-sm">{r.title}</span> },
    { key: "work_type", header: "Tipo", cell: (r) => WO_TYPE_LABELS[r.work_type] ?? r.work_type },
    {
      key: "scheduled_date",
      header: "Fecha",
      cell: (r) => r.scheduled_date
        ? new Date(r.scheduled_date + "T12:00:00").toLocaleDateString("es-MX")
        : "—",
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setWoTarget(r); setWoOpen(true) }}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Editar orden"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ]

  const childrenColumns: DataTableColumn<AssetRead>[] = [
    { key: "asset_code", header: "Código", cell: (r) => <span className="font-mono text-xs">{r.asset_code}</span> },
    { key: "name", header: "Nombre", cell: (r) => r.name },
    {
      key: "status",
      header: "Estado",
      cell: (r) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
            ASSET_STATUS_COLORS[r.status] ?? "border-slate-500/30 bg-slate-500/10 text-slate-500",
          )}
        >
          {ASSET_STATUS_LABELS[r.status] ?? r.status}
        </span>
      ),
    },
    { key: "location", header: "Ubicación", cell: (r) => r.location ?? "—" },
  ]

  function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
    return (
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm text-foreground">{value || "—"}</dd>
      </div>
    )
  }

  return (
    <div className="surface-card flex h-full flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex shrink-0 items-start justify-between border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-muted-foreground">
              {asset.asset_code}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                ASSET_STATUS_COLORS[asset.status] ??
                  "border-slate-500/30 bg-slate-500/10 text-slate-500",
              )}
            >
              {ASSET_STATUS_LABELS[asset.status] ?? asset.status}
            </span>
          </div>
          <h3 className="mt-1 truncate text-sm font-semibold text-foreground">{asset.name}</h3>
          <p className="text-xs text-muted-foreground">
            {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}
            {asset.manufacturer ? ` · ${asset.manufacturer}` : ""}
            {asset.model ? ` ${asset.model}` : ""}
          </p>
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-1">
          {!["RETIRED", "DISMANTLED"].includes(asset.status) && (
            <button
              type="button"
              onClick={() => setRetireOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
              title="Dar de baja"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Editar activo"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Cerrar panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-border">
        {(["info", "components", "history", "assignments", "children", "maintenance"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2.5 text-xs font-medium transition-colors",
              tab === t
                ? "border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "info" && "Info"}
            {t === "components" && `Partes${components ? ` (${components.length})` : ""}`}
            {t === "history" && (
              <span className="flex items-center justify-center gap-1">
                <History className="h-3 w-3" />
                Historial
              </span>
            )}
            {t === "assignments" && (
              <span className="flex items-center justify-center gap-1">
                <UserCheck className="h-3 w-3" />
                Asignaciones
              </span>
            )}
            {t === "children" && (
              <span className="flex items-center justify-center gap-1">
                <GitBranch className="h-3 w-3" />
                {`Sub-activos${children ? ` (${children.length})` : ""}`}
              </span>
            )}
            {t === "maintenance" && (
              <span className="flex items-center justify-center gap-1">
                <Wrench className="h-3 w-3" />
                {`Mant.${workOrders ? ` (${workOrders.length})` : ""}`}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "info" && (
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <InfoRow label="Tipo" value={ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type} />
            <InfoRow label="Ubicación" value={asset.location} />
            <InfoRow label="Fabricante" value={asset.manufacturer} />
            <InfoRow label="Modelo" value={asset.model} />
            <InfoRow label="Número de Serie" value={asset.serial_number} />
            <InfoRow
              label="Fecha de Compra"
              value={
                asset.purchase_date
                  ? new Date(asset.purchase_date).toLocaleDateString("es-MX")
                  : null
              }
            />
            <InfoRow
              label="Costo de Compra"
              value={
                asset.purchase_cost != null ? formatCurrencyMXN(asset.purchase_cost) : null
              }
            />
            <InfoRow
              label="Garantía hasta"
              value={
                asset.warranty_until
                  ? new Date(asset.warranty_until).toLocaleDateString("es-MX")
                  : null
              }
            />
            {asset.notes && (
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Notas
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                  {asset.notes}
                </dd>
              </div>
            )}
            {parentAsset && (
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Activo padre
                </dt>
                <dd className="mt-0.5 flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground">{parentAsset.asset_code}</span>
                  <span className="text-sm text-foreground">{parentAsset.name}</span>
                </dd>
              </div>
            )}
            <div className="sm:col-span-2 border-t border-border pt-3">
              <InfoRow
                label="Registrado"
                value={new Date(asset.created_at).toLocaleString("es-MX")}
              />
            </div>
            {asset.retired_at && (
              <div className="sm:col-span-2 rounded-md border border-red-500/20 bg-red-500/5 p-3 space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-red-500">
                  Baja formal
                </p>
                <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  <InfoRow
                    label="Fecha de baja"
                    value={new Date(asset.retired_at).toLocaleDateString("es-MX")}
                  />
                  {asset.salvage_value != null && (
                    <InfoRow
                      label="Valor residual"
                      value={asset.salvage_value.toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                      })}
                    />
                  )}
                  {asset.retirement_reason && (
                    <div className="sm:col-span-2">
                      <InfoRow label="Motivo" value={asset.retirement_reason} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </dl>
        )}

        {tab === "components" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setInstallOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Instalar Parte
              </Button>
            </div>
            <DataTable
              columns={componentColumns}
              rows={components ?? []}
              rowKey={(r) => r.asset_component_id}
              maxHeight="300px"
              emptyLabel={
                compStatus === "loading" || compStatus === "idle"
                  ? "Cargando…"
                  : "Sin componentes instalados"
              }
            />
          </div>
        )}

        {tab === "history" && (
          <DataTable
            columns={historyColumns}
            rows={history ?? []}
            rowKey={(r) => r.history_id}
            maxHeight="300px"
            emptyLabel={
              histStatus === "loading" || histStatus === "idle"
                ? "Cargando…"
                : "Sin historial registrado"
            }
          />
        )}

        {tab === "maintenance" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setWoTarget(null); setWoOpen(true) }}>
                <Plus className="h-3.5 w-3.5" />
                Nueva Orden
              </Button>
            </div>
            <DataTable
              columns={workOrderColumns}
              rows={workOrders ?? []}
              rowKey={(r) => r.id}
              maxHeight="300px"
              emptyLabel={
                woStatus === "loading" || woStatus === "idle"
                  ? "Cargando…"
                  : "Sin órdenes de mantenimiento"
              }
            />
          </div>
        )}

        {tab === "children" && (
          <DataTable
            columns={childrenColumns}
            rows={children ?? []}
            rowKey={(r) => r.id}
            maxHeight="300px"
            emptyLabel={
              childrenStatus === "loading" || childrenStatus === "idle"
                ? "Cargando…"
                : "Sin sub-activos vinculados"
            }
          />
        )}

        {tab === "assignments" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setAssignOpen(true)}>
                <UserCheck className="h-3.5 w-3.5" />
                Asignar / Reasignar
              </Button>
            </div>
            <DataTable
              columns={assignmentColumns}
              rows={assignments ?? []}
              rowKey={(r) => r.id}
              maxHeight="300px"
              emptyLabel={
                assignStatus === "loading" || assignStatus === "idle"
                  ? "Cargando…"
                  : "Sin asignaciones registradas"
              }
            />
          </div>
        )}
      </div>

      {/* Modales */}
      <InstallComponentModal
        open={installOpen}
        onClose={() => setInstallOpen(false)}
        onSuccess={refreshComponents}
        assetId={asset.id}
      />
      <RemoveComponentModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onSuccess={refreshComponents}
        assetId={asset.id}
        component={removeTarget}
      />
      <AssignAssetModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onSuccess={refreshAssignments}
        asset={asset}
      />
      <RetireAssetModal
        open={retireOpen}
        onClose={() => setRetireOpen(false)}
        onSuccess={(_updated) => { onRefresh(); onClose() }}
        asset={asset}
      />
      <WorkOrderFormModal
        open={woOpen}
        onClose={() => { setWoOpen(false); setWoTarget(null) }}
        onSuccess={() => refreshWo()}
        assetId={asset.id}
        workOrder={woTarget ?? undefined}
      />
    </div>
  )
}
