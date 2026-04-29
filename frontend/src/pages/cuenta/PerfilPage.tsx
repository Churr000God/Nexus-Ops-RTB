import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn, formatIsoDate } from "@/lib/utils"
import { cuentaService } from "@/services/cuentaService"
import { useAuthStore } from "@/stores/authStore"

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "border-purple-500/30 bg-purple-500/15 text-purple-400",
  SALES: "border-blue-500/30 bg-blue-500/15 text-blue-400",
  PURCHASING: "border-orange-500/30 bg-orange-500/15 text-orange-400",
  WAREHOUSE: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
  ACCOUNTING: "border-cyan-500/30 bg-cyan-500/15 text-cyan-400",
  READ_ONLY: "border-border bg-muted/60 text-muted-foreground",
  DRIVER: "border-yellow-500/30 bg-yellow-500/15 text-yellow-400",
}

function RoleBadge({ code }: { code: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        ROLE_COLORS[code] ?? "border-border bg-muted/60 text-muted-foreground"
      )}
    >
      {code}
    </span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function PerfilPage() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.accessToken)
  const refreshUser = useAuthStore((s) => s.refreshUser)

  const [fullName, setFullName] = useState(user?.full_name ?? "")
  const [saving, setSaving] = useState(false)

  if (!user || !token) return null

  const isDirty = fullName.trim() !== user.full_name

  async function handleSave() {
    if (!isDirty || !token) return
    setSaving(true)
    try {
      await cuentaService.updateProfile(token, { full_name: fullName.trim() })
      await refreshUser()
      toast.success("Perfil actualizado")
    } catch {
      toast.error("No se pudo guardar el perfil")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">Información de la cuenta</h2>

        <Field label="Nombre completo">
          <div className="flex gap-2">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-8 text-sm"
              placeholder="Nombre completo"
            />
            <Button
              size="sm"
              disabled={!isDirty || saving}
              onClick={handleSave}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </Field>

        <Field label="Correo electrónico">
          <span className="text-sm text-muted-foreground">{user.email}</span>
        </Field>

        <Field label="Rol de acceso">
          <span className="text-sm capitalize text-muted-foreground">{user.role}</span>
        </Field>

        {user.roles.length > 0 && (
          <Field label="Roles RBAC">
            <div className="flex flex-wrap gap-1.5">
              {user.roles.map((r) => (
                <RoleBadge key={r} code={r} />
              ))}
            </div>
          </Field>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Actividad</h2>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Último acceso">
            <span className="text-sm text-muted-foreground">
              {user.last_login_at ? formatIsoDate(user.last_login_at) : "—"}
            </span>
          </Field>
          <Field label="Cuenta creada">
            <span className="text-sm text-muted-foreground">
              {formatIsoDate(user.created_at)}
            </span>
          </Field>
        </div>
      </div>
    </div>
  )
}
