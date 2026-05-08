import { useCallback, useState } from "react"
import {
  DollarSign,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useApi } from "@/hooks/useApi"
import { usePermission } from "@/hooks/usePermission"
import { ApiError } from "@/lib/http"
import { cn } from "@/lib/utils"
import { productosService } from "@/services/productosService"
import { useAuthStore } from "@/stores/authStore"
import type {
  AribaPriceCreate,
  AribaPriceRead,
  AribaPriceUpdate,
  BrandCostCreate,
  BrandCostRead,
  BrandCostUpdate,
} from "@/types/productos"

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

const fmtMXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })

// ── Ariba Form Modal ──────────────────────────────────────────────────────────

type AribaModalMode = { type: "create" } | { type: "edit"; entry: AribaPriceRead }

function AribaFormModal({
  mode,
  token,
  onClose,
  onSaved,
}: {
  mode: AribaModalMode
  token: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = mode.type === "edit"
  const existing = isEdit ? mode.entry : null

  const [sku, setSku] = useState(existing?.sku ?? "")
  const [price, setPrice] = useState(existing != null ? String(existing.sale_price) : "")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!isEdit && !sku.trim()) {
      setFormError("El SKU es requerido")
      return
    }
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError("El precio debe ser un número mayor a cero")
      return
    }
    setSubmitting(true)
    try {
      if (isEdit) {
        const update: AribaPriceUpdate = { sale_price: priceNum }
        await productosService.updateAribaPrice(token, existing!.id, update)
        toast.success("Precio Ariba actualizado")
      } else {
        const create: AribaPriceCreate = { sku: sku.trim(), sale_price: priceNum }
        await productosService.createAribaPrice(token, create)
        toast.success("Precio Ariba creado")
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        const detail = (err.details as Record<string, unknown>)?.detail
        setFormError(typeof detail === "string" ? detail : "El SKU ya existe en la lista Ariba.")
      } else {
        setFormError(err instanceof Error ? err.message : "Error al guardar")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 surface-card w-full max-w-sm space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">
              {isEdit ? "Editar precio Ariba" : "Nuevo precio Ariba"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isEdit ? `SKU: ${existing!.sku}` : "Agregar SKU al precio pactado con cliente"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                SKU <span className="text-red-400">*</span>
              </label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Ej. SF-170"
                className="font-mono"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Precio de venta Ariba (MXN) <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                min={0}
                step="0.0001"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.0000"
                className="pl-6 font-mono"
              />
            </div>
          </div>

          {formError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear entrada"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Brand Cost Form Modal ─────────────────────────────────────────────────────

type BrandModalMode = { type: "create" } | { type: "edit"; entry: BrandCostRead }

function BrandCostFormModal({
  mode,
  token,
  onClose,
  onSaved,
}: {
  mode: BrandModalMode
  token: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = mode.type === "edit"
  const existing = isEdit ? mode.entry : null

  const [sku, setSku] = useState(existing?.sku ?? "")
  const [cost, setCost] = useState(existing != null ? String(existing.cost_without_iva) : "")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!isEdit && !sku.trim()) {
      setFormError("El SKU es requerido")
      return
    }
    const costNum = parseFloat(cost)
    if (isNaN(costNum) || costNum <= 0) {
      setFormError("El costo debe ser un número mayor a cero")
      return
    }
    setSubmitting(true)
    try {
      if (isEdit) {
        const update: BrandCostUpdate = { cost_without_iva: costNum }
        await productosService.updateBrandCost(token, existing!.id, update)
        toast.success("Costo de Refacciones actualizado")
      } else {
        const create: BrandCostCreate = { sku: sku.trim(), cost_without_iva: costNum }
        await productosService.createBrandCost(token, create)
        toast.success("Costo de Refacciones creado")
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        const detail = (err.details as Record<string, unknown>)?.detail
        setFormError(typeof detail === "string" ? detail : "El SKU ya existe en la lista de Refacciones.")
      } else {
        setFormError(err instanceof Error ? err.message : "Error al guardar")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 surface-card w-full max-w-sm space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">
              {isEdit ? "Editar costo Refacciones" : "Nuevo costo Refacciones"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isEdit ? `SKU: ${existing!.sku}` : "Agregar costo de marca s/IVA"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                SKU <span className="text-red-400">*</span>
              </label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Ej. SF-170"
                className="font-mono"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Costo s/IVA (MXN) <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                min={0}
                step="0.0001"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.0000"
                className="pl-6 font-mono"
              />
            </div>
          </div>

          {formError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear entrada"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Mobile Card Components ────────────────────────────────────────────────────

function AribaCard({
  entry,
  canManage,
  onEdit,
  onToggle,
  onDelete,
}: {
  entry: AribaPriceRead
  canManage: boolean
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm font-medium truncate">{entry.sku}</p>
            <p className="text-xs text-muted-foreground truncate">
              {entry.product_name ?? "Sin producto asociado"}
            </p>
          </div>
          {entry.is_active ? (
            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[11px] shrink-0">
              Activo
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[11px] shrink-0">
              Inactivo
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Precio Ariba</span>
          <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
            {fmtMXN.format(entry.sale_price)}
          </span>
        </div>

        {canManage && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-amber-400"
              title="Editar precio"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              className={cn(
                "rounded p-2 transition-colors",
                entry.is_active
                  ? "text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                  : "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400",
              )}
              title={entry.is_active ? "Desactivar" : "Activar"}
            >
              {entry.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="rounded p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RefaccionesCard({
  entry,
  canManage,
  onEdit,
  onToggle,
  onDelete,
}: {
  entry: BrandCostRead
  canManage: boolean
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm font-medium truncate">{entry.sku}</p>
            <p className="text-xs text-muted-foreground truncate">
              {entry.product_name ?? "Sin producto asociado"}
            </p>
          </div>
          {entry.is_active ? (
            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[11px] shrink-0">
              Activo
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[11px] shrink-0">
              Inactivo
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Costo s/IVA</span>
          <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
            {fmtMXN.format(entry.cost_without_iva)}
          </span>
        </div>

        {canManage && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-amber-400"
              title="Editar costo"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              className={cn(
                "rounded p-2 transition-colors",
                entry.is_active
                  ? "text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                  : "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400",
              )}
              title={entry.is_active ? "Desactivar" : "Activar"}
            >
              {entry.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="rounded p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Ariba Tab ─────────────────────────────────────────────────────────────────

function AribaTab({ token, canManage }: { token: string | null; canManage: boolean }) {
  const [search, setSearch] = useState("")
  const [filterActive, setFilterActive] = useState(false)
  const [offset, setOffset] = useState(0)
  const [activeModal, setActiveModal] = useState<AribaModalMode | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      productosService.listAribaPrices(
        token,
        { search, limit: PAGE_SIZE, offset, solo_activos: filterActive },
        signal,
      ),
    [token, search, offset, filterActive, refreshKey], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const { data, status } = useApi(fetcher)

  function refresh() {
    setRefreshKey((k) => k + 1)
  }

  async function handleToggle(entry: AribaPriceRead) {
    try {
      await productosService.updateAribaPrice(token, entry.id, { is_active: !entry.is_active })
      toast.success(entry.is_active ? "Entrada desactivada" : "Entrada activada")
      refresh()
    } catch {
      toast.error("Error al cambiar estado")
    }
  }

  async function handleDelete(entry: AribaPriceRead) {
    if (!confirm(`¿Eliminar el SKU "${entry.sku}" de la lista Ariba?`)) return
    try {
      await productosService.deleteAribaPrice(token, entry.id)
      toast.success("Entrada eliminada")
      refresh()
    } catch {
      toast.error("Error al eliminar")
    }
  }

  const COLUMNS: DataTableColumn<AribaPriceRead>[] = [
    {
      key: "sku",
      header: "SKU",
      cell: (r) => <span className="font-mono text-sm font-medium">{r.sku}</span>,
    },
    {
      key: "sale_price",
      header: "Precio Ariba",
      className: "w-[140px] text-right",
      cell: (r) => (
        <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
          {fmtMXN.format(r.sale_price)}
        </span>
      ),
    },
    {
      key: "product_name",
      header: "Producto asociado",
      className: "hidden md:table-cell",
      cell: (r) => (
        <span className="text-xs text-muted-foreground">{r.product_name ?? "—"}</span>
      ),
    },
    {
      key: "is_active",
      header: "Estado",
      className: "w-[100px]",
      cell: (r) =>
        r.is_active ? (
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[11px]">
            Activo
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[11px]">
            Inactivo
          </Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "w-[110px]",
      cell: (r) =>
        canManage ? (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setActiveModal({ type: "edit", entry: r })
              }}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-amber-400"
              title="Editar precio"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                void handleToggle(r)
              }}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium transition-colors hidden lg:inline-block",
                r.is_active
                  ? "text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                  : "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400",
              )}
              title={r.is_active ? "Desactivar" : "Activar"}
            >
              {r.is_active ? "Desactivar" : "Activar"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                void handleToggle(r)
              }}
              className={cn(
                "rounded p-1 transition-colors lg:hidden",
                r.is_active
                  ? "text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                  : "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400",
              )}
              title={r.is_active ? "Desactivar" : "Activar"}
            >
              {r.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                void handleDelete(r)
              }}
              className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
              title="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null,
    },
  ]

  const isLoading = status === "loading"
  const total = data?.total ?? 0
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, total)

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center isolate shrink-0">
        <div className="relative w-full min-w-0 sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setOffset(0)
            }}
            placeholder="Buscar por SKU…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={filterActive}
              onChange={(e) => {
                setFilterActive(e.target.checked)
                setOffset(0)
              }}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Solo activos
          </label>

          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="flex items-center justify-between gap-3 sm:ml-auto">
          <span className="text-xs text-muted-foreground">
            {total > 0 ? `${from}–${to} de ${total}` : "Sin resultados"}
          </span>
          {canManage && (
            <Button size="sm" onClick={() => setActiveModal({ type: "create" })}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nuevo
            </Button>
          )}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block flex-1 min-h-0">
        <DataTable
          columns={COLUMNS}
          rows={data?.items ?? []}
          rowKey={(r) => r.id}
          fillHeight
          emptyLabel={
            isLoading
              ? "Cargando precios Ariba…"
              : search
                ? "Sin resultados para la búsqueda"
                : "No hay entradas en la lista Ariba"
          }
        />
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Cargando precios Ariba…
          </div>
        ) : data?.items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {search ? "Sin resultados para la búsqueda" : "No hay entradas en la lista Ariba"}
          </div>
        ) : (
          data?.items.map((item) => (
            <AribaCard
              key={item.id}
              entry={item}
              canManage={canManage}
              onEdit={() => setActiveModal({ type: "edit", entry: item })}
              onToggle={() => void handleToggle(item)}
              onDelete={() => void handleDelete(item)}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {activeModal && (
        <AribaFormModal
          mode={activeModal}
          token={token}
          onClose={() => setActiveModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}

// ── Brand Cost Tab ────────────────────────────────────────────────────────────

function RefaccionesTab({ token, canManage }: { token: string | null; canManage: boolean }) {
  const [search, setSearch] = useState("")
  const [filterActive, setFilterActive] = useState(false)
  const [offset, setOffset] = useState(0)
  const [activeModal, setActiveModal] = useState<BrandModalMode | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      productosService.listBrandCosts(
        token,
        { search, limit: PAGE_SIZE, offset, solo_activos: filterActive },
        signal,
      ),
    [token, search, offset, filterActive, refreshKey], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const { data, status } = useApi(fetcher)

  function refresh() {
    setRefreshKey((k) => k + 1)
  }

  async function handleToggle(entry: BrandCostRead) {
    try {
      await productosService.updateBrandCost(token, entry.id, { is_active: !entry.is_active })
      toast.success(entry.is_active ? "Entrada desactivada" : "Entrada activada")
      refresh()
    } catch {
      toast.error("Error al cambiar estado")
    }
  }

  async function handleDelete(entry: BrandCostRead) {
    if (!confirm(`¿Eliminar el SKU "${entry.sku}" de la lista de Refacciones?`)) return
    try {
      await productosService.deleteBrandCost(token, entry.id)
      toast.success("Entrada eliminada")
      refresh()
    } catch {
      toast.error("Error al eliminar")
    }
  }

  const COLUMNS: DataTableColumn<BrandCostRead>[] = [
    {
      key: "sku",
      header: "SKU",
      cell: (r) => <span className="font-mono text-sm font-medium">{r.sku}</span>,
    },
    {
      key: "cost_without_iva",
      header: "Costo s/IVA",
      className: "w-[140px] text-right",
      cell: (r) => (
        <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
          {fmtMXN.format(r.cost_without_iva)}
        </span>
      ),
    },
    {
      key: "product_name",
      header: "Producto asociado",
      className: "hidden md:table-cell",
      cell: (r) => (
        <span className="text-xs text-muted-foreground">{r.product_name ?? "—"}</span>
      ),
    },
    {
      key: "is_active",
      header: "Estado",
      className: "w-[100px]",
      cell: (r) =>
        r.is_active ? (
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[11px]">
            Activo
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[11px]">
            Inactivo
          </Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "w-[110px]",
      cell: (r) =>
        canManage ? (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setActiveModal({ type: "edit", entry: r })
              }}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-amber-400"
              title="Editar costo"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                void handleToggle(r)
              }}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium transition-colors hidden lg:inline-block",
                r.is_active
                  ? "text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                  : "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400",
              )}
              title={r.is_active ? "Desactivar" : "Activar"}
            >
              {r.is_active ? "Desactivar" : "Activar"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                void handleToggle(r)
              }}
              className={cn(
                "rounded p-1 transition-colors lg:hidden",
                r.is_active
                  ? "text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                  : "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400",
              )}
              title={r.is_active ? "Desactivar" : "Activar"}
            >
              {r.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                void handleDelete(r)
              }}
              className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
              title="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null,
    },
  ]

  const isLoading = status === "loading"
  const total = data?.total ?? 0
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, total)

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center isolate shrink-0">
        <div className="relative w-full min-w-0 sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setOffset(0)
            }}
            placeholder="Buscar por SKU…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={filterActive}
              onChange={(e) => {
                setFilterActive(e.target.checked)
                setOffset(0)
              }}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Solo activos
          </label>

          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="flex items-center justify-between gap-3 sm:ml-auto">
          <span className="text-xs text-muted-foreground">
            {total > 0 ? `${from}–${to} de ${total}` : "Sin resultados"}
          </span>
          {canManage && (
            <Button size="sm" onClick={() => setActiveModal({ type: "create" })}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nuevo
            </Button>
          )}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block flex-1 min-h-0">
        <DataTable
          columns={COLUMNS}
          rows={data?.items ?? []}
          rowKey={(r) => r.id}
          fillHeight
          emptyLabel={
            isLoading
              ? "Cargando costos de Refacciones…"
              : search
                ? "Sin resultados para la búsqueda"
                : "No hay entradas en la lista de Refacciones"
          }
        />
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Cargando costos de Refacciones…
          </div>
        ) : data?.items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {search ? "Sin resultados para la búsqueda" : "No hay entradas en la lista de Refacciones"}
          </div>
        ) : (
          data?.items.map((item) => (
            <RefaccionesCard
              key={item.id}
              entry={item}
              canManage={canManage}
              onEdit={() => setActiveModal({ type: "edit", entry: item })}
              onToggle={() => void handleToggle(item)}
              onDelete={() => void handleDelete(item)}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {activeModal && (
        <BrandCostFormModal
          mode={activeModal}
          token={token}
          onClose={() => setActiveModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type ActiveTab = "ariba" | "refacciones"

export function CostosPage() {
  const token = useAuthStore((s) => s.accessToken)
  const canManage = usePermission("cost_list.manage")
  const [activeTab, setActiveTab] = useState<ActiveTab>("ariba")

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: "ariba", label: "Precios Ariba" },
    { key: "refacciones", label: "Costos Refacciones" },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      {/* Header */}
      <section className="surface-card border-white/70 bg-white p-5 md:p-6 shrink-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <StatusBadge variant="success">En vivo</StatusBadge>
              {canManage && <StatusBadge variant="info">Gestión habilitada</StatusBadge>}
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[hsl(var(--primary))]" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Listas de Costos
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Precios Ariba pactados con cliente · Costos de marca para Refacciones s/IVA
            </p>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex rounded-md border border-border overflow-hidden text-sm w-full sm:w-fit shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 sm:flex-initial px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "ariba" ? (
          <AribaTab token={token} canManage={canManage} />
        ) : (
          <RefaccionesTab token={token} canManage={canManage} />
        )}
      </div>
    </div>
  )
}
