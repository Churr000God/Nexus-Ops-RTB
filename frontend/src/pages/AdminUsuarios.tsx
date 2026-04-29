import { useCallback, useState } from "react"
import {
  CheckCircle2,
  ChevronDown,
  KeyRound,
  Pencil,
  Plus,
  Shield,
  Users,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { DataTable } from "@/components/common/DataTable"
import type { DataTableColumn } from "@/components/common/DataTable"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useApi } from "@/hooks/useApi"
import { usePermission } from "@/hooks/usePermission"
import { adminService } from "@/services/adminService"
import type { CreateUserPayload } from "@/services/adminService"
import { useAuthStore } from "@/stores/authStore"
import type { Role } from "@/types/admin"
import type { User } from "@/types/auth"
import { cn, formatIsoDate } from "@/lib/utils"

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "border-purple-500/30 bg-purple-500/15 text-purple-400",
  SALES: "border-blue-500/30 bg-blue-500/15 text-blue-400",
  PURCHASING: "border-orange-500/30 bg-orange-500/15 text-orange-400",
  WAREHOUSE: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
  ACCOUNTING: "border-cyan-500/30 bg-cyan-500/15 text-cyan-400",
  READ_ONLY: "border-border bg-muted/60 text-muted-foreground",
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

// ─── Validación cliente ───────────────────────────────────────────────────────

function validateEmail(email: string): string | null {
  const e = email.trim().toLowerCase()
  if (!e.includes("@")) return "Email inválido"
  const [local, domain] = e.split("@", 2)
  if (!local || !domain || !domain.includes(".")) return "Email inválido"
  return null
}

function validatePassword(password: string): string | null {
  if (password.length < 10) return "Mínimo 10 caracteres"
  if (new TextEncoder().encode(password).length > 72) return "Máximo 72 bytes"
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  if (!hasLetter || !hasDigit) return "Debe incluir letras y números"
  return null
}

// ─── Modal de creación ────────────────────────────────────────────────────────

type CreateUserModalProps = {
  token: string | null
  onClose: () => void
  onCreated: () => void
}

function CreateUserModal({ token, onClose, onCreated }: CreateUserModalProps) {
  const [form, setForm] = useState<CreateUserPayload>({
    email: "",
    full_name: "",
    password: "",
    role: "operativo",
  })
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  function set(field: keyof CreateUserPayload, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    const emailErr = validateEmail(form.email)
    if (emailErr) next.email = emailErr
    const pwErr = validatePassword(form.password)
    if (pwErr) next.password = pwErr
    if (form.password !== confirmPassword) next.confirmPassword = "Las contraseñas no coinciden"
    if (Object.keys(next).length > 0) {
      setErrors(next)
      return false
    }
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      await adminService.createUser(token, {
        ...form,
        email: form.email.trim().toLowerCase(),
        full_name: form.full_name.trim(),
      })
      toast.success(`Usuario ${form.email} creado`)
      onCreated()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear usuario"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 surface-card w-full max-w-md space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">Nuevo usuario</p>
            <p className="text-sm text-muted-foreground">Crear cuenta de acceso al sistema</p>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email *</label>
            <Input
              type="email"
              placeholder="usuario@empresa.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              disabled={submitting}
              autoFocus
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nombre completo</label>
            <Input
              placeholder="Nombre Apellido"
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Contraseña *</label>
            <Input
              type="password"
              placeholder="Mínimo 10 caracteres, letra + número"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              disabled={submitting}
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Confirmar contraseña *</label>
            <Input
              type="password"
              placeholder="Repetir contraseña"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setErrors((prev) => { const n = { ...prev }; delete n.confirmPassword; return n })
              }}
              disabled={submitting}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Rol legacy</label>
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              disabled={submitting}
              className="w-full rounded-[var(--radius-md)] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="operativo">Operativo</option>
              <option value="admin">Admin</option>
              <option value="lectura">Lectura</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              Los permisos reales se asignan mediante roles RBAC después de crear el usuario.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Creando…" : "Crear usuario"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal de edición ─────────────────────────────────────────────────────────

type EditUserModalProps = {
  user: User
  token: string | null
  currentUserRole: string
  onClose: () => void
  onUpdated: () => void
}

