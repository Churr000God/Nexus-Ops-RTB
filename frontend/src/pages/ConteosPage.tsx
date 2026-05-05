import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Package,
  Plus,
  RefreshCw,
  Search,
  Wrench,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { CreateCountModal } from "@/components/assets/CreateCountModal"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/useApi"
import { assetsService } from "@/services/assetsService"
import { useAuthStore } from "@/stores/authStore"
import { cn } from "@/lib/utils"
import type {
  PhysicalCountLineRead,
  PhysicalCountRead,
  ProductCountLineRead,
} from "@/types/assets"

// ── helpers ──────────────────────────────────────────────────────────────────

const fmtQty = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(n)

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-MX")

const fmtTs = (ts: string | null) =>
  ts ? new Date(ts).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : null

// ── badges ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
}
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  CONFIRMED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  CANCELLED: "border-slate-500/30 bg-slate-500/10 text-slate-500",
}
function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STATUS_COLORS[status] ?? STATUS_COLORS.CANCELLED,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ── diff badge for product lines ──────────────────────────────────────────────

function DiffBadge({ real, counted }: { real: number; counted: number | null }) {
  if (counted == null) return <span className="text-muted-foreground">—</span>
  const diff = counted - real
  if (Math.abs(diff) < 0.001)
    return <span className="text-emerald-600 font-medium">0</span>
  const cls = diff > 0 ? "text-blue-500" : "text-red-500"
  return (
    <span className={cn("font-medium", cls)}>
      {diff > 0 ? "+" : ""}
      {fmtQty(diff)}
    </span>
  )
}

// ── list columns ──────────────────────────────────────────────────────────────

const countColumns: DataTableColumn<PhysicalCountRead>[] = [
  {
    key: "count_type",
    header: "Tipo",
    cell: (r) =>
      r.count_type === "PRODUCT" ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-violet-600">
          <Package className="h-3 w-3" />
          Productos
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[11px] text-blue-600">
          <Wrench className="h-3 w-3" />
          Activos
        </span>
      ),
  },
  {
    key: "count_date",
    header: "Fecha",
    cell: (r) => fmtDate(r.count_date),
  },
  {
    key: "status",
    header: "Estado",
    cell: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: "location_filter",
    header: "Ubicación",
    cell: (r) =>
      r.location_filter ?? <span className="text-muted-foreground italic">Todos</span>,
  },
  {
    key: "total_lines",
    header: "Total",
    cell: (r) => String(r.total_lines),
  },
  {
    key: "progress",
    header: "Progreso",
    cell: (r) => {
      if (r.count_type === "PRODUCT") {
        return (
          <span className="text-xs">
            <span className="text-emerald-600">{r.counted_lines} contados</span>
            {r.discrepancy_lines > 0 && (
              <span className="ml-2 text-red-500">{r.discrepancy_lines} dif.</span>
            )}
            {r.uncounted_lines > 0 && (
              <span className="ml-2 text-amber-600">{r.uncounted_lines} pend.</span>
            )}
          </span>
        )
      }
      return (
        <span className="text-xs">
          <span className="text-emerald-600">{r.found_count} ✓</span>
          {r.not_found_count > 0 && (
            <span className="ml-2 text-red-500">{r.not_found_count} ✗</span>
          )}
          {r.pending_count > 0 && (
            <span className="ml-2 text-amber-600">{r.pending_count} pend.</span>
          )}
        </span>
      )
    },
  },
]

// ── asset line columns ────────────────────────────────────────────────────────

