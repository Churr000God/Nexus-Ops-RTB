import { useCallback, useState } from "react"
import { BookOpen, CheckCircle2, CreditCard, FileSearch, Hash, RefreshCw, Tag, Users, XCircle } from "lucide-react"
import { toast } from "sonner"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useApi } from "@/hooks/useApi"
import { usePermission } from "@/hooks/usePermission"
import { clientesProveedoresService } from "@/services/clientesProveedoresService"
import { getSatPaymentForms, getSatPaymentMethods } from "@/services/comprasService"
import { useAuthStore } from "@/stores/authStore"
import type { SATCfdiUse, SATProductKey, SATTaxRegime, SATUnitKey } from "@/types/clientesProveedores"
import type { SatPaymentForm, SatPaymentMethod } from "@/types/compras"
import { cn } from "@/lib/utils"
import { requestJson } from "@/lib/http"

// ── Tipos sync ────────────────────────────────────────────────────────────────

interface CatalogResultOut {
  catalog: string
  rows_processed: number
  rows_upserted: number
  error: string | null
}

interface SatSyncResponse {
  success: boolean
  results: CatalogResultOut[]
}

interface SatSyncRequest {
  include_product_keys: boolean
  include_unit_keys: boolean
  sat_url: string
}

const SAT_DEFAULT_URL =
  "http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/catCFDI.xls"

const CATALOG_LABELS: Record<string, string> = {
  sat_payment_forms:   "Formas de Pago",
  sat_payment_methods: "Métodos de Pago",
  sat_tax_regimes:     "Regímenes Fiscales",
  sat_cfdi_uses:       "Usos CFDI",
  sat_unit_keys:       "Claves Unidad",
  sat_product_keys:    "Claves Producto/Servicio",
}

// ── Helpers visuales ──────────────────────────────────────────────────────────

function AppliesToBadge({ value }: { value: string }) {
  const color =
    value === "MORAL"
      ? "border-blue-500/40 bg-blue-50 text-blue-700"
      : value === "FISICA"
        ? "border-violet-500/40 bg-violet-50 text-violet-700"
        : "border-slate-400/40 bg-slate-50 text-slate-600"
  const label = value === "MORAL" ? "Moral" : value === "FISICA" ? "Física" : "Ambas"
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", color)}>
      {label}
    </span>
  )
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        active
          ? "border-emerald-500/40 bg-emerald-50 text-emerald-700"
          : "border-slate-400/40 bg-slate-100 text-slate-500",
      )}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  )
}

// ── Columnas de tablas ────────────────────────────────────────────────────────

const PRODUCT_KEY_COLS: DataTableColumn<SATProductKey>[] = [
  { key: "code",        header: "Clave",       className: "font-mono w-28",   cell: (r) => r.code },
  { key: "description", header: "Descripción",                                cell: (r) => r.description },
  { key: "is_active",   header: "Estatus",     className: "w-24 text-center", cell: (r) => <ActiveBadge active={r.is_active} /> },
]

const UNIT_KEY_COLS: DataTableColumn<SATUnitKey>[] = [
  { key: "code",        header: "Clave",       className: "font-mono w-24",   cell: (r) => r.code },
  { key: "description", header: "Descripción",                                cell: (r) => r.description },
  { key: "is_active",   header: "Estatus",     className: "w-24 text-center", cell: (r) => <ActiveBadge active={r.is_active} /> },
]

const REGIME_COLS: DataTableColumn<SATTaxRegime>[] = [
  { key: "code",        header: "Código",      className: "font-mono w-20",   cell: (r) => r.code },
  { key: "description", header: "Descripción",                                cell: (r) => r.description },
  { key: "applies_to",  header: "Aplica a",    className: "w-28 text-center", cell: (r) => <AppliesToBadge value={r.applies_to} /> },
]

