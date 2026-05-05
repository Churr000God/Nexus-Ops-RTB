import { useEffect, useRef, useState } from "react"
import { Search, UserCheck, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { assetsService } from "@/services/assetsService"
import { adminService } from "@/services/adminService"
import { useAuthStore } from "@/stores/authStore"
import type { AssetRead } from "@/types/assets"
import type { User } from "@/types/auth"

interface AssignAssetModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  asset: AssetRead
}

export function AssignAssetModal({ open, onClose, onSuccess, asset }: AssignAssetModalProps) {
  const token = useAuthStore((s) => s.accessToken)
  const [selectedUserId, setSelectedUserId] = useState<string>("__none__")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setSelectedUserId(asset.assigned_user_id ?? "__none__")
      setSelectedUser(null)
      setSearch("")
      setResults([])
      setLocation(asset.location ?? "")
      setNotes("")
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [open, asset])

  useEffect(() => {
    if (!search.trim() || selectedUser) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await adminService.searchUsers(token, search.trim())
        setResults(res)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [search, selectedUser, token])

  if (!open) return null

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
      : (selectedUser?.full_name ?? "Usuario")

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

          {/* User search */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Asignar a *
            </label>
            {selectedUserId !== "__none__" && selectedUser ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-accent/20 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{selectedUser.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedUser(null); setSelectedUserId("__none__"); setSearch(""); setTimeout(() => searchRef.current?.focus(), 50) }}
                  className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar usuario por nombre o email…"
                />
                {(results.length > 0 || searching) && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-border bg-background shadow-lg">
                    {searching ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Buscando…</p>
                    ) : (
                      results.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-accent"
                          onClick={() => { setSelectedUser(u); setSelectedUserId(u.id); setSearch("") }}
                        >
                          <p className="text-sm font-medium text-foreground">{u.full_name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            {selectedUserId === "__none__" && !selectedUser && (
              <p className="text-[11px] text-muted-foreground">
                Escribe para buscar un usuario activo, o deja vacío para desasignar.
              </p>
            )}
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