function buildAssetLineColumns(
  selectedCount: PhysicalCountRead,
  onToggle: (line: PhysicalCountLineRead, found: boolean) => void,
): DataTableColumn<PhysicalCountLineRead>[] {
  const isDraft = selectedCount.status === "DRAFT"
  return [
    {
      key: "found",
      header: "",
      cell: (r) => {
        if (!isDraft) {
          return r.found === true ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : r.found === false ? (
            <span className="text-xs font-medium text-red-500">✗</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        }
        return (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle(r, true) }}
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px] font-medium border transition-colors",
                r.found === true
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600"
                  : "border-border text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-600",
              )}
            >✓</button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle(r, false) }}
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px] font-medium border transition-colors",
                r.found === false
                  ? "border-red-500/40 bg-red-500/10 text-red-500"
                  : "border-border text-muted-foreground hover:border-red-500/40 hover:text-red-500",
              )}
            >✗</button>
          </div>
        )
      },
    },
    {
      key: "asset_code",
      header: "Código",
      cell: (r) => <span className="font-mono text-xs">{r.asset_code}</span>,
    },
    { key: "asset_name", header: "Activo", cell: (r) => r.asset_name },
    { key: "expected_location", header: "Ubic. esperada", cell: (r) => r.expected_location ?? "—" },
    { key: "scanned_location", header: "Ubic. hallada", cell: (r) => r.scanned_location ?? "—" },
    {
      key: "updated_by",
      header: "Actualizado por",
      cell: (r) =>
        r.updated_by_email ? (
          <span className="text-xs text-muted-foreground">
            {r.updated_by_email.split("@")[0]}
            {r.updated_at && (
              <span className="ml-1 opacity-60">{fmtTs(r.updated_at)}</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: "notes", header: "Notas", cell: (r) => r.notes ?? "—" },
  ]
}

// ── product line columns ──────────────────────────────────────────────────────

function buildProductLineColumns(
  selectedCount: PhysicalCountRead,
  onCountedQty: (line: ProductCountLineRead, qty: number | null) => void,
): DataTableColumn<ProductCountLineRead>[] {
  const isDraft = selectedCount.status === "DRAFT"
  return [
    {
      key: "sku",
      header: "SKU",
      cell: (r) => (
        <span className="font-mono text-xs text-muted-foreground">{r.sku ?? "—"}</span>
      ),
    },
    { key: "product_name", header: "Producto", cell: (r) => r.product_name },
    {
      key: "is_saleable",
      header: "Tipo",
      cell: (r) =>
        r.is_saleable ? (
          <span className="text-[10px] font-medium text-emerald-600">Vendible</span>
        ) : (
          <span className="text-[10px] font-medium text-violet-600">Interno</span>
        ),
    },
    { key: "category", header: "Categoría", cell: (r) => r.category ?? "—" },
    {
      key: "theoretical_qty",
      header: "Stock Teórico",
      cell: (r) => <span className="text-violet-600">{fmtQty(r.theoretical_qty)}</span>,
    },
    {
      key: "real_qty",
      header: "Stock Real",
      cell: (r) => <span className="text-blue-600 font-medium">{fmtQty(r.real_qty)}</span>,
    },
    {
      key: "counted_qty",
      header: "Cant. Contada",
      cell: (r) => {
        if (!isDraft) {
          return r.counted_qty == null ? (
            <span className="text-xs font-medium text-muted-foreground/60 italic">N/A</span>
          ) : (
            <span className="font-medium">{fmtQty(r.counted_qty)}</span>
          )
        }
        return (
          <CountedQtyInput
            value={r.counted_qty}
            onChange={(v) => onCountedQty(r, v)}
          />
        )
      },
    },
    {
      key: "diff",
      header: "Diferencia",
      cell: (r) => {
        if (r.counted_qty == null)
          return <span className="text-xs font-medium text-muted-foreground/60 italic">N/A</span>
        return <DiffBadge real={r.real_qty} counted={r.counted_qty} />
      },
    },
    {
      key: "updated_by",
      header: "Contado por",
      cell: (r) =>
        r.updated_by_email ? (
          <span className="text-xs text-muted-foreground">
            {r.updated_by_email.split("@")[0]}
            {r.updated_at && (
              <span className="ml-1 opacity-60">{fmtTs(r.updated_at)}</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ]
}

// ── inline counted-qty input ──────────────────────────────────────────────────

function CountedQtyInput({
  value,
  onChange,
}: {
  value: number | null
  onChange: (v: number | null) => void
}) {
  const [local, setLocal] = useState(value == null ? "" : String(value))

  useEffect(() => {
    setLocal(value == null ? "" : String(value))
  }, [value])

  function commit() {
    const parsed = local.trim() === "" ? null : Number(local)
    if (local.trim() !== "" && isNaN(parsed as number)) {
      setLocal(value == null ? "" : String(value))
      return
    }
    onChange(parsed)
  }

  return (
    <input
      type="number"
      step="any"
      min="0"
      className="h-7 w-24 rounded border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      placeholder="—"
    />
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function ConteosPage() {
  const token = useAuthStore((s) => s.accessToken)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedCount, setSelectedCount] = useState<PhysicalCountRead | null>(null)
  const [countsKey, setCountsKey] = useState(0)
  const [linesKey, setLinesKey] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [confirmWarning, setConfirmWarning] = useState(false)

  // product line filters
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [saleableFilter, setSaleableFilter] = useState<"" | "true" | "false">("")

  // auto-refresh when DRAFT
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (selectedCount?.status === "DRAFT") {
      refreshRef.current = setInterval(() => setLinesKey((k) => k + 1), 10_000)
    }
    return () => { if (refreshRef.current) clearInterval(refreshRef.current) }
  }, [selectedCount?.id, selectedCount?.status])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const countsFetcher = useCallback(
    (signal: AbortSignal) => assetsService.listCounts(token, {}, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, countsKey],
  )
  const { data: counts, status: countsStatus } = useApi(countsFetcher)

  // asset lines
  const assetLinesFetcher = useCallback(
    (signal: AbortSignal) =>
      selectedCount && selectedCount.count_type === "ASSET"
        ? assetsService.getCountLines(token, selectedCount.id, signal)
        : Promise.resolve([] as PhysicalCountLineRead[]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, selectedCount?.id, selectedCount?.count_type, linesKey],
  )
  const { data: assetLines, status: assetLinesStatus } = useApi(assetLinesFetcher)

  // product lines
  const productLinesFetcher = useCallback(
    (signal: AbortSignal) =>
      selectedCount && selectedCount.count_type === "PRODUCT"
        ? assetsService.getProductCountLines(
            token,
            selectedCount.id,
            {
              search: debouncedSearch || undefined,
              is_saleable: saleableFilter === "" ? undefined : saleableFilter === "true",
            },
            signal,
          )
        : Promise.resolve([] as ProductCountLineRead[]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, selectedCount?.id, selectedCount?.count_type, linesKey, debouncedSearch, saleableFilter],
  )
  const { data: productLines, status: productLinesStatus } = useApi(productLinesFetcher)

  function refreshCounts() { setCountsKey((k) => k + 1) }
  function refreshLines() { setLinesKey((k) => k + 1) }

  async function toggleFound(line: PhysicalCountLineRead, found: boolean) {
    if (!selectedCount || selectedCount.status !== "DRAFT") return
    try {
      await assetsService.updateCountLine(token, selectedCount.id, line.id, { found })
      refreshLines()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar línea")
    }
  }

  async function handleCountedQty(line: ProductCountLineRead, qty: number | null) {
    if (!selectedCount || selectedCount.status !== "DRAFT") return
    try {
      await assetsService.updateProductCountLine(token, selectedCount.id, line.id, {
        counted_qty: qty,
      })
      refreshLines()
      refreshCounts()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar cantidad")
    }
  }

  async function handleConfirm(force = false) {
    if (!selectedCount) return
    // Para conteos de producto: advertir si hay líneas sin contar
    if (!force && selectedCount.count_type === "PRODUCT" && selectedCount.uncounted_lines > 0) {
      setConfirmWarning(true)
      return
    }
    setConfirmWarning(false)
    setConfirming(true)
    try {
      const updated = await assetsService.confirmCount(token, selectedCount.id)
      toast.success("Conteo confirmado")
      setSelectedCount(updated)
      refreshCounts()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar conteo")
    } finally {
      setConfirming(false)
    }
  }

  // ── detail view ──────────────────────────────────────────────────────────

  if (selectedCount) {
    const isDraft = selectedCount.status === "DRAFT"
    const isProduct = selectedCount.count_type === "PRODUCT"

    const statsBar = isProduct ? (
      <p className="text-xs text-muted-foreground">
        {selectedCount.total_lines} productos ·{" "}
        <span className="text-emerald-600">{selectedCount.counted_lines} contados</span>
        {selectedCount.discrepancy_lines > 0 && (
          <> · <span className="text-red-500">{selectedCount.discrepancy_lines} con diferencia</span></>
        )}
        {selectedCount.uncounted_lines > 0 && (
          <> · <span className="text-amber-600">{selectedCount.uncounted_lines} pendientes</span></>
        )}
      </p>
    ) : (
      <p className="text-xs text-muted-foreground">
        {selectedCount.total_lines} activos ·{" "}
        <span className="text-emerald-600">{selectedCount.found_count} encontrados</span>
        {selectedCount.not_found_count > 0 && (
          <> · <span className="text-red-500">{selectedCount.not_found_count} no hallados</span></>
        )}
        {selectedCount.pending_count > 0 && (
          <> · <span className="text-amber-600">{selectedCount.pending_count} pendientes</span></>
        )}
      </p>
    )

    return (
      <div className="flex h-full flex-col gap-4 p-6">
        {/* header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedCount(null)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Conteos
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-foreground">
                Conteo {fmtDate(selectedCount.count_date)}
              </h1>
              <StatusBadge status={selectedCount.status} />
              {isProduct ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-600">
                  <Package className="h-3 w-3" />Productos
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600">
                  <Wrench className="h-3 w-3" />Activos
                </span>
              )}
            </div>
            {statsBar}
          </div>

          {isDraft && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshLines}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Actualizar (auto-refresca cada 10 s)"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Actualizar
                </button>
                <Button
                  onClick={() => void handleConfirm()}
                  disabled={confirming}
                  variant={confirmWarning ? "destructive" : "default"}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {confirming ? "Confirmando…" : "Confirmar Conteo"}
                </Button>
              </div>

              {confirmWarning && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 max-w-sm">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">
                      {selectedCount.uncounted_lines} producto{selectedCount.uncounted_lines !== 1 ? "s" : ""} sin cantidad contada
                    </p>
                    <p className="opacity-80">Aparecerán como N/A en el reporte. ¿Confirmar de todas formas?</p>
                    <div className="mt-1.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleConfirm(true)}
                        className="rounded px-2 py-0.5 text-[11px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 transition-colors"
                      >
                        Sí, confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmWarning(false)}
                        className="rounded px-2 py-0.5 text-[11px] font-semibold hover:bg-amber-500/10 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* product filter bar */}
        {isProduct && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por SKU o nombre…"
                className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-7 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <select
              className="h-8 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={saleableFilter}
              onChange={(e) => setSaleableFilter(e.target.value as "" | "true" | "false")}
            >
              <option value="">Vendible + Interno</option>
              <option value="true">Solo Vendibles</option>
              <option value="false">Solo Internos</option>
            </select>
            {isDraft && (
              <p className="text-[10px] text-muted-foreground">
                Auto-refresca cada 10 s · editable por múltiples usuarios simultáneamente
              </p>
            )}
          </div>
        )}

        {/* lines table */}
        <div className="surface-card flex-1 overflow-hidden">
          {isProduct ? (
            <DataTable
              columns={buildProductLineColumns(selectedCount, handleCountedQty)}
              rows={productLines ?? []}
              rowKey={(r) => r.id}
              maxHeight="calc(100vh - 280px)"
              emptyLabel={
                productLinesStatus === "loading" || productLinesStatus === "idle"
                  ? "Cargando…"
                  : "Sin productos en este conteo"
              }
            />
          ) : (
            <DataTable
              columns={buildAssetLineColumns(selectedCount, toggleFound)}
              rows={assetLines ?? []}
              rowKey={(r) => r.id}
              maxHeight="calc(100vh - 260px)"
              emptyLabel={
                assetLinesStatus === "loading" || assetLinesStatus === "idle"
                  ? "Cargando…"
                  : "Sin líneas en este conteo"
              }
            />
          )}
        </div>
      </div>
    )
  }

  // ── list view ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h1 className="text-lg font-semibold text-foreground">Conteos Físicos</h1>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Nuevo Conteo
        </Button>
      </div>

      {counts && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total conteos", value: counts.length },
            { label: "En borrador", value: counts.filter((c) => c.status === "DRAFT").length },
            { label: "Confirmados", value: counts.filter((c) => c.status === "CONFIRMED").length },
          ].map((kpi) => (
            <div key={kpi.label} className="surface-card px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {kpi.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="surface-card flex-1 overflow-hidden">
        <DataTable
          columns={countColumns}
          rows={counts ?? []}
          rowKey={(r) => r.id}
          onRowClick={(r) => {
            setSearch("")
            setDebouncedSearch("")
            setSaleableFilter("")
            setConfirmWarning(false)
            setSelectedCount(r)
          }}
          emptyLabel={
            countsStatus === "loading" || countsStatus === "idle"
              ? "Cargando…"
              : "Sin conteos registrados"
          }
        />
      </div>

      <CreateCountModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={(count) => {
          refreshCounts()
          setSearch("")
          setDebouncedSearch("")
          setSaleableFilter("")
          setSelectedCount(count)
        }}
      />
    </div>
  )
}
