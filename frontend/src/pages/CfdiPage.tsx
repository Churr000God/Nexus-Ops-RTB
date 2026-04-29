import { useCallback, useState } from "react"
import { CreditCard, FileText, ScrollText, Settings } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { useApi } from "@/hooks/useApi"
import { getCfdis, getIssuerConfig, getPpdPending } from "@/services/cfdiService"
import type { CfdiListItem, CfdiIssuerConfigOut, CfdiPpdPending } from "@/types/cfdi"
import { cn } from "@/lib/utils"

// ── Constantes de visualización ──────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  DRAFT:      "border-slate-500/30 bg-slate-500/10 text-slate-400",
  ISSUED:     "border-blue-500/30 bg-blue-500/10 text-blue-400",
  TIMBRADO:   "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  PAID:       "border-teal-500/30 bg-teal-500/10 text-teal-400",
  CANCELLED:  "border-red-900/30 bg-red-900/10 text-red-600",
  SUPERSEDED: "border-slate-700/30 bg-slate-700/10 text-slate-500",
}

const TYPE_LABELS: Record<string, string> = {
  I: "Ingreso",
  E: "Egreso",
  P: "Pago",
  T: "Traslado",
}

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("es-MX") : "—")
const fmtDateTime = (d: string | null) => (d ? new Date(d).toLocaleString("es-MX") : "—")

// ── Columnas ─────────────────────────────────────────────────────────────────

const CFDI_COLUMNS: DataTableColumn<CfdiListItem>[] = [
  { key: "cfdi_number",    header: "Número",       cell: (r) => r.cfdi_number },
  {
    key: "series",
    header: "Serie-Folio",
    cell: (r) => (r.series ? `${r.series}-${r.folio ?? ""}` : "—"),
  },
  { key: "cfdi_type",      header: "Tipo",         cell: (r) => TYPE_LABELS[r.cfdi_type] ?? r.cfdi_type },
  { key: "issue_date",     header: "Fecha",        cell: (r) => fmtDate(r.issue_date) },
  { key: "receiver_name",  header: "Cliente",      cell: (r) => r.receiver_name ?? "—" },
  { key: "total",          header: "Total",        cell: (r) => fmt.format(r.total) },
  { key: "payment_method", header: "Método pago",  cell: (r) => r.payment_method ?? "—" },
  {
    key: "status",
    header: "Estatus",
    cell: (r) => (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
          STATUS_COLORS[r.status] ?? "border-slate-500/30 bg-slate-500/10 text-slate-400",
        )}
      >
        {r.status}
      </span>
    ),
  },
  {
    key: "uuid",
    header: "UUID",
    className: "font-mono text-xs",
    cell: (r) => (r.uuid ? `${r.uuid.slice(0, 8)}…` : "—"),
  },
  { key: "timbre_date",    header: "Timbrado",     cell: (r) => fmtDate(r.timbre_date) },
]

const PPD_COLUMNS: DataTableColumn<CfdiPpdPending>[] = [
  { key: "cfdi_number",      header: "CFDI",        cell: (r) => r.cfdi_number },
  {
    key: "series_code",
    header: "Serie-Folio",
    cell: (r) => (r.series_code ? `${r.series_code}-${r.folio ?? ""}` : "—"),
  },
  { key: "issue_date",       header: "Emisión",     cell: (r) => fmtDate(r.issue_date) },
  { key: "customer_name",    header: "Cliente",     cell: (r) => r.customer_name ?? "—" },
  { key: "customer_rfc",     header: "RFC",         cell: (r) => r.customer_rfc ?? "—" },
  { key: "total",            header: "Total CFDI",  cell: (r) => fmt.format(r.total) },
  { key: "paid_amount",      header: "Pagado",      cell: (r) => fmt.format(r.paid_amount) },
  {
    key: "remaining_balance",
    header: "Saldo pendiente",
    cell: (r) => (
      <span className="font-semibold text-amber-400">{fmt.format(r.remaining_balance)}</span>
    ),
  },
  { key: "days_since_issue", header: "Días",        cell: (r) => r.days_since_issue },
  {
    key: "status",
    header: "Estatus",
    cell: (r) => (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
          STATUS_COLORS[r.status] ?? "border-slate-500/30 bg-slate-500/10 text-slate-400",
        )}
      >
        {r.status}
      </span>
    ),
  },
]

// ── Sub-tabs ─────────────────────────────────────────────────────────────────