const CFDI_USE_COLS: DataTableColumn<SATCfdiUse>[] = [
  { key: "use_id",      header: "Clave",       className: "font-mono w-20",   cell: (r) => r.use_id },
  { key: "description", header: "Descripción",                                cell: (r) => r.description },
  { key: "applies_to",  header: "Aplica a",    className: "w-28 text-center", cell: (r) => <AppliesToBadge value={r.applies_to} /> },
]

const PAYMENT_FORM_COLS: DataTableColumn<SatPaymentForm>[] = [
  { key: "form_id",     header: "Clave",       className: "font-mono w-16",   cell: (r) => r.form_id },
  { key: "description", header: "Descripción",                                cell: (r) => r.description },
  { key: "is_active",   header: "Estatus",     className: "w-24 text-center", cell: (r) => <ActiveBadge active={r.is_active} /> },
]

const PAYMENT_METHOD_COLS: DataTableColumn<SatPaymentMethod>[] = [
  { key: "method_id",   header: "Clave",       className: "font-mono w-16",   cell: (r) => r.method_id },
  { key: "description", header: "Descripción",                                cell: (r) => r.description },
  {
    key: "is_credit",
    header: "Tipo",
    className: "w-36 text-center",
    cell: (r) => (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
          r.is_credit
            ? "border-amber-500/40 bg-amber-50 text-amber-700"
            : "border-emerald-500/40 bg-emerald-50 text-emerald-700",
        )}
      >
        {r.is_credit ? "Crédito (PPD)" : "Contado (PUE)"}
      </span>
    ),
  },
  { key: "is_active",   header: "Estatus",     className: "w-24 text-center", cell: (r) => <ActiveBadge active={r.is_active} /> },
]

// ── Tabs ──────────────────────────────────────────────────────────────────────

function ClavesProductoTab({ triggerRefetch }: { triggerRefetch: number }) {
  const token = useAuthStore((s) => s.accessToken)
  const [query, setQuery] = useState("")

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      clientesProveedoresService.searchSatProductKeys(token, query, 100, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, query, triggerRefetch],
  )
  const { data, status } = useApi(fetcher)

  return (
    <DataTable
      columns={PRODUCT_KEY_COLS}
      rows={data ?? []}
      rowKey={(r) => r.id}
      emptyLabel={
        status === "loading"
          ? "Buscando…"
          : status === "error"
            ? "Error al cargar catálogo"
            : query
              ? "Sin resultados para esa búsqueda"
              : "Escribe para buscar claves de producto"
      }
      toolbar={
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Buscar por clave o descripción…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
          />
          {data && (
            <span className="text-xs text-muted-foreground">
              {data.length === 100
                ? "Mostrando primeros 100 — refina la búsqueda"
                : `${data.length} resultado${data.length !== 1 ? "s" : ""}`}
            </span>
          )}
        </div>
      }
      maxHeight="520px"
    />
  )
}

function ClavesUnidadTab({ triggerRefetch }: { triggerRefetch: number }) {
  const token = useAuthStore((s) => s.accessToken)
  const [query, setQuery] = useState("")

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      clientesProveedoresService.searchSatUnitKeys(token, query, 100, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, query, triggerRefetch],
  )
  const { data, status } = useApi(fetcher)

  return (
    <DataTable
      columns={UNIT_KEY_COLS}
      rows={data ?? []}
      rowKey={(r) => r.id}
      emptyLabel={
        status === "loading"
          ? "Buscando…"
          : status === "error"
            ? "Error al cargar catálogo"
            : query
              ? "Sin resultados para esa búsqueda"
              : "Escribe para buscar claves de unidad"
      }
      toolbar={
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Buscar por clave o descripción…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
          />
          {data && (
            <span className="text-xs text-muted-foreground">
              {data.length === 100
                ? "Mostrando primeros 100 — refina la búsqueda"
                : `${data.length} resultado${data.length !== 1 ? "s" : ""}`}
            </span>
          )}
        </div>
      }
      maxHeight="520px"
    />
  )
}

