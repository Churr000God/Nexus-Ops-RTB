import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  Banknote,
  Boxes,
  Building2,
  ExternalLink,
  FileText,
  Filter,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Loader2,
  MapPin,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  Warehouse,
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
import { ApiError } from "@/lib/http"
import { cn } from "@/lib/utils"
import { inventarioService } from "@/services/inventarioService"
import { productosService } from "@/services/productosService"
import { useAuthStore } from "@/stores/authStore"
import type { BrandRead, CategoryRead, ProductCreate, ProductRead, ProductUpdate } from "@/types/productos"

// ── View mode type ────────────────────────────────────────────────────────────
type ViewMode = "table" | "grid"

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })

function fmtPrice(n: number | null | undefined) {
  return n != null ? fmt.format(n) : "—"
}

const STATUS_OPTIONS = [
  "Activo",
  "Dado de Baja",
  "Agotado",
  "Próximamente",
  "Descontinuado",
  "Pendiente",
  "Inactivo",
]

const SALE_TYPE_OPTIONS = [
  "Por Pieza",
  "Por Caja",
  "Ambos",
  "Blister",
  "Por Paquete",
  "Por Juego",
  "Por Bolsa",
]

function statusColor(status: string | null): { bg: string; text: string; border: string; dot: string } {
  switch (status) {
    case "Activo":
      return {
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        border: "border-emerald-500/30",
        dot: "bg-emerald-400",
      }
    case "Agotado":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        border: "border-amber-500/30",
        dot: "bg-amber-400",
      }
    case "Próximamente":
      return {
        bg: "bg-sky-500/10",
        text: "text-sky-400",
        border: "border-sky-500/30",
        dot: "bg-sky-400",
      }
    case "Pendiente":
      return {
        bg: "bg-orange-500/10",
        text: "text-orange-400",
        border: "border-orange-500/30",
        dot: "bg-orange-400",
      }
    case "Dado de Baja":
    case "Descontinuado":
    case "Inactivo":
      return {
        bg: "bg-red-500/10",
        text: "text-red-400",
        border: "border-red-500/30",
        dot: "bg-red-400",
      }
    default:
      return {
        bg: "bg-neutral-500/10",
        text: "text-neutral-400",
        border: "border-neutral-500/30",
        dot: "bg-neutral-400",
      }
  }
}

function StatusChip({ status }: { status: string | null }) {
  if (!status) return <span className="text-white/30">—</span>
  const colors = statusColor(status)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        colors.bg,
        colors.text,
        colors.border,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", colors.dot)} />
      {status}
    </span>
  )
}

function SaleableChip({ isSaleable }: { isSaleable: boolean }) {
  if (isSaleable) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-400">
        <ShoppingCart className="h-3 w-3" />
        Vendible
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-400">
      <Warehouse className="h-3 w-3" />
      Interno
    </span>
  )
}

