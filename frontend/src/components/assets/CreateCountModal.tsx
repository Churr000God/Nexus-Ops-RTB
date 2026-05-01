import { useState } from "react"
import { ClipboardList, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { assetsService } from "@/services/assetsService"
import { useAuthStore } from "@/stores/authStore"
import type { PhysicalCountRead } from "@/types/assets"

interface CreateCountModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (count: PhysicalCountRead) => void
}

export function CreateCountModal({ open, onClose, onSuccess }: CreateCountModalProps) {
  const token = useAuthStore((s) => s.accessToken)
  const today = new Date().toISOString().split("T")[0]
  const [date, setDate] = useState(today)
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
        location_filter: location.trim() || null,
        notes: notes.trim() || null,
      })
      toast.success(`Conteo creado con ${count.total_lines} activos`)
      onSuccess(count)
      onClose()
      setLocation("")
      setNotes("")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear conteo"
      toast.error(msg)
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

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Filtro de ubicación
              <span className="ml-1 text-muted-foreground/60">(opcional — deja vacío para todos)</span>
            </label>
            <input
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Oficina, Bodega, Planta…"
            />
          </div>

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
            Se generará una línea por cada activo activo
            {location.trim() ? ` en ubicaciones que coincidan con "${location.trim()}"` : ""}.
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