function RegimenesFiscalesTab({ triggerRefetch }: { triggerRefetch: number }) {
  const token = useAuthStore((s) => s.accessToken)
  const fetcher = useCallback(
    (signal: AbortSignal) => clientesProveedoresService.listRegimenesFiscales(token, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, triggerRefetch],
  )
  const { data, status } = useApi<SATTaxRegime[]>(fetcher)
  return (
    <DataTable
      columns={REGIME_COLS}
      rows={data ?? []}
      rowKey={(r) => String(r.regime_id)}
      emptyLabel={status === "loading" ? "Cargando…" : status === "error" ? "Error al cargar" : "Sin registros"}
    />
  )
}

function UsosCfdiTab({ triggerRefetch }: { triggerRefetch: number }) {
  const token = useAuthStore((s) => s.accessToken)
  const fetcher = useCallback(
    (signal: AbortSignal) => clientesProveedoresService.listUsosCfdi(token, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, triggerRefetch],
  )
  const { data, status } = useApi<SATCfdiUse[]>(fetcher)
  return (
    <DataTable
      columns={CFDI_USE_COLS}
      rows={data ?? []}
      rowKey={(r) => r.use_id}
      emptyLabel={status === "loading" ? "Cargando…" : status === "error" ? "Error al cargar" : "Sin registros"}
    />
  )
}

function FormasPagoTab({ triggerRefetch }: { triggerRefetch: number }) {
  const token = useAuthStore((s) => s.accessToken)
  const fetcher = useCallback(
    (signal: AbortSignal) => getSatPaymentForms(token, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, triggerRefetch],
  )
  const { data, status } = useApi<SatPaymentForm[]>(fetcher)
  return (
    <DataTable
      columns={PAYMENT_FORM_COLS}
      rows={data ?? []}
      rowKey={(r) => r.form_id}
      emptyLabel={status === "loading" ? "Cargando…" : status === "error" ? "Error al cargar" : "Sin registros"}
    />
  )
}

function MetodosPagoTab({ triggerRefetch }: { triggerRefetch: number }) {
  const token = useAuthStore((s) => s.accessToken)
  const fetcher = useCallback(
    (signal: AbortSignal) => getSatPaymentMethods(token, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, triggerRefetch],
  )
  const { data, status } = useApi<SatPaymentMethod[]>(fetcher)
  return (
    <DataTable
      columns={PAYMENT_METHOD_COLS}
      rows={data ?? []}
      rowKey={(r) => r.method_id}
      emptyLabel={status === "loading" ? "Cargando…" : status === "error" ? "Error al cargar" : "Sin registros"}
    />
  )
}

// ── Panel de sincronización ───────────────────────────────────────────────────

