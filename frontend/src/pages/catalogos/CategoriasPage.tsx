import { useCallback, useState } from "react"
import { ChevronDown, ChevronRight, FolderOpen, FolderTree, Loader2, Pencil, Plus, Search, TrendingUp, X } from "lucide-react"
import { toast } from "sonner"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useApi } from "@/hooks/useApi"
import { ApiError } from "@/lib/http"
import { cn } from "@/lib/utils"
import { productosService } from "@/services/productosService"
import { useAuthStore } from "@/stores/authStore"
import type { CategoryCreate, CategoryRead, CategoryUpdate } from "@/types/productos"

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(n: number | null) {
  return n != null ? `${(n * 100).toFixed(2)}%` : "—"
}

function flattenTree(
  nodes: CategoryRead[],
  depth = 0,
  collapsed = new Set<string>(),
): { cat: CategoryRead; depth: number }[] {
  return nodes.flatMap((n) => [
    { cat: n, depth },
    ...(n.children.length > 0 && !collapsed.has(n.id)
      ? flattenTree(n.children, depth + 1, collapsed)
      : []),
  ])
}

function getDescendantIds(cat: CategoryRead): Set<string> {
  const ids = new Set<string>()
  function collect(node: CategoryRead) {
    ids.add(node.id)
    node.children.forEach(collect)
  }
  collect(cat)
  return ids
}

// ── Form modal ────────────────────────────────────────────────────────────────

type ModalMode =
  | { type: "create"; parentId?: string }
  | { type: "edit"; category: CategoryRead }

