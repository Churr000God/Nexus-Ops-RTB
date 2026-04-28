import { useCallback, useState } from "react"
import {
  CheckCircle2,
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
import { useApi } from "@/hooks/useApi"
import { usePermission } from "@/hooks/usePermission"
import { adminService } from "@/services/adminService"
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

export function AdminUsuariosPage() {
  const token = useAuthStore((s) => s.accessToken)
  const canView = usePermission("user.view")
  const canManage = usePermission("role.manage")

  const [selectedUser, setSelectedUser] = useState<User | null>(null)

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
    useApi(fetchRoles, { enabled: canManage })

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
    ...(canManage
      ? ([
          {
            key: "actions",
            header: "",
            cell: (u: User) => (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUser(u)}
                disabled={rolesStatus !== "success"}
                className="h-7 gap-1.5 text-xs"
              >
                <Shield className="h-3 w-3" />
                Roles
              </Button>
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
          <span className="text-sm font-medium text-muted-foreground">
            {users != null
              ? `${users.length} usuario${users.length !== 1 ? "s" : ""}`
              : "Usuarios"}
          </span>
        }
      />

      {selectedUser && roles && (
        <RoleModal
          user={selectedUser}
          roles={roles}
          token={token}
          onClose={() => setSelectedUser(null)}
          onUserUpdated={(updated) => {
            setSelectedUser(updated)
            refetchUsers()
          }}
        />
      )}
    </div>
  )
}