function SyncPanel({ onSynced }: { onSynced: () => void }) {
  const token = useAuthStore((s) => s.accessToken)
  const canManage = usePermission("cfdi.config.manage")

  const [includeProductKeys, setIncludeProductKeys] = useState(true)
  const [includeUnitKeys, setIncludeUnitKeys] = useState(true)
  const [satUrl, setSatUrl] = useState(SAT_DEFAULT_URL)
  const [syncing, setSyncing] = useState(false)
  const [results, setResults] = useState<CatalogResultOut[] | null>(null)
  const [expanded, setExpanded] = useState(false)

  async function handleSync() {
    if (!canManage) return
    setSyncing(true)
    setResults(null)
    try {
      const body: SatSyncRequest = {
        include_product_keys: includeProductKeys,
        include_unit_keys: includeUnitKeys,
        sat_url: satUrl,
      }
      const resp = await requestJson<SatSyncResponse>("/api/admin/sat/sync", {
        method: "POST",
        body: body as unknown as Parameters<typeof requestJson>[1] extends { body?: infer B } ? B : never,
        token,
      })
      setResults(resp.results)
      if (resp.success) {
        toast.success("Catálogos SAT sincronizados correctamente")
        onSynced()
      } else {
        toast.error("Sincronización completada con errores — revisa los resultados")
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al sincronizar catálogos")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-soft-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Sincronizar desde SAT</span>
          <span className="text-xs text-muted-foreground">
            — actualiza los catálogos CFDI 4.0 con la fuente oficial
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          <div className="flex flex-col gap-4">
            {/* Opciones */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={includeProductKeys}
                  onChange={(e) => setIncludeProductKeys(e.target.checked)}
                  disabled={!canManage || syncing}
                  className="h-4 w-4 rounded border-border"
                />
                Incluir claves producto/servicio (~52 000 entradas)
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={includeUnitKeys}
                  onChange={(e) => setIncludeUnitKeys(e.target.checked)}
                  disabled={!canManage || syncing}
                  className="h-4 w-4 rounded border-border"
                />
                Incluir claves de unidad
              </label>
            </div>

            {/* URL */}
            {(includeProductKeys || includeUnitKeys) && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  URL del catálogo SAT (.xls / .xlsx)
                </span>
                <Input
                  value={satUrl}
                  onChange={(e) => setSatUrl(e.target.value)}
                  disabled={!canManage || syncing}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  URL oficial SAT: <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{SAT_DEFAULT_URL}</code>
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={handleSync}
                disabled={!canManage || syncing}
                className="gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
                {syncing ? "Sincronizando…" : "Sincronizar ahora"}
              </Button>
              {!canManage && (
                <p className="text-xs text-muted-foreground">
                  Requiere permiso{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">cfdi.config.manage</code>
                </p>
              )}
            </div>

            {/* Resultados */}
            {results && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Resultado del último sync
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {results.map((r) => (
                    <div
                      key={r.catalog}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border px-3 py-2.5",
                        r.error
                          ? "border-red-400/40 bg-red-50"
                          : "border-emerald-400/40 bg-emerald-50",
                      )}
                    >
                      {r.error ? (
                        <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">
                          {CATALOG_LABELS[r.catalog] ?? r.catalog}
                        </p>
                        {r.error ? (
                          <p className="mt-0.5 truncate text-[11px] text-red-600" title={r.error}>
                            {r.error}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {r.rows_upserted} filas actualizadas
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type SatTab = "clave-producto" | "clave-unidad" | "regimen" | "uso-cfdi" | "forma-pago" | "metodo-pago"

const TABS: { id: SatTab; label: string; icon: React.ElementType }[] = [
  { id: "clave-producto", label: "Claves Producto",    icon: Tag },
  { id: "clave-unidad",   label: "Claves Unidad",      icon: Hash },
  { id: "regimen",        label: "Regímenes Fiscales", icon: Users },
  { id: "uso-cfdi",       label: "Usos CFDI",          icon: FileSearch },
  { id: "forma-pago",     label: "Formas de Pago",     icon: CreditCard },
  { id: "metodo-pago",    label: "Métodos de Pago",    icon: BookOpen },
]

export function SatPage() {
  const [tab, setTab] = useState<SatTab>("clave-producto")
  const [refetchKey, setRefetchKey] = useState(0)

  function onSynced() {
    setRefetchKey((k) => k + 1)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Catálogos SAT</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Claves producto/servicio · unidades · régimen fiscal · uso CFDI · formas y métodos de pago
        </p>
      </div>

      <SyncPanel onSynced={onSynced} />

      <div className="flex flex-wrap gap-0 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "clave-producto" && <ClavesProductoTab triggerRefetch={refetchKey} />}
      {tab === "clave-unidad"   && <ClavesUnidadTab   triggerRefetch={refetchKey} />}
      {tab === "regimen"        && <RegimenesFiscalesTab triggerRefetch={refetchKey} />}
      {tab === "uso-cfdi"       && <UsosCfdiTab        triggerRefetch={refetchKey} />}
      {tab === "forma-pago"     && <FormasPagoTab      triggerRefetch={refetchKey} />}
      {tab === "metodo-pago"    && <MetodosPagoTab     triggerRefetch={refetchKey} />}
    </div>
  )
}
