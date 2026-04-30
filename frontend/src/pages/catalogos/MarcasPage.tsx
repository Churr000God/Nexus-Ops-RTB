import { useCallback, useState } from "react"
import { Building2, Loader2, Pencil, Plus, Search, Tag, X } from "lucide-react"
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
import type { BrandCreate, BrandRead, BrandUpdate } from "@/types/productos"

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtPct = (n: number | null) =>
  n != null ? `${(n * 100).toFixed(2)}%` : "—"

// ── Form modal ────────────────────────────────────────────────────────────────

type ModalMode = { type: "create" } | { type: "edit"; brand: BrandRead }

function BrandFormModal({
  mode,
  token,
  onClose,
  onSaved,
}: {
  mode: ModalMode
  token: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = mode.type === "edit"
  const existing = isEdit ? mode.brand : null

  const [name, setName] = useState(existing?.name ?? "")
  const [description, setDescription] = useState(existing?.description ?? "")
  const [markupPct, setMarkupPct] = useState(
    existing?.markup_percent != null ? String(existing.markup_percent * 100) : "",
  )
  const [isActive, setIsActive] = useState(existing?.is_active ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function markupDecimal(): number | null {
    const n = parseFloat(markupPct)
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
        const update: BrandUpdate = {
          name: name.trim(),
          description: description.trim() || null,
          markup_percent: markupDecimal(),
          is_active: isActive,
        }
        await productosService.updateBrand(token, existing!.id, update)
        toast.success("Marca actualizada")
      } else {
        const create: BrandCreate = {
          name: name.trim(),
          description: description.trim() || null,
          markup_percent: markupDecimal(),
          is_active: isActive,
        }
        await productosService.createBrand(token, create)
        toast.success("Marca creada")
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        const detail = (err.details as Record<string, unknown>)?.detail
        setFormError(typeof detail === "string" ? detail : "Ya existe una marca con ese nombre.")
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
      <div className="relative z-10 surface-card w-full max-w-md space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">
              {isEdit ? "Editar marca" : "Nueva marca"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isEdit ? `ID: ${existing!.id.slice(0, 8)}…` : "Agregar al catálogo de marcas"}
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Nombre <span className="text-red-400">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. HELVEX"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Descripción opcional de la marca"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">% Incremento (markup)</label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={markupPct}
                onChange={(e) => setMarkupPct(e.target.value)}
                placeholder="Ej. 15 (equivale a 15%)"
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Porcentaje de incremento sobre el precio base de proveedor
            </p>
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
              {isEdit ? "Guardar cambios" : "Crear marca"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ActiveModal = { type: "create" } | { type: "edit"; brand: BrandRead }

export function MarcasPage() {
  const token = useAuthStore((s) => s.accessToken)
  const [search, setSearch] = useState("")
  const [filterActive, setFilterActive] = useState<"activas" | "todas">("activas")
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const brandsFetcher = useCallback(
    (signal: AbortSignal) => productosService.listBrandsAll(token, signal),
    [token, refreshKey], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const { data: brands, status: brandsStatus } = useApi(brandsFetcher)

  const filtered = (brands ?? []).filter((b) => {
    const matchesActive = filterActive === "todas" || b.is_active
    const matchesSearch =
      !search || b.name.toLowerCase().includes(search.toLowerCase())
    return matchesActive && matchesSearch
  })

  function refresh() {
    setRefreshKey((k) => k + 1)
  }

  async function handleToggleActive(brand: BrandRead) {
    try {
      await productosService.updateBrand(token, brand.id, { is_active: !brand.is_active })
      toast.success(brand.is_active ? "Marca desactivada" : "Marca activada")
      refresh()
    } catch {
      toast.error("Error al cambiar estado")
    }
  }

  const COLUMNS: DataTableColumn<BrandRead>[] = [
    {
      key: "name",
      header: "Nombre",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-accent/40">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="font-medium">{r.name}</span>
        </div>
      ),
    },
    {
      key: "description",
      header: "Descripción",
      cell: (r) => (
        <span className="text-sm text-muted-foreground">{r.description ?? "—"}</span>
      ),
    },
    {
      key: "markup_percent",
      header: "% Incremento",
      className: "w-[130px] text-right",
      cell: (r) => (
        <span className="tabular-nums text-sm">
          {r.markup_percent != null ? fmtPct(r.markup_percent) : "—"}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "Estado",
      className: "w-[100px]",
      cell: (r) => (
        r.is_active
          ? <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[11px]">Activa</Badge>
          : <Badge variant="secondary" className="text-[11px]">Inactiva</Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-[100px]",
      cell: (r) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setActiveModal({ type: "edit", brand: r })
            }}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              void handleToggleActive(r)
            }}
            className={cn(
              "rounded px-2 py-1 text-[11px] font-medium transition-colors",
              r.is_active
                ? "text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                : "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400",
            )}
            title={r.is_active ? "Desactivar" : "Activar"}
          >
            {r.is_active ? "Desactivar" : "Activar"}
          </button>
        </div>
      ),
    },
  ]

  const isLoading = brandsStatus === "loading"
  const total = brands?.length ?? 0
  const activeCount = (brands ?? []).filter((b) => b.is_active).length

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      {/* Header */}
      <section className="surface-card border-white/70 bg-white p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <StatusBadge variant="success">En vivo</StatusBadge>
              <StatusBadge variant="info">{total} marcas</StatusBadge>
              <StatusBadge variant="neutral">{activeCount} activas</StatusBadge>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[hsl(var(--primary))]" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Catálogo de Marcas
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Alta, edición y desactivación de marcas · porcentaje de incremento sobre precio base
            </p>
          </div>
          <Button onClick={() => setActiveModal({ type: "create" })}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva marca
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

        <div className="flex rounded-md border border-border overflow-hidden text-sm">
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

        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        rows={filtered}
        rowKey={(r) => r.id}
        maxHeight="calc(100vh - 320px)"
        emptyLabel={
          isLoading
            ? "Cargando marcas…"
            : search
              ? "Sin resultados para la búsqueda"
              : "No hay marcas registradas"
        }
      />

      {/* Modals */}
      {activeModal && (
        <BrandFormModal
          mode={activeModal}
          token={token}
          onClose={() => setActiveModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}
