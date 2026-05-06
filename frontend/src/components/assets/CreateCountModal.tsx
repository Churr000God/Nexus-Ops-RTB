import { useState } from "react"
import { ClipboardList, Package, Wrench, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { assetsService } from "@/services/assetsService"
import { useAuthStore } from "@/stores/authStore"
import { cn } from "@/lib/utils"
import type { PhysicalCountRead } from "@/types/assets"

interface CreateCountModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (count: PhysicalCountRead) => void
}

const COUNT_TYPES = [
  {
    value: "PRODUCT" as const,
    label: "Inventario de productos",
    description: "SKUs vendibles e internos — registra cantidad contada por producto",
    icon: Package,
  },
  {
    value: "ASSET" as const,
    label: "Activos físicos",
    description: "Equipos, laptops, herramientas — marca encontrado / no encontrado",
    icon: Wrench,
  },
]

export function CreateCountModal({ open, onClose, onSuccess }: CreateCountModalProps) {
  const token = useAuthStore((s) => s.accessToken)
  const today = new Date().toISOString().split("T")[0]
  const [date, setDate] = useState(today)
  const [countType, setCountType] = useState<"ASSET" | "PRODUCT">("PRODUCT")
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const count = await assetsService.createCount(token, {
        count_date: date,
        count_type: countType,
        location_filter: countType === "ASSET" && location.trim() ? location.trim() : null,
        notes: notes.trim() || null,
      })
      const qty = count.total_lines
      const label = countType === "ASSET" ? "activos" : "productos"
      toast.success(`Conteo creado con ${qty} ${label}`)
      onSuccess(count)
      onClose()
      setLocation("")
      setNotes("")
      setCountType("PRODUCT")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al crear conteo")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="surface-card w-full max-w-md">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[hsl(var(--primary))]" />
            <h2 className="text-base font-semibold text-foreground">Nuevo Conteo Físico</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Tipo de conteo */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Tipo de conteo *</label>
            <div className="grid grid-cols-2 gap-2">
              {COUNT_TYPES.map(({ value, label, description, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCountType(value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                    countType === value
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs font-semibold">{label}</span>
                  </div>
                  <span className="text-[10px] leading-tight opacity-75">{description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Fecha */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Fecha del conteo *</label>
            <input
              type="date"
              required
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Filtro de ubicación — solo para activos */}
          {countType === "ASSET" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Filtro de ubicación
                <span className="ml-1 text-muted-foreground/60">(opcional)</span>
              </label>
              <input
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Oficina, Bodega, Planta…"
              />
            </div>
          )}

          {/* Notas */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Notas</label>
            <textarea
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Conteo anual, verificación de área…"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {countType === "ASSET"
              ? `Se generará una línea por cada equipo activo${location.trim() ? ` en ubicaciones que coincidan con "${location.trim()}"` : ""}.`
              : "Se generará una línea por cada SKU con su stock real y teórico al momento del conteo."}
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creando…" : "Crear Conteo"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