function flattenCategories(nodes: CategoryRead[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((n) => [
    { id: n.id, label: "  ".repeat(depth) + n.name },
    ...flattenCategories(n.children, depth + 1),
  ])
}

// ── Form modal (create / edit) ─────────────────────────────────────────────────

type ModalMode = { type: "create" } | { type: "edit"; product: ProductRead }

interface ProductFormProps {
  mode: ModalMode
  token: string | null
  categories: CategoryRead[]
  brands: BrandRead[]
  onClose: () => void
  onSaved: () => void
}

function ProductFormModal({ mode, token, categories, brands, onClose, onSaved }: ProductFormProps) {
  const isEdit = mode.type === "edit"
  const existing = isEdit ? mode.product : null

  const [form, setForm] = useState<ProductCreate & { id?: string }>({
    sku: existing?.sku ?? "",
    internal_code: existing?.internal_code ?? "",
    name: existing?.name ?? "",
    description: existing?.description ?? "",
    brand_id: existing?.brand_id ?? null,
    category_id: existing?.category_id ?? null,
    status: existing?.status ?? "Activo",
    sale_type: existing?.sale_type ?? "",
    package_size: existing?.package_size ?? null,
    warehouse_location: existing?.warehouse_location ?? "",
    image_url: existing?.image_url ?? "",
    datasheet_url: existing?.datasheet_url ?? "",
    unit_price: existing?.unit_price ?? null,
    purchase_cost_parts: existing?.purchase_cost_parts ?? null,
    purchase_cost_ariba: existing?.purchase_cost_ariba ?? null,
    is_saleable: existing?.is_saleable ?? true,
    is_configurable: existing?.is_configurable ?? false,
    is_assembled: existing?.is_assembled ?? false,
    pricing_strategy: existing?.pricing_strategy ?? "MOVING_AVG",
    moving_avg_months: existing?.moving_avg_months ?? 6,
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const flatCats = flattenCategories(categories)

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function numOrNull(val: string): number | null {
    const n = parseFloat(val)
    return isNaN(n) ? null : n
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.name.trim()) {
      setFormError("El nombre es requerido")
      return
    }
    if (!isEdit && !form.sku?.trim()) {
      setFormError("El SKU es requerido para crear un producto")
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        internal_code: form.internal_code?.trim() || null,
        description: form.description?.trim() || null,
        sale_type: form.sale_type?.trim() || null,
        warehouse_location: form.warehouse_location?.trim() || null,
        image_url: form.image_url?.trim() || null,
        datasheet_url: form.datasheet_url?.trim() || null,
      }
      if (isEdit) {
        const update: ProductUpdate = {
          name: payload.name,
          description: payload.description,
          brand_id: payload.brand_id,
          category_id: payload.category_id,
          status: payload.status,
          sale_type: payload.sale_type,
          package_size: payload.package_size,
          warehouse_location: payload.warehouse_location,
          image_url: payload.image_url,
          datasheet_url: payload.datasheet_url,
          unit_price: payload.unit_price,
          purchase_cost_parts: payload.purchase_cost_parts,
          purchase_cost_ariba: payload.purchase_cost_ariba,
          is_saleable: payload.is_saleable,
          is_configurable: payload.is_configurable,
          is_assembled: payload.is_assembled,
          pricing_strategy: payload.pricing_strategy,
          moving_avg_months: payload.moving_avg_months,
        }
        await productosService.updateProduct(token, existing!.id, update)
        toast.success("Producto actualizado")
      } else {
        await productosService.createProduct(token, payload as ProductCreate)
        toast.success("Producto creado")
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        const detail = (err.details as Record<string, unknown>)?.detail
        setFormError(typeof detail === "string" ? detail : "Ya existe un producto con ese nombre o SKU.")
      } else {
        setFormError(err instanceof Error ? err.message : "Error al guardar")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 h-full overflow-y-auto flex items-start justify-center p-4 pt-10">
        <div className="relative z-10 surface-card w-full max-w-2xl space-y-5 p-6 mb-10">
          {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">
              {isEdit ? "Editar producto" : "Nuevo producto"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isEdit ? `SKU: ${existing?.sku ?? "—"}` : "Datos del catálogo maestro"}
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
          {/* Identificación */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Identificación
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  SKU {!isEdit && <span className="text-red-400">*</span>}
                </label>
                <Input
                  value={form.sku ?? ""}
                  onChange={(e) => set("sku", e.target.value)}
                  placeholder="Ej. SH-1154"
                  disabled={isEdit}
                  className={isEdit ? "opacity-60" : ""}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Código interno</label>
                <Input
                  value={form.internal_code ?? ""}
                  onChange={(e) => set("internal_code", e.target.value)}
                  placeholder="Ej. RTB-REFH-SH-1154"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Nombre <span className="text-red-400">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Nombre del producto"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Descripción</label>
              <textarea
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                placeholder="Descripción técnica del producto"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </fieldset>

          {/* Clasificación */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Clasificación
            </legend>

            {/* Tipo de inventario */}
            <div className="rounded-lg border border-border bg-accent/20 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Tipo de inventario</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => set("is_saleable", true)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition-colors",
                    form.is_saleable
                      ? "border-violet-500/50 bg-violet-500/15 text-violet-400"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Vendible
                </button>
                <button
                  type="button"
                  onClick={() => set("is_saleable", false)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition-colors",
                    !form.is_saleable
                      ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-400"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Warehouse className="h-3.5 w-3.5" />
                  Interno / Equipo
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {form.is_saleable
                  ? "Aparece en Inventario de productos vendibles"
                  : "Aparece en Inventario de equipos e internos"}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <FolderOpen className="h-3 w-3" /> Categoría
                  </span>
                </label>
                <select
                  value={form.category_id ?? ""}
                  onChange={(e) => set("category_id", e.target.value || null)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">— Sin categoría —</option>
                  {flatCats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Marca
                  </span>
                </label>
                <select
                  value={form.brand_id ?? ""}
                  onChange={(e) => set("brand_id", e.target.value || null)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">— Sin marca —</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Status
                  </span>
                </label>
                <select
                  value={form.status ?? ""}
                  onChange={(e) => set("status", e.target.value || null)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">— Sin status —</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Boxes className="h-3 w-3" /> Tipo de venta
                  </span>
                </label>
                <select
                  value={form.sale_type ?? ""}
                  onChange={(e) => set("sale_type", e.target.value || null)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">— Sin tipo —</option>
                  {SALE_TYPE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tamaño paquete</label>
                <Input
                  type="number"
                  min={1}
                  value={form.package_size ?? ""}
                  onChange={(e) => set("package_size", numOrNull(e.target.value))}
                  placeholder="Ej. 1, 6, 12"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Ubicación almacén
                  </span>
                </label>
                <Input
                  value={form.warehouse_location ?? ""}
                  onChange={(e) => set("warehouse_location", e.target.value)}
                  placeholder="Ej. A-03-04"
                />
              </div>
            </div>
          </fieldset>

          {/* Precios */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Banknote className="h-3.5 w-3.5" /> Precios y costos
              </span>
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Precio unitario</label>
                <Input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={form.unit_price ?? ""}
                  onChange={(e) => set("unit_price", numOrNull(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Costo refacciones</label>
                <Input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={form.purchase_cost_parts ?? ""}
                  onChange={(e) => set("purchase_cost_parts", numOrNull(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Costo Ariba</label>
                <Input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={form.purchase_cost_ariba ?? ""}
                  onChange={(e) => set("purchase_cost_ariba", numOrNull(e.target.value))}
                  placeholder="0.00"
                />
              </div>
            </div>
          </fieldset>

          {/* Adjuntos / URLs */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Imagen y documentos
            </legend>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <ImageIcon className="h-3 w-3" /> URL de imagen
              </label>
              <Input
                type="url"
                value={form.image_url ?? ""}
                onChange={(e) => set("image_url", e.target.value)}
                placeholder="https://example.com/imagen-producto.jpg"
              />
              {form.image_url && (
                <img
                  src={form.image_url}
                  alt="preview"
                  className="mt-2 h-24 w-24 rounded border border-border object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> URL ficha técnica / documento
              </label>
              <Input
                type="url"
                value={form.datasheet_url ?? ""}
                onChange={(e) => set("datasheet_url", e.target.value)}
                placeholder="https://example.com/ficha-tecnica.pdf"
              />
            </div>
          </fieldset>

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
              {isEdit ? "Guardar cambios" : "Crear producto"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  </div>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function ProductDetailPanel({
  product,
  onClose,
  onEdit,
}: {
  product: ProductRead
  onClose: () => void
  onEdit: () => void
}) {
  return (
    <div className="surface-card border-white/70 space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            SKU: {product.sku ?? "—"} · {product.internal_code ?? "Sin cód. interno"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="h-3 w-3 mr-1" />
            Editar
          </Button>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {product.image_url && (
        <div className="rounded-lg border border-border bg-background/50 overflow-hidden">
          <img
            src={product.image_url}
            alt={product.name}
            className="h-44 w-full object-contain"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {product.status && <StatusChip status={product.status} />}
        <SaleableChip isSaleable={product.is_saleable} />
        {product.category && (
          <Badge variant="secondary" className="text-[11px]">
            {product.category}
          </Badge>
        )}
        {product.brand && (
          <Badge variant="outline" className="text-[11px]">
            {product.brand}
          </Badge>
        )}
      </div>

      {product.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
        <Row label="Tipo inventario" value={product.is_saleable ? "Vendible" : "Interno / Equipo"} />
        <Row label="Tipo venta" value={product.sale_type ?? "—"} />
        <Row label="Categoría" value={product.category ?? "—"} />
        <Row label="Marca" value={product.brand ?? "—"} />
        <Row label="Ubicación" value={product.warehouse_location ?? "—"} />
        <Row label="Precio unit." value={fmtPrice(product.unit_price)} />
        <Row label="Precio sugerido" value={fmtPrice(product.suggested_price)} />
        <Row label="Costo ref." value={fmtPrice(product.purchase_cost_parts)} />
        <Row label="Costo Ariba" value={fmtPrice(product.purchase_cost_ariba)} />
        <Row label="Demanda 90d" value={product.demand_90_days?.toString() ?? "—"} />
        <Row label="Demanda 180d" value={product.demand_180_days?.toString() ?? "—"} />
        <Row label="Total venta acum." value={fmtPrice(product.total_accumulated_sales)} />
        <Row label="Última salida" value={product.last_outbound_date ?? "—"} />
      </div>

      {(product.image_url || product.datasheet_url) && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          {product.image_url && (
            <a
              href={product.image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ImageIcon className="h-3 w-3" />
              Ver imagen
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {product.datasheet_url && (
            <a
              href={product.datasheet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <FileText className="h-3 w-3" />
              Ficha técnica
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium truncate">{value}</span>
    </>
  )
}

// ── Delete confirmation ───────────────────────────────────────────────────────

function DeleteConfirmModal({
  product,
  token,
  onClose,
  onDeleted,
}: {
  product: ProductRead
  token: string | null
  onClose: () => void
  onDeleted: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [conflictMsg, setConflictMsg] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    try {
      await productosService.deleteProduct(token, product.id)
      toast.success("Producto eliminado")
      onDeleted()
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        const detail = (err.details as Record<string, unknown>)?.detail
        setConflictMsg(typeof detail === "string" ? detail : "El producto tiene movimientos de inventario.")
      } else {
        toast.error(err instanceof Error ? err.message : "Error al eliminar")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleDeactivate() {
    setLoading(true)
    try {
      await productosService.updateProduct(token, product.id, {
        is_active: false,
        status: "Dado de Baja",
      })
      toast.success("Producto dado de baja correctamente")
      onDeleted()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al desactivar")
    } finally {
      setLoading(false)
    }
  }

  if (conflictMsg) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 surface-card w-full max-w-sm space-y-4 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-base font-semibold">No se puede eliminar</p>
              <p className="mt-1 text-sm text-muted-foreground">{conflictMsg}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            ¿Deseas <strong className="text-foreground">darlo de baja</strong> en su lugar? El producto quedará inactivo y no aparecerá en cotizaciones nuevas.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Dar de baja
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 surface-card w-full max-w-sm space-y-4 p-6">
        <p className="text-base font-semibold">Eliminar producto</p>
        <p className="text-sm text-muted-foreground">
          ¿Estás seguro de eliminar{" "}
          <span className="font-medium text-foreground">{product.name}</span>? Esta acción no se
          puede deshacer.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Rebuild inventory confirmation ────────────────────────────────────────────

function RebuildInventarioModal({
  token,
  onClose,
  onDone,
}: {
  token: string | null
  onClose: () => void
  onDone: () => void
}) {
  const [rebuilding, setRebuilding] = useState(false)

  async function handleRebuild() {
    setRebuilding(true)
    try {
      const result = await inventarioService.rebuildFromProducts(token!)
      if (result.created === 0) {
        toast.success(`Todo al día — ${result.already_existed} productos ya tenían registro`)
      } else {
        toast.success(
          `Completado: ${result.created} nuevo(s) · ${result.already_existed} ya existían`
        )
      }
      onDone()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al sincronizar inventario")
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 surface-card w-full max-w-md space-y-4 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
            <RefreshCw className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-base font-semibold">Completar inventario faltante</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Solo se crearán registros para los productos del catálogo que{" "}
              <strong className="text-foreground">aún no tengan entrada en inventario</strong>.
              Los registros existentes no se tocan.
            </p>
          </div>
        </div>
        <ul className="space-y-1 rounded-lg border border-border bg-accent/20 p-3 text-xs text-muted-foreground">
          <li>• Los registros existentes (stock, costo, clasificación) no se modifican</li>
          <li>• Los nuevos registros inician con stock 0 y sin costo asignado</li>
          <li>• Vendibles → aparecen en Inventario de productos</li>
          <li>• Internos → aparecen en Equipos e inventario interno</li>
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={rebuilding}>
            Cancelar
          </Button>
          <Button onClick={handleRebuild} disabled={rebuilding}>
            {rebuilding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Grid card item ────────────────────────────────────────────────────────────

function ProductGridCard({
  product,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  product: ProductRead
  isSelected: boolean
  onSelect: () => void
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-soft-md hover:border-primary/30",
        isSelected && "ring-1 ring-primary border-primary/50",
      )}
      onClick={onSelect}
    >
      <CardContent className="p-0">
        {/* Image */}
        <div className="relative h-32 sm:h-36 md:h-40 w-full bg-accent/30 rounded-t-[var(--radius-lg)] overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-contain p-2"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/40" />
            </div>
          )}
          {/* Badges — stacked vertically to avoid overlap on narrow cards */}
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            <StatusChip status={product.status} />
            <SaleableChip isSaleable={product.is_saleable} />
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{product.name}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground font-mono">
              {product.sku ?? "Sin SKU"}
            </p>
          </div>

          <div className="flex flex-wrap gap-1">
            {product.category && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {product.category}
              </Badge>
            )}
            {product.brand && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {product.brand}
              </Badge>
            )}
          </div>

          <div className="flex items-end justify-between pt-0.5 sm:pt-1">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Precio</p>
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {fmtPrice(product.unit_price)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Demanda 90d</p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {product.demand_90_days != null ? product.demand_90_days.toString() : "—"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-1 pt-2 border-t border-border">
            {product.image_url && (
              <a
                href={product.image_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Ver imagen"
                className="rounded p-1 sm:p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </a>
            )}
            {product.datasheet_url && (
              <a
                href={product.datasheet_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Ficha técnica"
                className="rounded p-1 sm:p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <FileText className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              onClick={onEdit}
              className="rounded p-1 sm:p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="rounded p-1 sm:p-1.5 text-muted-foreground hover:bg-red-500/15 hover:text-red-400"
              title="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPage: (p: number) => void
}) {
  if (totalPages <= 1) return null
  const start = page * pageSize + 1
  const end = Math.min((page + 1) * pageSize, total)
  return (
    <div className="flex items-center justify-between gap-4 px-1 py-2 text-sm text-muted-foreground">
      <span>
        Mostrando {start}–{end} de {total} productos
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          className="rounded px-2.5 py-1 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Anterior
        </button>
        <span className="px-2">
          {page + 1} / {totalPages}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages - 1}
          className="rounded px-2.5 py-1 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Siguiente →
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ActiveModal =
  | { type: "create" }
  | { type: "edit"; product: ProductRead }
  | { type: "delete"; product: ProductRead }
  | { type: "rebuild" }

export function ProductosCatalogoPage() {
  const token = useAuthStore((s) => s.accessToken)

  const PAGE_SIZE = 100

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<"activos" | "todos">("activos")
  const [filterCategory, setFilterCategory] = useState<string>("")
  const [filterBrand, setFilterBrand] = useState<string>("")
  const [filterSaleable, setFilterSaleable] = useState<"todos" | "vendibles" | "internos">("todos")
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [selectedProduct, setSelectedProduct] = useState<ProductRead | null>(null)
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [page, setPage] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  useEffect(() => { setPage(0) }, [filterStatus, debouncedSearch, filterCategory, filterBrand, filterSaleable])

  const productsFetcher = useCallback(
    (signal: AbortSignal) =>
      productosService.listProducts(
        token,
        {
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          solo_activos: filterStatus === "activos",
          search: debouncedSearch || undefined,
          category_id: filterCategory || undefined,
          brand_id: filterBrand || undefined,
          is_saleable:
            filterSaleable === "vendibles" ? true
            : filterSaleable === "internos" ? false
            : undefined,
        },
        signal,
      ),
    [token, filterStatus, debouncedSearch, filterCategory, filterBrand, filterSaleable, page, refreshKey], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const categoriesFetcher = useCallback(
    (signal: AbortSignal) => productosService.listCategories(token, signal),
    [token],
  )

  const brandsFetcher = useCallback(
    (signal: AbortSignal) => productosService.listBrands(token, signal),
    [token],
  )

  const { data: productsData, status: productsStatus } = useApi(productsFetcher)
  const { data: categories } = useApi(categoriesFetcher)
  const { data: brands } = useApi(brandsFetcher)

  const rows = productsData?.items ?? []
  const total = productsData?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const isLoading = productsStatus === "loading"

  const flatCats = flattenCategories(categories ?? [])

  const activeFiltersCount = [
    filterStatus !== "activos",
    !!filterCategory,
    !!filterBrand,
    filterSaleable !== "todos",
  ].filter(Boolean).length

  const COLUMNS: DataTableColumn<ProductRead>[] = [
    {
      key: "sku",
      header: "SKU",
      className: "w-[140px]",
      cell: (r) => (
        <span className="font-mono text-[11px] text-muted-foreground">{r.sku ?? "—"}</span>
      ),
    },
    {
      key: "name",
      header: "Nombre",
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          {r.image_url ? (
            <img
              src={r.image_url}
              alt=""
              className="h-8 w-8 shrink-0 rounded-md border border-border object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="h-8 w-8 shrink-0 rounded-md border border-border bg-accent/40 flex items-center justify-center">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium max-w-[280px]">{r.name}</p>
            {r.internal_code && (
              <p className="text-[10px] text-muted-foreground font-mono">{r.internal_code}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "is_saleable",
      header: "Tipo",
      className: "w-[110px]",
      cell: (r) => <SaleableChip isSaleable={r.is_saleable} />,
    },
    {
      key: "category",
      header: "Categoría",
      className: "w-[140px]",
      cell: (r) => (
        <Badge variant="secondary" className="text-[10px]">
          {r.category ?? "—"}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "w-[130px]",
      cell: (r) => <StatusChip status={r.status} />,
    },
    {
      key: "unit_price",
      header: "Precio unit.",
      className: "w-[120px] text-right",
      cell: (r) => (
        <span className="text-sm tabular-nums font-medium">{fmtPrice(r.unit_price)}</span>
      ),
    },
    {
      key: "demand",
      header: "Demanda 90d",
      className: "w-[100px] text-right",
      cell: (r) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {r.demand_90_days != null ? r.demand_90_days.toString() : "—"}
        </span>
      ),
    },
    {
      key: "links",
      header: "Doc.",
      className: "w-[60px]",
      cell: (r) => (
        <div className="flex gap-1">
          {r.image_url && (
            <a
              href={r.image_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Ver imagen"
              className="text-muted-foreground hover:text-primary"
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </a>
          )}
          {r.datasheet_url && (
            <a
              href={r.datasheet_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Ficha técnica"
              className="text-muted-foreground hover:text-primary"
            >
              <FileText className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-[80px]",
      cell: (r) => (
        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setActiveModal({ type: "edit", product: r })
            }}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setActiveModal({ type: "delete", product: r })
            }}
            className="rounded p-1 text-muted-foreground hover:bg-red-500/15 hover:text-red-400"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ]

  function refresh() {
    setRefreshKey((k) => k + 1)
  }

  function clearFilters() {
    setFilterStatus("activos")
    setFilterCategory("")
    setFilterBrand("")
    setFilterSaleable("todos")
    setSearch("")
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      {/* Header */}
      <section className="surface-card border-white/70 bg-white p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <StatusBadge variant="success">En vivo</StatusBadge>
              <StatusBadge variant="info">{total} productos</StatusBadge>
              {activeFiltersCount > 0 && (
                <Badge variant="outline" className="text-[11px]">
                  {activeFiltersCount} filtro{activeFiltersCount > 1 ? "s" : ""} activo
                  {activeFiltersCount > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Catálogo de Productos
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              SKU · marcas · categorías · precios · fichas técnicas
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              onClick={() => setActiveModal({ type: "rebuild" })}
              title="Reconstruir inventario desde el catálogo"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sincronizar inventario
            </Button>
            <Button onClick={() => setActiveModal({ type: "create" })}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo producto
            </Button>
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        {/* Search + View toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, SKU o código…"
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "px-2.5 py-1.5 transition-colors",
                  viewMode === "table"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
                title="Vista lista"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "px-2.5 py-1.5 transition-colors",
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
                title="Vista grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>

          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Filtros:</span>
          </div>

          {/* Status filter */}
          <div className="flex rounded-md border border-border overflow-hidden text-sm">
            {(["activos", "todos"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFilterStatus(opt)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  filterStatus === opt
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                {opt === "activos" ? "Activos" : "Todos"}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Todas las categorías</option>
            {flatCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label.trim()}
              </option>
            ))}
          </select>

          {/* Brand filter */}
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Todas las marcas</option>
            {(brands ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Saleable filter */}
          <select
            value={filterSaleable}
            onChange={(e) => setFilterSaleable(e.target.value as typeof filterSaleable)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="todos">Todos los tipos</option>
            <option value="vendibles">Vendibles</option>
            <option value="internos">Internos / Equipo</option>
          </select>

          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          {viewMode === "table" ? (
            <>
              <DataTable
                columns={COLUMNS}
                rows={rows}
                rowKey={(r) => r.id}
                emptyLabel={
                  isLoading
                    ? "Cargando productos…"
                    : debouncedSearch || filterCategory || filterBrand || filterSaleable !== "todos"
                      ? `Sin resultados para los filtros aplicados`
                      : "No hay productos en el catálogo"
                }
                onRowClick={(r) =>
                  setSelectedProduct((prev) => (prev?.id === r.id ? null : r))
                }
                selectedRowKey={selectedProduct?.id}
                maxHeight={selectedProduct ? undefined : "calc(100vh - 380px)"}
                fillHeight={!!selectedProduct}
              />
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={PAGE_SIZE}
                onPage={setPage}
              />
            </>
          ) : (
            /* Grid view */
            <div className="flex flex-col gap-2">
              <div className={cn("overflow-y-auto pr-1", selectedProduct ? "h-full" : "")} style={selectedProduct ? undefined : { maxHeight: "calc(100vh - 380px)" }}>
                {rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Package className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm">
                      {isLoading
                        ? "Cargando productos…"
                        : debouncedSearch || filterCategory || filterBrand || filterSaleable !== "todos"
                          ? "Sin resultados para los filtros aplicados"
                          : "No hay productos en el catálogo"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                    {rows.map((product) => (
                      <ProductGridCard
                        key={product.id}
                        product={product}
                        isSelected={selectedProduct?.id === product.id}
                        onSelect={() =>
                          setSelectedProduct((prev) =>
                            prev?.id === product.id ? null : product,
                          )
                        }
                        onEdit={(e) => {
                          e.stopPropagation()
                          setActiveModal({ type: "edit", product })
                        }}
                        onDelete={(e) => {
                          e.stopPropagation()
                          setActiveModal({ type: "delete", product })
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={PAGE_SIZE}
                onPage={setPage}
              />
            </div>
          )}
        </div>

        {selectedProduct && (
          <div className="w-[300px] shrink-0 h-full overflow-hidden">
            <div className="h-full overflow-y-auto">
              <ProductDetailPanel
                product={selectedProduct}
                onClose={() => setSelectedProduct(null)}
                onEdit={() => {
                  setActiveModal({ type: "edit", product: selectedProduct })
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {(activeModal?.type === "create" || activeModal?.type === "edit") && (
        <ProductFormModal
          mode={activeModal}
          token={token}
          categories={categories ?? []}
          brands={brands ?? []}
          onClose={() => setActiveModal(null)}
          onSaved={() => {
            refresh()
            if (activeModal.type === "edit") setSelectedProduct(null)
          }}
        />
      )}

      {activeModal?.type === "delete" && (
        <DeleteConfirmModal
          product={activeModal.product}
          token={token}
          onClose={() => setActiveModal(null)}
          onDeleted={() => {
            refresh()
            if (selectedProduct?.id === activeModal.product.id) setSelectedProduct(null)
          }}
        />
      )}

      {activeModal?.type === "rebuild" && (
        <RebuildInventarioModal
          token={token}
          onClose={() => setActiveModal(null)}
          onDone={() => refresh()}
        />
      )}
    </div>
  )
}
