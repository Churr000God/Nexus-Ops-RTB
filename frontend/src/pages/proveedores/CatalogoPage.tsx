import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Link2,
  Link2Off,
  List,
  Package,
  Search,
  Star,
  Store,
} from "lucide-react"
import { useAuthStore } from "@/stores/authStore"
import { clientesProveedoresService } from "@/services/clientesProveedoresService"
import type { CatalogoItem, SupplierRead } from "@/types/clientesProveedores"
import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { EmptyState } from "@/components/common/EmptyState"
import { KpiCard } from "@/components/common/KpiCard"
import { ViewToggle } from "@/components/common/ViewToggle"
import { cn } from "@/lib/utils"

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(val: string | number | null | undefined, decimals = 2): string {
  if (val == null || val === "") return "—"
  const n = typeof val === "string" ? parseFloat(val) : val
  if (isNaN(n)) return "—"
  return n.toLocaleString("es-MX", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function CostBadge({ cost, currency }: { cost: string; currency: string }) {
  const n = parseFloat(cost)
  if (isNaN(n) || n === 0)
    return <span className="text-xs text-muted-foreground">Sin costo</span>
  return (
    <span className="font-mono text-sm text-foreground">
      {currency} {fmt(cost)}
    </span>
  )
}

function LinkedBadge({ linked }: { linked: boolean }) {
  return linked ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
      <Link2 className="h-2.5 w-2.5" /> Vinculado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Link2Off className="h-2.5 w-2.5" /> Sin vincular
    </span>
  )
}

function AvailableBadge({ available }: { available: boolean }) {
  return available ? (
    <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400">
      Disponible
    </span>
  ) : (
    <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
      No disponible
    </span>
  )
}

// ── columnas lista ───────────────────────────────────────────────────────────

const columns: DataTableColumn<CatalogoItem>[] = [
  {
    key: "producto",
    header: "Producto",
    cell: (row) => (
      <div className="min-w-0">
        {row.product_name ? (
          <>
            <p className="truncate text-sm font-medium">{row.product_name}</p>
            {row.product_sku && (
              <p className="font-mono text-[11px] text-muted-foreground">{row.product_sku}</p>
            )}
          </>
        ) : (
          <p className="text-sm italic text-muted-foreground">Sin producto asignado</p>
        )}
      </div>
    ),
  },
  {
    key: "proveedor",
    header: "Proveedor",
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate text-sm">{row.supplier_name}</p>
        <p className="font-mono text-[11px] text-muted-foreground">{row.supplier_code}</p>
      </div>
    ),
  },
  {
    key: "supplier_sku",
    header: "SKU Proveedor",
    cell: (row) =>
      row.supplier_sku ? (
        <span className="font-mono text-xs">{row.supplier_sku}</span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    key: "unit_cost",
    header: "Costo unitario",
    cell: (row) => <CostBadge cost={row.unit_cost} currency={row.currency} />,
  },
  {
    key: "lead_time",
    header: "Lead time",
    cell: (row) =>
      row.lead_time_days != null ? (
        <span className="text-sm">{row.lead_time_days}d</span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    key: "moq",
    header: "MOQ",
    cell: (row) =>
      row.moq != null && parseFloat(row.moq) > 0 ? (
        <span className="text-sm">{fmt(row.moq, 0)}</span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    key: "preferido",
    header: "",
    cell: (row) =>
      row.is_preferred ? (
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      ) : null,
  },
  {
    key: "disponible",
    header: "Disponible",
    cell: (row) => <AvailableBadge available={row.is_available} />,
  },
  {
    key: "vinculado",
    header: "Estado",
    cell: (row) => <LinkedBadge linked={row.product_id != null} />,
  },
]

// ── vista comparativa por producto ───────────────────────────────────────────

function ProductoComparativaCard({
  productKey,
  productName,
  productSku,
  items,
}: {
  productKey: string
  productName: string | null
  productSku: string | null
  items: CatalogoItem[]
}) {
  const minCost = useMemo(() => {
    const costs = items
      .map((i) => parseFloat(i.unit_cost))
      .filter((n) => !isNaN(n) && n > 0)
    return costs.length > 0 ? Math.min(...costs) : null
  }, [items])

  return (
    <div className="surface-card border-white/70">
      {/* Header del producto */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{productName || productKey}</h3>
        </div>
        {productSku && (
          <p className="mt-0.5 pl-6 font-mono text-[11px] text-muted-foreground">{productSku}</p>
        )}
      </div>

      {/* Tabla mini de proveedores */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Proveedor
              </th>
              <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                SKU Prov.
              </th>
              <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Costo
              </th>
              <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Entrega
              </th>
              <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pref.
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const cost = parseFloat(item.unit_cost)
              const isBest = minCost != null && !isNaN(cost) && cost === minCost && items.length > 1
              return (
                <tr
                  key={item.supplier_product_id}
                  className={cn(
                    "border-t border-border/50 transition-colors hover:bg-accent/40",
                    item.is_preferred && "bg-amber-500/[0.04]"
                  )}
                >
                  <td className="px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{item.supplier_name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{item.supplier_code}</p>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {item.supplier_sku ? (
                      <span className="font-mono text-xs">{item.supplier_sku}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={cn("font-mono text-sm", isBest && "font-semibold text-emerald-400")}>
                      {item.currency} {fmt(item.unit_cost)}
                    </span>
                    {isBest && (
                      <span className="ml-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[9px] font-medium text-emerald-400">
                        Mejor
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-left">
                    {item.lead_time_days != null ? (
                      <span className="text-sm">{item.lead_time_days}d</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {item.is_preferred ? (
                      <Star className="mx-auto h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export function CatalogoPage() {
  const token = useAuthStore((s) => s.accessToken)

  const [items, setItems] = useState<CatalogoItem[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [search, setSearch] = useState("")
  const [supplierFilter, setSupplierFilter] = useState<number | "">("")
  const [soloVinculados, setSoloVinculados] = useState(false)
  const [suppliers, setSuppliers] = useState<SupplierRead[]>([])
  const [viewMode, setViewMode] = useState<"lista" | "comparativa">("lista")
  const [page, setPage] = useState(0)

  const abortRef = useRef<AbortController | null>(null)

  // Cargar lista de proveedores para el filtro (una sola vez)
  useEffect(() => {
    if (!token) return
    clientesProveedoresService
      .listSuppliers(token, { limit: 500, solo_activos: false })
      .then((r) => setSuppliers(r.items))
      .catch(() => {})
  }, [token])

  const fetch = useCallback(
    (q: string, sid: number | "", vinculados: boolean, currentPage: number) => {
      if (!token) return
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setStatus("loading")

      clientesProveedoresService
        .listCatalogo(
          token,
          {
            limit: PAGE_SIZE,
            offset: currentPage * PAGE_SIZE,
            search: q || undefined,
            supplier_id: sid !== "" ? sid : undefined,
            solo_vinculados: vinculados || undefined,
          },
          ac.signal
        )
        .then((r) => {
          setItems(r.items)
          setTotal(r.total)
          setStatus("idle")
        })
        .catch((e) => {
          if ((e as Error)?.name !== "AbortError") setStatus("error")
        })
    },
    [token]
  )

  // Carga inicial y cuando cambian filtros o página
  useEffect(() => {
    setPage(0)
  }, [search, supplierFilter, soloVinculados])

  useEffect(() => {
    fetch(search, supplierFilter, soloVinculados, page)
  }, [fetch, search, supplierFilter, soloVinculados, page])

  // KPIs
  const kpis = useMemo(() => {
    const totalProveedores = new Set(items.map((i) => i.supplier_id)).size
    const vinculados = items.filter((i) => i.product_id != null).length
    const conCosto = items.filter((i) => parseFloat(i.unit_cost) > 0).length
    return { totalProveedores, vinculados, sinVincular: items.length - vinculados, conCosto }
  }, [items])

  // Agrupación para vista comparativa
  const gruposProducto = useMemo(() => {
    if (viewMode !== "comparativa") return { vinculados: [] as [string, CatalogoItem[]][], sinVincular: [] as CatalogoItem[] }
    const map = new Map<string, CatalogoItem[]>()
    const sinVincular: CatalogoItem[] = []
    for (const item of items) {
      if (!item.product_id) {
        sinVincular.push(item)
        continue
      }
      const key = item.product_sku || item.product_name || `producto-${item.product_id}`
      const existing = map.get(key)
      if (existing) {
        existing.push(item)
      } else {
        map.set(key, [item])
      }
    }
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    return { vinculados: sorted, sinVincular }
  }, [items, viewMode])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const startItem = total === 0 ? 0 : page * PAGE_SIZE + 1
  const endItem = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <div className="flex h-full flex-col">
      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between gap-4 border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-primary/10">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Catálogo Cross-Proveedor</h1>
            <p className="text-sm text-muted-foreground">
              Por SKU: opciones de proveedor · precio · lead time y MOQ
            </p>
          </div>
        </div>
        <ViewToggle
          options={[
            { value: "lista", label: "Lista", icon: List },
            { value: "comparativa", label: "Por Producto", icon: LayoutGrid },
          ]}
          active={viewMode}
          onChange={setViewMode}
        />
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-3 border-b bg-muted/20 px-6 py-4 sm:grid-cols-4">
        <KpiCard
          label="Relaciones totales"
          value={total.toLocaleString()}
          icon={Package}
          tone="blue"
        />
        <KpiCard
          label="Proveedores activos"
          value={kpis.totalProveedores.toLocaleString()}
          icon={Store}
          tone="purple"
        />
        <KpiCard
          label="Vinculados a producto"
          value={kpis.vinculados.toLocaleString()}
          icon={Link2}
          tone="green"
        />
        <KpiCard
          label="Sin vincular"
          value={kpis.sinVincular.toLocaleString()}
          icon={Link2Off}
          tone="red"
        />
      </div>

      {/* ── Content area ── */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        {/* Toolbar */}
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-[var(--radius-md)] border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Buscar producto, SKU o proveedor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="rounded-[var(--radius-md)] border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Todos los proveedores</option>
              {suppliers.map((s) => (
                <option key={s.supplier_id} value={s.supplier_id}>
                  {s.business_name}
                </option>
              ))}
            </select>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={soloVinculados}
                onChange={(e) => setSoloVinculados(e.target.checked)}
                className="h-4 w-4"
              />
              Solo vinculados
            </label>
            {(search || supplierFilter !== "" || soloVinculados) && (
              <button
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                onClick={() => {
                  setSearch("")
                  setSupplierFilter("")
                  setSoloVinculados(false)
                }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {status === "error" ? (
            <EmptyState
              icon={AlertCircle}
              title="Error al cargar el catálogo"
              description="Verifica tu conexión o recarga la página."
            />
          ) : viewMode === "lista" ? (
            <DataTable
              columns={columns}
              rows={items}
              rowKey={(r) => String(r.supplier_product_id)}
              emptyLabel={
                status === "loading"
                  ? "Cargando catálogo…"
                  : "No hay relaciones que coincidan con los filtros"
              }
              fillHeight
            />
          ) : (
            <div className="h-full overflow-y-auto pr-1">
              {items.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title={status === "loading" ? "Cargando catálogo…" : "No hay relaciones que coincidan"}
                  description="Ajusta los filtros para ver resultados."
                />
              ) : (
                <div className="space-y-4">
                  {gruposProducto.vinculados.map(([key, grupoItems]) => (
                    <ProductoComparativaCard
                      key={key}
                      productKey={key}
                      productName={grupoItems[0].product_name}
                      productSku={grupoItems[0].product_sku}
                      items={grupoItems}
                    />
                  ))}
                  {gruposProducto.sinVincular.length > 0 && (
                    <div className="surface-card border-white/70">
                      <div className="border-b px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link2Off className="h-4 w-4 text-muted-foreground" />
                          <h3 className="text-sm font-semibold text-muted-foreground">Sin vincular a producto maestro</h3>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Proveedor
                              </th>
                              <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                SKU Prov.
                              </th>
                              <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Costo
                              </th>
                              <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Entrega
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {gruposProducto.sinVincular.map((item) => (
                              <tr
                                key={item.supplier_product_id}
                                className="border-t border-border/50 transition-colors hover:bg-accent/40"
                              >
                                <td className="px-4 py-2.5">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm">{item.supplier_name}</p>
                                    <p className="font-mono text-[10px] text-muted-foreground">{item.supplier_code}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  {item.supplier_sku ? (
                                    <span className="font-mono text-xs">{item.supplier_sku}</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <span className="font-mono text-sm">
                                    {item.currency} {fmt(item.unit_cost)}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-left">
                                  {item.lead_time_days != null ? (
                                    <span className="text-sm">{item.lead_time_days}d</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">
              Mostrando {startItem}–{endItem} de {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || status === "loading"}
                className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-md)] border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>
              <span className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || status === "loading"}
                className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-md)] border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-40"
              >
                Siguiente <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