function EditUserModal({ user, token, currentUserRole, onClose, onUpdated }: EditUserModalProps) {
  const [fullName, setFullName] = useState(user.full_name)
  const [isActive, setIsActive] = useState(user.is_active)
  const [submitting, setSubmitting] = useState(false)

  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)

  const canChangePassword = currentUserRole === "admin" && user.role !== "admin"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await adminService.updateUser(token, user.id, {
        full_name: fullName.trim() || undefined,
        is_active: isActive,
      })
      toast.success("Usuario actualizado")
      onUpdated()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al actualizar usuario"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleChangePassword() {
    setPasswordError(null)
    const pwErr = validatePassword(newPassword)
    if (pwErr) { setPasswordError(pwErr); return }
    if (newPassword !== confirmPassword) { setPasswordError("Las contraseñas no coinciden"); return }
    setChangingPassword(true)
    try {
      await adminService.changePassword(token, user.id, newPassword)
      toast.success("Contraseña actualizada")
      setShowPasswordSection(false)
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cambiar contraseña"
      toast.error(msg)
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 surface-card w-full max-w-sm space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold">Editar usuario</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nombre completo</label>
            <Input
              placeholder="Nombre Apellido"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between rounded-[var(--radius-md)] border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Estado de la cuenta</p>
              <p className="text-xs text-muted-foreground">
                {isActive ? "El usuario puede iniciar sesión" : "El usuario no puede acceder"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive((v) => !v)}
              disabled={submitting}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                isActive ? "bg-emerald-500" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                  isActive ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </form>

        {canChangePassword && (
          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setShowPasswordSection((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5" />
                Cambiar contraseña
              </span>
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", showPasswordSection && "rotate-180")}
              />
            </button>

            {showPasswordSection && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nueva contraseña</label>
                  <Input
                    type="password"
                    placeholder="Mínimo 10 caracteres, letra + número"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPasswordError(null) }}
                    disabled={changingPassword}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Confirmar contraseña</label>
                  <Input
                    type="password"
                    placeholder="Repetir contraseña"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(null) }}
                    disabled={changingPassword}
                  />
                </div>
                {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleChangePassword}
                    disabled={changingPassword || !newPassword || !confirmPassword}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <KeyRound className="h-3 w-3" />
                    {changingPassword ? "Actualizando…" : "Actualizar contraseña"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Modal de roles RBAC ──────────────────────────────────────────────────────

type RoleModalProps = {
  user: User
  roles: Role[]
  token: string | null
  onClose: () => void
  onUserUpdated: (updated: User) => void
}

function RoleModal({ user, roles, token, onClose, onUserUpdated }: RoleModalProps) {
  const [submitting, setSubmitting] = useState<string | null>(null)

  const assignedCodes = new Set(user.roles)
  const assignedRoles = roles.filter((r) => assignedCodes.has(r.code))
  const availableRoles = roles.filter((r) => !assignedCodes.has(r.code))

  async function handleAssign(code: string) {
    setSubmitting(code)
    try {
      await adminService.assignRole(token, user.id, code)
      toast.success(`Rol ${code} asignado`)
      onUserUpdated({ ...user, roles: [...user.roles, code] })
    } catch {
      toast.error("Error al asignar rol")
    } finally {
      setSubmitting(null)
    }
  }

  async function handleRevoke(code: string) {
    setSubmitting(code)
    try {
      await adminService.revokeRole(token, user.id, code)
      toast.success(`Rol ${code} revocado`)
      onUserUpdated({ ...user, roles: user.roles.filter((r) => r !== code) })
    } catch {
      toast.error("Error al revocar rol")
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 surface-card w-full max-w-sm space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">
              {user.full_name || user.email}
            </p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Roles activos
          </p>
          {assignedRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin roles asignados</p>
          ) : (
            <div className="flex flex-col gap-2">
              {assignedRoles.map((r) => (
                <div
                  key={r.code}
                  className="flex items-center justify-between rounded-[var(--radius-md)] border bg-accent/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <RoleBadge code={r.code} />
                    <span className="text-xs text-muted-foreground">{r.name}</span>
                  </div>
                  <button
                    onClick={() => handleRevoke(r.code)}
                    disabled={submitting === r.code}
                    className="rounded p-1 text-destructive/70 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    title={`Revocar ${r.code}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {availableRoles.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Asignar rol
            </p>
            <div className="flex flex-col gap-2">
              {availableRoles.map((r) => (
                <div
                  key={r.code}
                  className="flex items-center justify-between rounded-[var(--radius-md)] border border-dashed px-3 py-2 text-muted-foreground"
                >
                  <div className="flex items-center gap-2">
                    <RoleBadge code={r.code} />
                    <span className="text-xs">{r.name}</span>
                  </div>
                  <button
                    onClick={() => handleAssign(r.code)}
                    disabled={submitting === r.code}
                    className="rounded p-1 text-primary/70 hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                    title={`Asignar ${r.code}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

type ActiveModal =
  | { type: "create" }
  | { type: "edit"; user: User }
  | { type: "roles"; user: User }

export function AdminUsuariosPage() {
  const token = useAuthStore((s) => s.accessToken)
  const currentUser = useAuthStore((s) => s.user)
  const canView = usePermission("user.view")
  const canManage = usePermission("user.manage")
  const canManageRoles = usePermission("role.manage")

  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null)

  const fetchUsers = useCallback(
    (signal: AbortSignal) => adminService.listUsers(token, signal),
    [token]
  )
  const fetchRoles = useCallback(
    (signal: AbortSignal) => adminService.listRoles(token, signal),
    [token]
  )

  const { data: users, status: usersStatus, error: usersError, refetch: refetchUsers } =
    useApi(fetchUsers, { enabled: canView })

  const { data: roles, status: rolesStatus } =
    useApi(fetchRoles, { enabled: canManageRoles })

  const columns: DataTableColumn<User>[] = [
    {
      key: "email",
      header: "Email",
      cell: (u) => <span className="font-medium">{u.email}</span>,
    },
    {
      key: "full_name",
      header: "Nombre",
      cell: (u) => (
        <span className="text-muted-foreground">{u.full_name || "—"}</span>
      ),
    },
    {
      key: "roles",
      header: "Roles RBAC",
      cell: (u) =>
        u.roles.length === 0 ? (
          <span className="text-xs text-muted-foreground">Sin roles</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {u.roles.map((r) => (
              <RoleBadge key={r} code={r} />
            ))}
          </div>
        ),
    },
    {
      key: "is_active",
      header: "Estado",
      cell: (u) => (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            u.is_active
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
              : "border-red-500/30 bg-red-500/15 text-red-400"
          )}
        >
          {u.is_active ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {u.is_active ? "Activo" : "Inactivo"}
        </span>
      ),
    },
    {
      key: "last_login",
      header: "Último acceso",
      cell: (u) => (
        <span className="text-muted-foreground">
          {u.last_login_at ? formatIsoDate(u.last_login_at) : "—"}
        </span>
      ),
    },
    ...((canManage || canManageRoles)
      ? ([
          {
            key: "actions",
            header: "",
            cell: (u: User) => (
              <div className="flex items-center gap-1.5">
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveModal({ type: "edit", user: u })}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Button>
                )}
                {canManageRoles && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveModal({ type: "roles", user: u })}
                    disabled={rolesStatus !== "success"}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <Shield className="h-3 w-3" />
                    Roles
                  </Button>
                )}
              </div>
            ),
          },
        ] as DataTableColumn<User>[])
      : []),
  ]

  if (!canView) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Sin acceso</AlertTitle>
          <AlertDescription>No tienes permiso para ver usuarios.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Usuarios del sistema y asignación de roles
          </p>
        </div>
      </div>

      {usersError && (
        <Alert variant="destructive">
          <AlertTitle>Error al cargar usuarios</AlertTitle>
          <AlertDescription>{usersError.message}</AlertDescription>
        </Alert>
      )}

      <DataTable
        columns={columns}
        rows={users ?? []}
        rowKey={(u) => u.id}
        emptyLabel={
          usersStatus === "loading" ? "Cargando usuarios…" : "No hay usuarios registrados"
        }
        toolbar={
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">
              {users != null
                ? `${users.length} usuario${users.length !== 1 ? "s" : ""}`
                : "Usuarios"}
            </span>
            {canManage && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setActiveModal({ type: "create" })}
              >
                <Plus className="h-3.5 w-3.5" />
                Nuevo usuario
              </Button>
            )}
          </div>
        }
      />

      {activeModal?.type === "create" && (
        <CreateUserModal
          token={token}
          onClose={() => setActiveModal(null)}
          onCreated={refetchUsers}
        />
      )}

      {activeModal?.type === "edit" && (
        <EditUserModal
          user={activeModal.user}
          token={token}
          currentUserRole={currentUser?.role ?? ""}
          onClose={() => setActiveModal(null)}
          onUpdated={refetchUsers}
        />
      )}

      {activeModal?.type === "roles" && roles && (
        <RoleModal
          user={activeModal.user}
          roles={roles}
          token={token}
          onClose={() => setActiveModal(null)}
          onUserUpdated={(updated) => {
            setActiveModal({ type: "roles", user: updated })
            refetchUsers()
          }}
        />
      )}
    </div>
  )
}
