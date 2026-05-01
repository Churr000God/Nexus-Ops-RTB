import { useState } from "react"
import { AlertTriangle, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { assetsService } from "@/services/assetsService"
import { useAuthStore } from "@/stores/authStore"
import type { AssetRead } from "@/types/assets"

interface RetireAssetModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (updated: AssetRead) => void
  asset: AssetRead
}

export function RetireAssetModal({ open, onClose, onSuccess, asset }: RetireAssetModalProps) {
  const token = useAuthStore((s) => s.accessToken)
  const [reason, setReason] = useState("")
  const [salvage, setSalvage] = useState("")
  const [saving, setSaving] = useState(false)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await assetsService.retireAsset(token, asset.id, {
        retirement_reason: reason.trim() || null,
        salvage_value: salvage !== "" ? parseFloat(salvage) : null,
      })
      toast.success("Activo dado de baja correctamente")
      onSuccess(updated)
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al dar de baja"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    if (!saving) {
      setReason("")
      setSalvage("")
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="surface-card w-full max-w-md">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="text-base font-semibold text-foreground">Dar de Baja Activo</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Asset info */}
          <div className="rounded-md border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-sm font-medium text-foreground">{asset.name}</p>
            <p className="text-xs text-muted-foreground">
              {asset.asset_code}
              {asset.serial_number ? ` · S/N ${asset.serial_number}` : ""}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            El activo pasará a estado <strong className="text-red-500">RETIRADO</strong> y no
            podrá volver a operar. Esta acción queda registrada en el historial.
          </p>

          {/* Motivo */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Motivo de baja
            </label>
            <textarea
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Fin de vida útil, daño irreparable, obsolescencia…"
            />
          </div>

          {/* Valor residual */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Valor residual / Salvamento (MXN)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={salvage}
              onChange={(e) => setSalvage(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={saving}>
              {saving ? "Procesando…" : "Confirmar Baja"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
