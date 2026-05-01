import { useCallback, useEffect, useState } from "react"
import { UserCheck, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/useApi"
import { assetsService } from "@/services/assetsService"
import { adminService } from "@/services/adminService"
import { useAuthStore } from "@/stores/authStore"
import type { AssetRead } from "@/types/assets"

interface AssignAssetModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  asset: AssetRead
}

export function AssignAssetModal({ open, onClose, onSuccess, asset }: AssignAssetModalProps) {
  const token = useAuthStore((s) => s.accessToken)
  const [selectedUserId, setSelectedUserId] = useState<string>("__none__")
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const usersFetcher = useCallback(
    (signal: AbortSignal) => adminService.listUsers(token, signal),
    [token],
  )
  const { data: users } = useApi(usersFetcher)

  useEffect(() => {
    if (open) {
      setSelectedUserId(asset.assigned_user_id ?? "__none__")
      setLocation(asset.location ?? "")
      setNotes("")
    }
  }, [open, asset])

  if (!open) return null

  const activeUsers = (users ?? []).filter((u) => u.is_active)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await assetsService.assignAsset(token, asset.id, {
        user_id: selectedUserId === "__none__" ? null : selectedUserId,
        location: location.trim() || null,
        notes: notes.trim() || null,
      })
      toast.success("Asignación registrada")
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrar asignación"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const currentUserName =
    selectedUserId === "__none__"
      ? "Sin asignar"
      : (activeUsers.find((u) => u.id === selectedUserId)?.full_name ?? "Usuario")

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="surface-card w-full max-w-md">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-[hsl(var(--primary))]" />
            <h2 className="text-base font-semibold text-foreground">Reasignar Activo</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Asset info */}
          <div className="rounded-md border border-border bg-accent/10 px-4 py-3">
            <p className="text-sm font-medium text-foreground">{asset.name}</p>
            <p className="text-xs text-muted-foreground">
              {asset.asset_code}
              {asset.location ? ` · ${asset.location}` : ""}
            </p>
          </div>

          {/* User select */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Asignar a *
            </label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="__none__">Sin asignar</option>
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Ubicación</label>
            <input
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Oficina, Almacén, Sala de servidores…"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Motivo / Notas</label>
            <textarea
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motivo de reasignación, cambio de área…"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Se registrará el historial: <strong>{currentUserName}</strong>
            {location ? ` · ${location}` : ""}
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Confirmar Asignación"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
