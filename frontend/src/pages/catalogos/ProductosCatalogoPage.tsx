import { useCallback, useEffect, useRef, useState } from "react"
import {
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
  Search,
  Tag,
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
import { cn } from "@/lib/utils"
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

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-accent/30 p-4 space-y-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  )
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
      {children}
      {required && <span className="text-red-400">*</span>}
    </label>
  )
}

function SelectField({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string
  onChange: (val: string) => void
  placeholder: string
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:border-muted-foreground/30 transition-colors"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  )
}

function SwitchField({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200",
        checked ? "bg-primary" : "bg-muted-foreground/30",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
      <span className="sr-only">{label}</span>
    </button>
  )
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
    is_configurable: existing?.is_configurable ?? false,
    is_assembled: existing?.is_assembled ?? false,
    pricing_strategy: existing?.pricing_strategy ?? "MOVING_AVG",
    moving_avg_months: existing?.moving_avg_months ?? 6,
  })
  const [submitting, setSubmitting] = useState(false)
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
    if (!form.name.trim()) {
      toast.error("El nombre es requerido")
      return
    }
    if (!isEdit && !form.sku?.trim()) {
      toast.error("El SKU es requerido para crear un producto")
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
      toast.error(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 surface-card w-full max-w-2xl mb-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border bg-accent/20 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold">
                {isEdit ? "Editar producto" : "Nuevo producto"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isEdit ? `SKU: ${existing?.sku ?? "—"}` : "Completa los datos del catálogo maestro"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Identificación */}
          <SectionCard icon={Tag} title="Identificación">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label required={!isEdit}>SKU</Label>
                <Input
                  value={form.sku ?? ""}
                  onChange={(e) => set("sku", e.target.value)}
                  placeholder="Ej. SH-1154"
                  disabled={isEdit}
                  className={cn(isEdit && "opacity-60 bg-accent/30")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Código interno</Label>
                <Input
                  value={form.internal_code ?? ""}
                  onChange={(e) => set("internal_code", e.target.value)}
                  placeholder="Ej. RTB-REFH-SH-1154"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label required>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Nombre comercial del producto"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <textarea
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                placeholder="Descripción técnica o comercial del producto"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              />
            </div>
          </SectionCard>

          {/* Clasificación */}
          <SectionCard icon={FolderOpen} title="Clasificación">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <SelectField
                  value={form.category_id ?? ""}
                  onChange={(v) => set("category_id", v || null)}
                  placeholder="— Sin categoría —"
                >
                  {flatCats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="space-y-1.5">
                <Label>Marca</Label>
                <SelectField
                  value={form.brand_id ?? ""}
                  onChange={(v) => set("brand_id", v || null)}
                  placeholder="— Sin marca —"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <SelectField
                  value={form.status ?? ""}
                  onChange={(v) => set("status", v || null)}
                  placeholder="— Selecciona status —"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de venta</Label>
                <SelectField
                  value={form.sale_type ?? ""}
                  onChange={(v) => set("sale_type", v || null)}
                  placeholder="— Selecciona tipo —"
                >
                  {SALE_TYPE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="space-y-1.5">
                <Label>Tamaño paquete</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.package_size ?? ""}
                  onChange={(e) => set("package_size", numOrNull(e.target.value))}
                  placeholder="Ej. 1, 6, 12"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ubicación almacén</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={form.warehouse_location ?? ""}
                    onChange={(e) => set("warehouse_location", e.target.value)}
                    placeholder="Ej. A-03-04"
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Precios */}
          <SectionCard icon={Banknote} title="Precios y costos">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Precio unitario</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.0001"
                    value={form.unit_price ?? ""}
                    onChange={(e) => set("unit_price", numOrNull(e.target.value))}
                    placeholder="0.00"
                    className="pl-6"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Costo refacciones</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.0001"
                    value={form.purchase_cost_parts ?? ""}
                    onChange={(e) => set("purchase_cost_parts", numOrNull(e.target.value))}
                    placeholder="0.00"
                    className="pl-6"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Costo Ariba</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.0001"
                    value={form.purchase_cost_ariba ?? ""}
                    onChange={(e) => set("purchase_cost_ariba", numOrNull(e.target.value))}
                    placeholder="0.00"
                    className="pl-6"
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Adjuntos / URLs */}
          <SectionCard icon={ImageIcon} title="Imagen y documentos">
            <div className="space-y-1.5">
              <Label>URL de imagen</Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={form.image_url ?? ""}
                  onChange={(e) => set("image_url", e.target.value)}
                  placeholder="https://example.com/imagen-producto.jpg"
                  className="flex-1"
                />
                {form.image_url && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => set("image_url", "")}
                    title="Limpiar imagen"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {form.image_url ? (
                <div className="mt-2 inline-block rounded-[var(--radius-md)] border border-border bg-background p-2">
                  <img
                    src={form.image_url}
                    alt="Vista previa"
                    className="h-32 w-32 rounded-md object-cover"
                    onError={(e) => {
                      const target = e.currentTarget
                      target.style.display = "none"
                      target.parentElement!.innerHTML = `<div class="flex h-32 w-32 items-center justify-center text-muted-foreground text-xs">Error al cargar</div>`
                    }}
                  />
                </div>
              ) : (
                <div className="mt-2 flex h-32 w-32 flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border bg-accent/20 text-muted-foreground">
                  <ImageIcon className="h-8 w-8 mb-1 opacity-40" />
                  <span className="text-[10px]">Sin imagen</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>URL ficha técnica / documento</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="url"
                  value={form.datasheet_url ?? ""}
                  onChange={(e) => set("datasheet_url", e.target.value)}
                  placeholder="https://example.com/ficha-tecnica.pdf"
                  className="pl-8"
                />
              </div>
            </div>
          </SectionCard>

          {/* Atributos adicionales */}
          <SectionCard icon={Boxes} title="Atributos adicionales">
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-3">
                <SwitchField
                  checked={!!form.is_configurable}
                  onChange={(v) => set("is_configurable", v)}
                  label="Configurable"
                />
                <span className="text-sm text-muted-foreground">Producto configurable</span>
              </div>
              <div className="flex items-center gap-3">
                <SwitchField
                  checked={!!form.is_assembled}
                  onChange={(v) => set("is_assembled", v)}
                  label="Ensamblado"
                />
                <span className="text-sm text-muted-foreground">Producto ensamblado</span>
              </div>
            </div>
          </SectionCard>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} size="lg">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear producto"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs py-1 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium truncate text-right">{value}</span>
    </div>
  )
}

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
    <div className="surface-card border-white/70 overflow-hidden">
      {/* Image header */}
      <div className="relative h-48 w-full bg-accent/30">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-contain p-4"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground/50">
            <Package className="h-12 w-12 mb-2" />
            <span className="text-xs">Sin imagen</span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <StatusChip status={product.status} />
        </div>
        <div className="absolute top-3 right-3 flex gap-1">
          <Button size="sm" variant="secondary" className="h-8 gap-1 text-xs" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
            Editar
          </Button>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm hover:bg-background hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4 p-5">
        {/* Title */}
        <div className="space-y-1">
          <h3 className="text-base font-semibold leading-tight">{product.name}</h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono">{product.sku ?? "Sin SKU"}</span>
            {product.internal_code && (
              <>
                <span className="text-border">·</span>
                <span>{product.internal_code}</span>
              </>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {product.category && (
            <Badge variant="secondary" className="text-[11px]">
              <FolderOpen className="h-3 w-3 mr-1" />
              {product.category}
            </Badge>
          )}
          {product.brand && (
            <Badge variant="outline" className="text-[11px]">
              <Building2 className="h-3 w-3 mr-1" />
              {product.brand}
            </Badge>
          )}
          {product.sale_type && (
            <Badge variant="outline" className="text-[11px]">
              <Tag className="h-3 w-3 mr-1" />
              {product.sale_type}
            </Badge>
          )}
        </div>

        {/* Description */}
        {product.description && (
          <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3">
            {product.description}
          </p>
        )}

        {/* Info general */}
        <DetailSection icon={FolderOpen} title="Información general">
          <DetailRow label="Categoría" value={product.category ?? "—"} />
          <DetailRow label="Marca" value={product.brand ?? "—"} />
          <DetailRow label="Tipo venta" value={product.sale_type ?? "—"} />
          <DetailRow label="Ubicación" value={product.warehouse_location ?? "—"} />
        </DetailSection>

        {/* Precios */}
        <DetailSection icon={Banknote} title="Precios y costos">
          <DetailRow label="Precio unitario" value={fmtPrice(product.unit_price)} />
          <DetailRow label="Precio sugerido" value={fmtPrice(product.suggested_price)} />
          <DetailRow label="Costo refacciones" value={fmtPrice(product.purchase_cost_parts)} />
          <DetailRow label="Costo Ariba" value={fmtPrice(product.purchase_cost_ariba)} />
        </DetailSection>

        {/* Demanda */}
        <DetailSection icon={Boxes} title="Demanda e inventario">
          <DetailRow label="Demanda 90 días" value={product.demand_90_days?.toString() ?? "—"} />
          <DetailRow label="Demanda 180 días" value={product.demand_180_days?.toString() ?? "—"} />
          <DetailRow label="Total venta acum." value={fmtPrice(product.total_accumulated_sales)} />
          <DetailRow label="Última salida" value={product.last_outbound_date ?? "—"} />
        </DetailSection>

        {/* Links */}
        {(product.image_url || product.datasheet_url) && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {product.image_url && (
              <a
                href={product.image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-accent/30 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                <ImageIcon className="h-3.5 w-3.5 text-primary" />
                Ver imagen
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            )}
            {product.datasheet_url && (
              <a
                href={product.datasheet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-accent/30 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                Ficha técnica
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
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
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await productosService.deleteProduct(token, product.id)
      toast.success("Producto eliminado")
      onDeleted()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 surface-card w-full max-w-sm overflow-hidden">
        <div className="flex flex-col items-center p-6 pb-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400 mb-3">
            <Trash2 className="h-6 w-6" />
          </div>
          <p className="text-base font-semibold">Eliminar producto</p>
          <p className="text-sm text-muted-foreground mt-1">
            ¿Estás seguro de eliminar{" "}
            <span className="font-medium text-foreground">{product.name}</span>?
          </p>
          <p className="text-xs text-muted-foreground mt-1">Esta acción no se puede deshacer.</p>
        </div>
        <div className="flex justify-end gap-2 p-4 pt-0">
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar
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
        <div className="relative h-40 w-full bg-accent/30 rounded-t-[var(--radius-lg)] overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-contain p-2"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
          <div className="absolute top-2 right-2">
            <StatusChip status={product.status} />
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{product.name}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground font-mono">
              {product.sku ?? "Sin SKU"}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
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

          <div className="flex items-end justify-between pt-1">
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
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
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
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <FileText className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              onClick={onEdit}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="rounded p-1.5 text-muted-foreground hover:bg-red-500/15 hover:text-red-400"
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

// ── Main page ─────────────────────────────────────────────────────────────────

type ActiveModal =
  | { type: "create" }
  | { type: "edit"; product: ProductRead }
  | { type: "delete"; product: ProductRead }

export function ProductosCatalogoPage() {
  const token = useAuthStore((s) => s.accessToken)

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<"activos" | "todos">("activos")
  const [filterCategory, setFilterCategory] = useState<string>("")
  const [filterBrand, setFilterBrand] = useState<string>("")
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [selectedProduct, setSelectedProduct] = useState<ProductRead | null>(null)
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const productsFetcher = useCallback(
    (signal: AbortSignal) =>
      productosService.listProducts(
        token,
        {
          limit: 500,
          solo_activos: filterStatus === "activos",
          search: debouncedSearch || undefined,
          category_id: filterCategory || undefined,
          brand_id: filterBrand || undefined,
        },
        signal,
      ),
    [token, filterStatus, debouncedSearch, filterCategory, filterBrand, refreshKey], // eslint-disable-line react-hooks/exhaustive-deps
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
  const isLoading = productsStatus === "loading"

  const flatCats = flattenCategories(categories ?? [])

  const activeFiltersCount = [
    filterStatus !== "activos",
    !!filterCategory,
    !!filterBrand,
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
          <Button onClick={() => setActiveModal({ type: "create" })} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo producto
          </Button>
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
      <div className={cn("flex min-h-0 flex-1 gap-4", selectedProduct ? "items-start" : "")}>
        <div className={cn("flex-1 min-w-0", selectedProduct ? "max-w-[calc(100%-320px)]" : "")}>
          {viewMode === "table" ? (
            <DataTable
              columns={COLUMNS}
              rows={rows}
              rowKey={(r) => r.id}
              emptyLabel={
                isLoading
                  ? "Cargando productos…"
                  : debouncedSearch || filterCategory || filterBrand
                    ? `Sin resultados para los filtros aplicados`
                    : "No hay productos en el catálogo"
              }
              onRowClick={(r) =>
                setSelectedProduct((prev) => (prev?.id === r.id ? null : r))
              }
              selectedRowKey={selectedProduct?.id}
              maxHeight="calc(100vh - 380px)"
            />
          ) : (
            /* Grid view */
            <div className="overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 380px)" }}>
              {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Package className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">
                    {isLoading
                      ? "Cargando productos…"
                      : debouncedSearch || filterCategory || filterBrand
                        ? "Sin resultados para los filtros aplicados"
                        : "No hay productos en el catálogo"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
          )}
        </div>

        {selectedProduct && (
          <div className="w-[300px] shrink-0">
            <ProductDetailPanel
              product={selectedProduct}
              onClose={() => setSelectedProduct(null)}
              onEdit={() => {
                setActiveModal({ type: "edit", product: selectedProduct })
              }}
            />
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
    </div>
  )
}
