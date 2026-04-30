import { useCallback, useMemo, useState } from "react"
import {
  BoxesIcon,
  ClipboardList,
  History,
  Laptop,
  Package,
  TrendingUp,
  Wrench,
} from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { KpiCard } from "@/components/common/KpiCard"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/useApi"
import { formatCurrencyMXN, formatNumber } from "@/lib/utils"
import { assetsService } from "@/services/assetsService"
import { useAuthStore } from "@/stores/authStore"
import { cn } from "@/lib/utils"
import type {
  AssetComponentDetail,
  AssetComponentHistoryItem,
  AssetRead,
} from "@/types/assets"

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("es-MX") : "—"
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })

// ── Status / type labels ──────────────────────────────────────────────────────

const ASSET_TYPE_LABELS: Record<string, string> = {
  COMPUTER: "Computadora",
  LAPTOP: "Laptop",
  PRINTER: "Impresora",
  MACHINE: "Maquinaria",
  VEHICLE: "Vehículo",
  TOOL: "Herramienta",
  OTHER: "Otro",
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:     "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  IN_REPAIR:  "border-amber-500/30  bg-amber-500/10  text-amber-600",
  IDLE:       "border-slate-500/30  bg-slate-500/10  text-slate-500",
  RETIRED:    "border-red-500/30    bg-red-500/10    text-red-600",
  DISMANTLED: "border-slate-500/30  bg-slate-500/10  text-slate-400",
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  IN_REPAIR: "En reparación",
  IDLE: "Inactivo",
  RETIRED: "Retirado",
  DISMANTLED: "Desmantelado",
}

const OP_COLORS: Record<string, string> = {
  INSTALL: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  REMOVE:  "border-red-500/30    bg-red-500/10    text-red-600",
  REPLACE: "border-blue-500/30   bg-blue-500/10   text-blue-600",
}

const OP_LABELS: Record<string, string> = {
  INSTALL: "Instalación",
  REMOVE: "Retiro",
  REPLACE: "Reemplazo",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STATUS_COLORS[status] ?? "border-slate-500/30 bg-slate-500/10 text-slate-500",
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ── Asset columns ─────────────────────────────────────────────────────────────

const ASSET_COLS: DataTableColumn<AssetRead>[] = [
  { key: "asset_code", header: "Código", cell: (r) => r.asset_code },
  {
    key: "asset_type",
    header: "Tipo",
    cell: (r) => ASSET_TYPE_LABELS[r.asset_type] ?? r.asset_type,
  },
  { key: "name", header: "Nombre", cell: (r) => r.name },
  { key: "location", header: "Ubicación", cell: (r) => r.location ?? "—" },
  {
    key: "status",
    header: "Estado",
    cell: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: "purchase_cost",
    header: "Costo Compra",
    cell: (r) => (r.purchase_cost != null ? fmt.format(r.purchase_cost) : "—"),
  },
  { key: "purchase_date", header: "Fecha Compra", cell: (r) => fmtDate(r.purchase_date) },
]

// ── Component columns ─────────────────────────────────────────────────────────

const COMP_COLS: DataTableColumn<AssetComponentDetail>[] = [
  { key: "component_sku", header: "SKU", cell: (r) => r.component_sku ?? "—" },
  { key: "component_name", header: "Componente", cell: (r) => r.component_name ?? "—" },
  { key: "quantity", header: "Cantidad", cell: (r) => String(r.quantity) },
  { key: "serial_number", header: "Serie", cell: (r) => r.serial_number ?? "—" },
  {
    key: "installed_at",
    header: "Instalado",
    cell: (r) => fmtDateTime(r.installed_at),
  },
  { key: "installed_by_email", header: "Por", cell: (r) => r.installed_by_email ?? "—" },
  { key: "notes", header: "Notas", cell: (r) => r.notes ?? "—" },
]

// ── History columns ───────────────────────────────────────────────────────────

const HIST_COLS: DataTableColumn<AssetComponentHistoryItem>[] = [
  {
    key: "occurred_at",
    header: "Fecha",
    cell: (r) => fmtDateTime(r.occurred_at),
  },
  {
    key: "operation",
    header: "Operación",
    cell: (r) => (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
          OP_COLORS[r.operation] ?? "border-slate-500/30 bg-slate-500/10 text-slate-500",
        )}
      >
        {OP_LABELS[r.operation] ?? r.operation}
      </span>
    ),
  },
  { key: "component_sku", header: "SKU", cell: (r) => r.component_sku ?? "—" },
  { key: "component_name", header: "Componente", cell: (r) => r.component_name ?? "—" },
  { key: "quantity", header: "Cant.", cell: (r) => (r.quantity != null ? String(r.quantity) : "—") },
  { key: "serial_number", header: "Serie", cell: (r) => r.serial_number ?? "—" },
  { key: "performed_by", header: "Usuario", cell: (r) => r.performed_by ?? "—" },
  { key: "reason", header: "Razón", cell: (r) => r.reason ?? "—" },
  { key: "notes", header: "Notas", cell: (r) => r.notes ?? "—" },
]

