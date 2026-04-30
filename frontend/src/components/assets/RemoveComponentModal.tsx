import { useEffect, useState } from "react"
import { AlertTriangle, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { assetsService } from "@/services/assetsService"
import { useAuthStore } from "@/stores/authStore"
import type { AssetComponentDetail } from "@/types/assets"

interface RemoveComponentModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  assetId: string
  component: AssetComponentDetail | null
}

export function RemoveComponentModal({
  open,
  onClose,
  onSuccess,
  assetId,
  component,
}: RemoveComponentModalProps) {
  const token = useAuthStore((s) => s.accessToken)
  const [isReusable, setIsReusable] = useState(true)
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setIsReusable(true)
      setReason("")
      setNotes("")
    }
  }, [open])

  if (!open || !component) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!component) return
    setSaving(true)
    try {
      await assetsService.removeComponent(token, assetId, component.asset_component_id, {
        is_reusable: isReusable,
        reason: reason.trim() || null,
        notes: notes.trim() || null,
      })
      toast.success(
        isReusable
          ? "Componente removido y regresado al stock"
          : "Componente removido — se generó una No Conformidad",
      )
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al remover componente"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="surface-card w-full max-w-md">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Remover Componente</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Component info */}
          <div className="rounded-md border border-border bg-accent/10 px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              {component.component_name ?? "Componente sin nombre"}
            </p>
            <p className="text-xs text-muted-foreground">
              SKU: {component.component_sku ?? "—"} · S/N: {component.serial_number ?? "—"} · Qty:{" "}
              {component.quantity}
            </p>
          </div>

          {/* Reusable / Defective choice */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Estado del componente</label>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-accent/10">
                <input
                  type="radio"
                  name="reusable"
                  className="mt-0.5"
                  checked={isReusable}
                  onChange={() => setIsReusable(true)}
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Reutilizable</p>
                  <p className="text-xs text-muted-foreground">
                    Regresa al stock de inventario disponible
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 hover:bg-amber-500/10">
                <input
                  type="radio"
                  name="reusable"
                  className="mt-0.5"
                  checked={!isReusable}
                  onChange={() => setIsReusable(false)}
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <p className="text-sm font-medium text-foreground">Defectuosa / Dada de baja</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se genera un registro de No Conformidad automáticamente
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Motivo de remoción</label>
            <input
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Actualización, falla, mantenimiento…"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Notas adicionales</label>
            <textarea
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant={isReusable ? "default" : "destructive"} disabled={saving}>
              {saving ? "Removiendo…" : "Confirmar Remoción"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
