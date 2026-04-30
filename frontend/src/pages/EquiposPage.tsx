import { useCallback, useState } from "react"
import {
  Activity,
  AlertTriangle,
  Laptop,
  Plus,
  Search,
  Wrench,
  X,
} from "lucide-react"

import { AssetDetailPanel } from "@/components/assets/AssetDetailPanel"
import { AssetFormModal } from "@/components/assets/AssetFormModal"
import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { KpiCard } from "@/components/common/KpiCard"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/useApi"
import { formatCurrencyMXN } from "@/lib/utils"
import { assetsService } from "@/services/assetsService"
import { useAuthStore } from "@/stores/authStore"
import { cn } from "@/lib/utils"
import type { AssetRead } from "@/types/assets"

// ── Constants ─────────────────────────────────────────────────────────────────

const ASSET_TYPE_LABELS: Record<string, string> = {
  COMPUTER: "Computadora",
  LAPTOP: "Laptop",
  PRINTER: "Impresora",
  MACHINE: "Máquina",
  VEHICLE: "Vehículo",
  TOOL: "Herramienta",
  OTHER: "Otro",
}

const ASSET_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  IN_REPAIR: "En Reparación",
  IDLE: "Inactivo",
  RETIRED: "Retirado",
  DISMANTLED: "Desmantelado",
}

const ASSET_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  IN_REPAIR: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  IDLE: "border-slate-500/30 bg-slate-500/10 text-slate-500",
  RETIRED: "border-red-500/30 bg-red-500/10 text-red-600",
  DISMANTLED: "border-red-700/30 bg-red-700/10 text-red-700",
}

function AssetStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        ASSET_STATUS_COLORS[status] ?? "border-slate-500/30 bg-slate-500/10 text-slate-500",
      )}
    >
      {ASSET_STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ── Table columns ─────────────────────────────────────────────────────────────

const COLUMNS: DataTableColumn<AssetRead>[] = [
  {
    key: "asset_code",
    header: "Código",
    cell: (r) => <span className="font-mono text-xs">{r.asset_code}</span>,
  },
  {
    key: "asset_type",
    header: "Tipo",
    cell: (r) => ASSET_TYPE_LABELS[r.asset_type] ?? r.asset_type,
  },
  { key: "name", header: "Nombre", cell: (r) => r.name },
  { key: "manufacturer", header: "Fabricante", cell: (r) => r.manufacturer ?? "—" },
  { key: "location", header: "Ubicación", cell: (r) => r.location ?? "—" },
  {
    key: "purchase_cost",
    header: "Costo",
    cell: (r) => (r.purchase_cost != null ? formatCurrencyMXN(r.purchase_cost) : "—"),
  },
  {
    key: "warranty_until",
    header: "Garantía",
    cell: (r) => {
      if (!r.warranty_until) return <span className="text-muted-foreground">—</span>
      const d = new Date(r.warranty_until)
      const expired = d < new Date()
      return (
        <span className={expired ? "text-red-500" : undefined}>
          {d.toLocaleDateString("es-MX")}
        </span>
      )
    },
  },
  {
    key: "status",
    header: "Estado",
    cell: (r) => <AssetStatusBadge status={r.status} />,
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EquiposPage() {
  const token = useAuthStore((s) => s.accessToken)
  const [filterStatus, setFilterStatus] = useState("")
  const [filterType, setFilterType] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedAsset, setSelectedAsset] = useState<AssetRead | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AssetRead | null>(null)
  const [listKey, setListKey] = useState(0)

  const kpisFetcher = useCallback(
    (signal: AbortSignal) => assetsService.getKpisV2(token, signal),
    [token],
  )
  const { data: kpisV2 } = useApi(kpisFetcher)

  const assetsFetcher = useCallback(
    (signal: AbortSignal) =>
      assetsService.listAssets(
        token,
        {
          status: filterStatus || undefined,
          asset_type: filterType || undefined,
          limit: 500,
        },
        signal,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, filterStatus, filterType, listKey],
  )
  const { data: assets, status: tableStatus } = useApi(assetsFetcher)

  const rows = assets ?? []

  const filteredRows = searchQuery.trim()
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.asset_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.manufacturer ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : rows

  const kpis = {
    total: kpisV2?.total_assets ?? rows.length,
    enReparacion: kpisV2?.assets_en_reparacion ?? rows.filter((r) => r.status === "IN_REPAIR").length,
    activos: rows.filter((r) => r.status === "ACTIVE").length,
    inactivos: rows.filter((r) => r.status === "IDLE" || r.status === "RETIRED" || r.status === "DISMANTLED").length,
  }

  const hasFilters = filterStatus || filterType || searchQuery

  function clearFilters() {
    setFilterStatus("")
    setFilterType("")
    setSearchQuery("")
  }

  function handleRefresh() {
    setListKey((k) => k + 1)
  }

  function openNew() {
    setEditTarget(null)
    setFormOpen(true)
  }

  function openEdit(asset: AssetRead) {
    setEditTarget(asset)
    setFormOpen(true)
  }

  function onFormSuccess(asset: AssetRead) {
    handleRefresh()
    if (editTarget) {
      setSelectedAsset(asset)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="surface-card">
        <div className="panel-header p-5 md:p-6">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge variant="info">Activos físicos</StatusBadge>
            </div>
            <div className="flex items-center gap-3">
              <Laptop className="h-6 w-6 text-[hsl(var(--primary))]" aria-hidden="true" />
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Gestión de Equipos
                </h1>
                <p className="text-sm text-muted-foreground">
                  Activos físicos registrados · Componentes y historial de mantenimiento
                </p>
              </div>
            </div>
          </div>
          <div>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" />
              Nuevo Activo
            </Button>
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Activos"
          value={String(kpis.total)}
          description="Equipos registrados"
          icon={Laptop}
          tone="blue"
        />
        <KpiCard
          title="En Operación"
          value={String(kpis.activos)}
          description="Status: Activo"
          icon={Activity}
          tone="green"
        />
        <KpiCard
          title="En Reparación"
          value={String(kpis.enReparacion)}
          description="Status: In Repair"
          icon={Wrench}
          tone="orange"
          badge={kpis.enReparacion > 0 ? { label: "Atención", variant: "warning" } : undefined}
        />
        <KpiCard
          title="Fuera de Servicio"
          value={String(kpis.inactivos)}
          description="Inactivos, Retirados o Desmantelados"
          icon={AlertTriangle}
          tone="neutral"
        />
      </div>

      {/* Toolbar */}
      <div className="surface-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por código, nombre o fabricante…"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <select
            className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {Object.entries(ASSET_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>

          <select
            className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {Object.entries(ASSET_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-3.5 w-3.5" />
              Limpiar
            </Button>
          )}

          {selectedAsset && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedAsset(null)}
              className="ml-auto gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Cerrar detalle
            </Button>
          )}
        </div>
      </div>

      {/* Master-detail layout */}
      <div className={cn("flex gap-4", selectedAsset ? "items-start" : "")}>
        {/* Asset table */}
        <div className="min-w-0 flex-1">
          <DataTable
            columns={COLUMNS}
            rows={filteredRows}
            rowKey={(r) => r.id}
            onRowClick={(r) => setSelectedAsset(r)}
            selectedRowKey={selectedAsset?.id}
            maxHeight={selectedAsset ? "calc(100vh - 400px)" : "calc(100vh - 360px)"}
            emptyLabel={
              tableStatus === "loading" || tableStatus === "idle"
                ? "Cargando activos…"
                : tableStatus === "error"
                  ? "Error al cargar activos"
                  : "Sin activos registrados"
            }
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {filteredRows.length} activo{filteredRows.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Detail panel */}
        {selectedAsset && (
          <div className="w-[460px] shrink-0" style={{ maxHeight: "calc(100vh - 340px)" }}>
            <AssetDetailPanel
              asset={selectedAsset}
              onClose={() => setSelectedAsset(null)}
              onEdit={() => openEdit(selectedAsset)}
              onRefresh={handleRefresh}
            />
          </div>
        )}
      </div>

      {/* Modales */}
      <AssetFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={onFormSuccess}
        asset={editTarget ?? undefined}
      />
    </div>
  )
}