// ── Asset detail panel ────────────────────────────────────────────────────────

type DetailTab = "componentes" | "historial"

function AssetDetailPanel({ asset }: { asset: AssetRead }) {
  const token = useAuthStore((s) => s.accessToken)
  const [detailTab, setDetailTab] = useState<DetailTab>("componentes")

  const compFetcher = useCallback(
    (signal: AbortSignal) => assetsService.getComponents(token, asset.id, signal),
    [token, asset.id],
  )
  const histFetcher = useCallback(
    (signal: AbortSignal) =>
      assetsService.getHistory(token, asset.id, { limit: 200 }, signal),
    [token, asset.id],
  )

  const { data: components, status: compStatus } = useApi(compFetcher, {
    enabled: detailTab === "componentes",
  })
  const { data: history, status: histStatus } = useApi(histFetcher, {
    enabled: detailTab === "historial",
  })

  return (
    <div className="mt-4 surface-card">
      {/* Detail header */}
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-3">
          <Laptop className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">
            {asset.asset_code} — {asset.name}
          </span>
          <StatusBadge status={asset.status} />
        </div>
        <div className="flex gap-1 rounded-[var(--radius-md)] bg-secondary p-1">
          <button
            type="button"
            onClick={() => setDetailTab("componentes")}
            className={cn(
              "flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-sm font-medium transition-all",
              detailTab === "componentes"
                ? "bg-primary text-primary-foreground shadow-soft-sm"
                : "text-secondary-foreground hover:bg-secondary-foreground/10",
            )}
          >
            <Package className="h-3.5 w-3.5" aria-hidden="true" />
            Componentes
          </button>
          <button
            type="button"
            onClick={() => setDetailTab("historial")}
            className={cn(
              "flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-sm font-medium transition-all",
              detailTab === "historial"
                ? "bg-primary text-primary-foreground shadow-soft-sm"
                : "text-secondary-foreground hover:bg-secondary-foreground/10",
            )}
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            Historial
          </button>
        </div>
      </div>

      {/* Detail content */}
      <div className="p-1">
        {detailTab === "componentes" ? (
          <DataTable
            columns={COMP_COLS}
            rows={components ?? []}
            rowKey={(r) => r.asset_component_id}
            maxHeight="300px"
            emptyLabel={
              compStatus === "loading" || compStatus === "idle"
                ? "Cargando…"
                : compStatus === "error"
                  ? "Error al cargar componentes"
                  : "Sin componentes instalados"
            }
          />
        ) : (
          <DataTable
            columns={HIST_COLS}
            rows={history ?? []}
            rowKey={(r) => r.history_id}
            maxHeight="300px"
            emptyLabel={
              histStatus === "loading" || histStatus === "idle"
                ? "Cargando…"
                : histStatus === "error"
                  ? "Error al cargar historial"
                  : "Sin historial registrado"
            }
          />
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ASSET_TYPES = [
  { value: "COMPUTER", label: "Computadora" },
  { value: "LAPTOP", label: "Laptop" },
  { value: "PRINTER", label: "Impresora" },
  { value: "MACHINE", label: "Maquinaria" },
  { value: "VEHICLE", label: "Vehículo" },
  { value: "TOOL", label: "Herramienta" },
  { value: "OTHER", label: "Otro" },
]

const ASSET_STATUSES = [
  { value: "ACTIVE", label: "Activo" },
  { value: "IN_REPAIR", label: "En reparación" },
  { value: "IDLE", label: "Inactivo" },
  { value: "RETIRED", label: "Retirado" },
  { value: "DISMANTLED", label: "Desmantelado" },
]

export default function EquiposPage() {
  const token = useAuthStore((s) => s.accessToken)
  const [filterType, setFilterType] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [selectedAsset, setSelectedAsset] = useState<AssetRead | null>(null)

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      assetsService.listAssets(
        token,
        {
          asset_type: filterType || undefined,
          status: filterStatus || undefined,
          limit: 200,
        },
        signal,
      ),
    [token, filterType, filterStatus],
  )
  const { data, status } = useApi(fetcher)

  const assets = data ?? []

  const kpis = useMemo(() => {
    const total = assets.length
    const active = assets.filter((a) => a.status === "ACTIVE").length
    const inRepair = assets.filter((a) => a.status === "IN_REPAIR").length
    const totalValue = assets.reduce((sum, a) => sum + (a.purchase_cost ?? 0), 0)
    return { total, active, inRepair, totalValue }
  }, [assets])

  const handleRowClick = (row: AssetRead) => {
    setSelectedAsset((prev) => (prev?.id === row.id ? null : row))
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <section className="surface-card">
        <div className="panel-header p-5 md:p-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-6 w-6 text-[hsl(var(--primary))]" aria-hidden="true" />
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Gestión de Equipos
                </h1>
                <p className="text-sm text-muted-foreground">
                  Activos físicos registrados, componentes e historial
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Equipos"
          value={formatNumber(kpis.total)}
          description="Equipos registrados en el sistema"
          icon={BoxesIcon}
          tone="blue"
        />
        <KpiCard
          title="Activos"
          value={formatNumber(kpis.active)}
          description="En operación actualmente"
          icon={Laptop}
          tone="green"
          badge={
            kpis.total > 0
              ? { label: `${Math.round((kpis.active / kpis.total) * 100)}%`, variant: "info" }
              : undefined
          }
        />
        <KpiCard
          title="En Reparación"
          value={formatNumber(kpis.inRepair)}
          description="Equipos con mantenimiento en curso"
          icon={Wrench}
          tone="orange"
          badge={
            kpis.inRepair > 0
              ? { label: "Atención", variant: "warning" }
              : undefined
          }
        />
        <KpiCard
          title="Valor Total"
          value={formatCurrencyMXN(kpis.totalValue)}
          description="Costo de adquisición acumulado"
          icon={TrendingUp}
          tone="neutral"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value)
            setSelectedAsset(null)
          }}
        >
          <option value="">Todos los tipos</option>
          {ASSET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <select
          className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value)
            setSelectedAsset(null)
          }}
        >
          <option value="">Todos los estados</option>
          {ASSET_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {selectedAsset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedAsset(null)}
          >
            Cerrar detalle
          </Button>
        )}
      </div>

      {/* Assets table */}
      <DataTable
        columns={ASSET_COLS}
        rows={assets}
        rowKey={(r) => r.id}
        maxHeight="calc(100vh - 480px)"
        emptyLabel={
          status === "loading"
            ? "Cargando…"
            : status === "error"
              ? "Error al cargar equipos"
              : "Sin equipos registrados"
        }
        onRowClick={handleRowClick}
        selectedRowKey={selectedAsset?.id}
      />

      {/* Selected asset detail */}
      {selectedAsset && <AssetDetailPanel key={selectedAsset.id} asset={selectedAsset} />}
    </div>
  )
}