function CategoryFormModal({
  mode,
  token,
  allCategories,
  parentMap,
  onClose,
  onSaved,
}: {
  mode: ModalMode
  token: string | null
  allCategories: CategoryRead[]
  parentMap: Map<string, string>
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = mode.type === "edit"
  const existing = isEdit ? mode.category : null

  // IDs to exclude from the parent dropdown (self + all descendants when editing)
  const excludedIds = isEdit ? getDescendantIds(existing!) : new Set<string>()

  const initialParentId =
    isEdit ? (existing?.parent_id ?? "") : (mode.type === "create" ? (mode.parentId ?? "") : "")

  const [name, setName] = useState(existing?.name ?? "")
  const [description, setDescription] = useState(existing?.description ?? "")
  const [parentId, setParentId] = useState<string>(initialParentId)
  const [profitPct, setProfitPct] = useState(
    existing?.profit_margin_percent != null
      ? String(existing.profit_margin_percent * 100)
      : "",
  )
  const [isActive, setIsActive] = useState(existing?.is_active ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const flatOptions = flattenTree(allCategories).filter(
    ({ cat }) => !excludedIds.has(cat.id),
  )

  const selectedParentName = parentId ? parentMap.get(parentId) : null

  function profitDecimal(): number | null {
    const n = parseFloat(profitPct)
    return isNaN(n) ? null : n / 100
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError("El nombre es requerido")
      return
    }
    setSubmitting(true)
    try {
      if (isEdit) {
        const update: CategoryUpdate = {
          name: name.trim(),
          description: description.trim() || null,
          parent_id: parentId || null,
          profit_margin_percent: profitDecimal(),
          is_active: isActive,
        }
        await productosService.updateCategory(token, existing!.id, update)
        toast.success("Categoría actualizada")
      } else {
        const create: CategoryCreate = {
          name: name.trim(),
          description: description.trim() || null,
          parent_id: parentId || null,
          profit_margin_percent: profitDecimal(),
          is_active: isActive,
        }
        await productosService.createCategory(token, create)
        toast.success("Categoría creada")
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        const detail = (err.details as Record<string, unknown>)?.detail
        setFormError(typeof detail === "string" ? detail : "Ya existe una categoría con ese nombre.")
      } else {
        setFormError(err instanceof Error ? err.message : "Error al guardar")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const isSubcreate = !isEdit && !!initialParentId

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 surface-card w-full max-w-md space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">
              {isEdit ? "Editar categoría" : isSubcreate ? "Nueva subcategoría" : "Nueva categoría"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? `Editando: ${existing!.name}`
                : isSubcreate
                  ? `Bajo: ${selectedParentName ?? "—"}`
                  : "Agregar categoría raíz"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Context chip when creating sub */}
        {isSubcreate && selectedParentName && (
          <div className="flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2">
            <FolderTree className="h-3.5 w-3.5 shrink-0 text-violet-400" />
            <span className="text-xs text-violet-300">
              Subcategoría de <strong>{selectedParentName}</strong>
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Nombre <span className="text-red-400">*</span>
            </label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isSubcreate ? `Ej. ${selectedParentName ?? "GRIFERIA"} HELVEX` : "Ej. GRIFERIA"}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Descripción opcional"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Categoría padre</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— Sin padre (categoría raíz) —</option>
              {flatOptions.map(({ cat, depth }) => (
                <option key={cat.id} value={cat.id}>
                  {"  ".repeat(depth)}{depth > 0 ? "↳ " : ""}{cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              % Margen de ganancia
            </label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                max={1000}
                step="0.001"
                value={profitPct}
                onChange={(e) => setProfitPct(e.target.value)}
                placeholder="Ej. 33.5"
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive((v) => !v)}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                isActive ? "bg-emerald-500" : "bg-slate-600",
              )}
            >
              <span
                className={cn(
                  "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                  isActive ? "translate-x-4" : "translate-x-1",
                )}
              />
            </button>
            <span className="text-sm text-muted-foreground">
              {isActive ? "Activa" : "Inactiva"}
            </span>
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
              {isEdit ? "Guardar cambios" : isSubcreate ? "Crear subcategoría" : "Crear categoría"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CategoriasPage() {
  const token = useAuthStore((s) => s.accessToken)
  const [search, setSearch] = useState("")
  const [filterActive, setFilterActive] = useState<"activas" | "todas">("activas")
  const [activeModal, setActiveModal] = useState<ModalMode | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const categoriesFetcher = useCallback(
    (signal: AbortSignal) => productosService.listCategoriesAll(token, signal),
    [token, refreshKey], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const { data: categoriesTree, status: catsStatus } = useApi(categoriesFetcher)

  // Full flat list (for parentMap and counts) — ignores collapse
  const flat = flattenTree(categoriesTree ?? [])
  const parentMap = new Map(flat.map(({ cat }) => [cat.id, cat.name]))

  // Visible list respects collapse — but when searching, ignore collapse so results are always visible
  const visibleFlat = search
    ? flat
    : flattenTree(categoriesTree ?? [], 0, collapsedIds)

  const filtered = visibleFlat.filter(({ cat }) => {
    const matchesActive = filterActive === "todas" || cat.is_active
    const matchesSearch = !search || cat.name.toLowerCase().includes(search.toLowerCase())
    return matchesActive && matchesSearch
  })

  function refresh() {
    setRefreshKey((k) => k + 1)
  }

  async function handleToggleActive(cat: CategoryRead) {
    try {
      await productosService.updateCategory(token, cat.id, { is_active: !cat.is_active })
      toast.success(cat.is_active ? "Categoría desactivada" : "Categoría activada")
      refresh()
    } catch {
      toast.error("Error al cambiar estado")
    }
  }

  const total = flat.length
  const activeCount = flat.filter(({ cat }) => cat.is_active).length
  const isLoading = catsStatus === "loading"

  const COLUMNS: DataTableColumn<{ cat: CategoryRead; depth: number }>[] = [
    {
      key: "name",
      header: "Nombre",
      cell: ({ cat, depth }) => {
        const isCollapsed = collapsedIds.has(cat.id)
        const hasChildren = cat.children.length > 0
        return (
          <div className="flex items-center gap-1.5" style={{ paddingLeft: `${depth * 20}px` }}>
            {/* Chevron toggle — only for categories with children */}
            {hasChildren ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggleCollapse(cat.id) }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title={isCollapsed ? "Expandir subcategorías" : "Colapsar subcategorías"}
              >
                {isCollapsed
                  ? <ChevronRight className="h-3.5 w-3.5" />
                  : <ChevronDown className="h-3.5 w-3.5" />
                }
              </button>
            ) : (
              // Spacer so leaf rows align with parent rows
              <span className="w-5 shrink-0" />
            )}

            {depth > 0 && (
              <span className="text-muted-foreground/30 select-none text-xs">↳</span>
            )}

            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                hasChildren
                  ? "border-violet-500/30 bg-violet-500/10"
                  : "border-border bg-accent/40",
              )}
            >
              {hasChildren
                ? <FolderTree className="h-3.5 w-3.5 text-violet-400" />
                : <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              }
            </div>

            <span className="font-medium">{cat.name}</span>

            {hasChildren && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] px-1.5 py-0 border-violet-500/20 bg-violet-500/10 text-violet-400",
                  isCollapsed && "opacity-60",
                )}
              >
                {isCollapsed ? `+${cat.children.length}` : `${cat.children.length} sub`}
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      key: "parent",
      header: "Padre",
      className: "w-[190px]",
      cell: ({ cat }) => (
        <span className="text-sm text-muted-foreground">
          {cat.parent_id ? parentMap.get(cat.parent_id) ?? "—" : (
            <span className="text-xs text-muted-foreground/50 italic">raíz</span>
          )}
        </span>
      ),
    },
    {
      key: "profit_margin_percent",
      header: "Margen",
      className: "w-[100px] text-right",
      cell: ({ cat }) => (
        <div className="flex items-center justify-end gap-1">
          {cat.profit_margin_percent != null && (
            <TrendingUp className="h-3 w-3 text-emerald-400" />
          )}
          <span className="tabular-nums text-sm">{fmtPct(cat.profit_margin_percent)}</span>
        </div>
      ),
    },
    {
      key: "is_active",
      header: "Estado",
      className: "w-[95px]",
      cell: ({ cat }) => (
        cat.is_active
          ? <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[11px]">Activa</Badge>
          : <Badge variant="secondary" className="text-[11px]">Inactiva</Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-[160px]",
      cell: ({ cat }) => (
        <div className="flex items-center gap-1">
          {/* Add subcategory */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setActiveModal({ type: "create", parentId: cat.id })
            }}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-violet-500/10 hover:text-violet-400 transition-colors"
            title={`Agregar subcategoría de ${cat.name}`}
          >
            <Plus className="h-3 w-3" />
            Sub
          </button>

          {/* Edit */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setActiveModal({ type: "edit", category: cat })
            }}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          {/* Toggle active */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              void handleToggleActive(cat)
            }}
            className={cn(
              "rounded px-1.5 py-1 text-[11px] font-medium transition-colors",
              cat.is_active
                ? "text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                : "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400",
            )}
          >
            {cat.is_active ? "Desactivar" : "Activar"}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      {/* Header */}
      <section className="surface-card border-white/70 bg-white p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <StatusBadge variant="success">En vivo</StatusBadge>
              <StatusBadge variant="info">{total} categorías</StatusBadge>
              <StatusBadge variant="neutral">{activeCount} activas</StatusBadge>
            </div>
            <div className="flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-[hsl(var(--primary))]" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Catálogo de Categorías
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Árbol jerárquico de categorías · margen de ganancia por categoría
            </p>
          </div>
          <Button onClick={() => setActiveModal({ type: "create" })}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva categoría
          </Button>
        </div>
      </section>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            className="pl-9"
          />
        </div>

        <div className="flex rounded-md border border-border overflow-hidden">
          {(["activas", "todas"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setFilterActive(opt)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                filterActive === opt
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              {opt === "activas" ? "Activas" : "Todas"}
            </button>
          ))}
        </div>

        {/* Expand / collapse all — only useful when no search active */}
        {!search && flat.some(({ cat }) => cat.children.length > 0) && (
          <div className="flex gap-1">
            <button
              onClick={() => setCollapsedIds(new Set())}
              className="rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Expandir todas las categorías"
            >
              <ChevronDown className="inline h-3 w-3 mr-0.5" />
              Expandir todo
            </button>
            <button
              onClick={() => {
                const allParentIds = flat
                  .filter(({ cat }) => cat.children.length > 0)
                  .map(({ cat }) => cat.id)
                setCollapsedIds(new Set(allParentIds))
              }}
              className="rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Colapsar todas las categorías"
            >
              <ChevronRight className="inline h-3 w-3 mr-0.5" />
              Colapsar todo
            </button>
          </div>
        )}

        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        rows={filtered}
        rowKey={({ cat }) => cat.id}
        maxHeight="calc(100vh - 320px)"
        emptyLabel={
          isLoading
            ? "Cargando categorías…"
            : search
              ? "Sin resultados para la búsqueda"
              : "No hay categorías registradas"
        }
      />

      {/* Modals */}
      {activeModal && (
        <CategoryFormModal
          mode={activeModal}
          token={token}
          allCategories={categoriesTree ?? []}
          parentMap={parentMap}
          onClose={() => setActiveModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}