function FacturasTab() {
  const [filterStatus, setFilterStatus] = useState("")
  const [filterType, setFilterType] = useState("")

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      getCfdis(
        {
          cfdi_type: filterType || undefined,
          status: filterStatus || undefined,
        },
        signal,
      ),
    [filterStatus, filterType],
  )
  const { data, status } = useApi(fetcher)

  const timbrado = (data ?? []).filter(
    (r) => r.status === "TIMBRADO" || r.status === "PAID",
  ).length
  const draft = (data ?? []).filter((r) => r.status === "DRAFT").length
  const totalAmount = (data ?? []).reduce((s, r) => s + r.total, 0)

  return (
    <div className="flex flex-col gap-4">
      {data && data.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">Total facturado</p>
            <p className="mt-1 text-lg font-semibold text-white">{fmt.format(totalAmount)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">Timbrados / Pagados</p>
            <p className="mt-1 text-lg font-semibold text-emerald-400">{timbrado}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">Borradores</p>
            <p className="mt-1 text-lg font-semibold text-amber-400">{draft}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-md border border-white/10 bg-background px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Todos los estatus</option>
          {["DRAFT", "ISSUED", "TIMBRADO", "PAID", "CANCELLED", "SUPERSEDED"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="rounded-md border border-white/10 bg-background px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          <option value="I">I — Ingreso</option>
          <option value="E">E — Egreso</option>
          <option value="P">P — Pago</option>
          <option value="T">T — Traslado</option>
        </select>
      </div>

      <DataTable
        columns={CFDI_COLUMNS}
        rows={data ?? []}
        rowKey={(r) => r.cfdi_id}
        emptyLabel={
          status === "loading"
            ? "Cargando…"
            : status === "error"
              ? "Error al cargar facturas"
              : "Sin CFDIs registrados"
        }
      />
    </div>
  )
}

function ComplementosTab() {
  const fetcher = useCallback((signal: AbortSignal) => getPpdPending(signal), [])
  const { data, status } = useApi(fetcher)

  const totalPendiente = (data ?? []).reduce((s, r) => s + r.remaining_balance, 0)

  return (
    <div className="flex flex-col gap-4">
      {data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">CFDIs PPD pendientes</p>
            <p className="mt-1 text-lg font-semibold text-white">{data.length}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/50">Saldo total pendiente</p>
            <p className="mt-1 text-lg font-semibold text-amber-400">
              {fmt.format(totalPendiente)}
            </p>
          </div>
        </div>
      )}

      <DataTable
        columns={PPD_COLUMNS}
        rows={data ?? []}
        rowKey={(r) => r.cfdi_id}
        emptyLabel={
          status === "loading"
            ? "Cargando…"
            : status === "error"
              ? "Error al cargar complementos"
              : "Sin CFDIs PPD pendientes de pago"
        }
      />
    </div>
  )
}

function NotasCreditoTab() {
  const fetcher = useCallback(
    (signal: AbortSignal) => getCfdis({ cfdi_type: "E" }, signal),
    [],
  )
  const { data, status } = useApi(fetcher)

  return (
    <DataTable
      columns={CFDI_COLUMNS}
      rows={data ?? []}
      rowKey={(r) => r.cfdi_id}
      emptyLabel={
        status === "loading"
          ? "Cargando…"
          : status === "error"
            ? "Error al cargar notas de crédito"
            : "Sin notas de crédito registradas"
      }
    />
  )
}

function ConfigTab() {
  const fetcher = useCallback((signal: AbortSignal) => getIssuerConfig(signal), [])
  const { data, status } = useApi<CfdiIssuerConfigOut | null>(fetcher)

  if (status === "loading") {
    return <p className="text-sm text-white/50">Cargando configuración…</p>
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
        No hay configuración de emisor registrada.
      </div>
    )
  }

  const rows: [string, string][] = [
    ["RFC", data.rfc],
    ["Razón Social", data.legal_name],
    ["Código Postal", data.zip_code],
    ["Proveedor PAC", data.pac_provider ?? "No configurado"],
    ["Entorno PAC", data.pac_environment],
    ["N.º Serie CSD", data.csd_serial_number ?? "—"],
    ["CSD válido desde", fmtDate(data.csd_valid_from)],
    ["CSD válido hasta", fmtDate(data.csd_valid_to)],
    ["Activo", data.is_active ? "Sí" : "No"],
    ["Última actualización", fmtDateTime(data.updated_at)],
  ]

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
              {label}
            </span>
            <span className="text-sm text-white">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

type CfdiTab = "facturas" | "complementos" | "notas" | "config"

const TABS: { id: CfdiTab; label: string; icon: React.ElementType }[] = [
  { id: "facturas",     label: "Facturas",             icon: FileText },
  { id: "complementos", label: "Complementos de Pago", icon: CreditCard },
  { id: "notas",        label: "Notas de Crédito",     icon: ScrollText },
  { id: "config",       label: "Configuración",        icon: Settings },
]

export default function CfdiPage() {
  const [tab, setTab] = useState<CfdiTab>("facturas")

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-[hsl(var(--primary))]" />
        <h1 className="text-xl font-semibold text-white">CFDI 4.0</h1>
      </div>

      <div className="flex gap-1 border-b border-white/10">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === id
                ? "border-[hsl(var(--primary))] text-white"
                : "border-transparent text-white/50 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "facturas"     && <FacturasTab />}
      {tab === "complementos" && <ComplementosTab />}
      {tab === "notas"        && <NotasCreditoTab />}
      {tab === "config"       && <ConfigTab />}
    </div>
  )
}
