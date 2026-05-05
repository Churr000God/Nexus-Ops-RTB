import { requestJson } from "@/lib/http"
import type { AuditLogPage, AuditLogParams, Permission, Role } from "@/types/admin"
import type { User } from "@/types/auth"

export type CreateUserPayload = {
  email: string
  full_name: string
  password: string
  role: "admin" | "operativo" | "lectura"
}

export type UpdateUserPayload = {
  full_name?: string
  is_active?: boolean
}

export type CreateRolePayload = {
  code: string
  name: string
  description?: string
  permission_codes: string[]
}

export const adminService = {
  listUsers(token: string | null, signal?: AbortSignal) {
    return requestJson<User[]>("/api/usuarios", { token, signal })
  },

  searchUsers(token: string | null, query: string, signal?: AbortSignal) {
    const qs = new URLSearchParams()
    qs.set("q", query)
    qs.set("limit", "10")
    return requestJson<User[]>(`/api/usuarios/search?${qs.toString()}`, { token, signal })
  },

  listRoles(token: string | null, signal?: AbortSignal) {
    return requestJson<Role[]>("/api/admin/roles", { token, signal })
  },

  listPermissions(token: string | null, signal?: AbortSignal) {
    return requestJson<Permission[]>("/api/admin/permissions", { token, signal })
  },

  listAuditLog(token: string | null, params: AuditLogParams = {}, signal?: AbortSignal) {
    const qs = new URLSearchParams()
    if (params.entity_type) qs.set("entity_type", params.entity_type)
    if (params.entity_id) qs.set("entity_id", params.entity_id)
    if (params.user_id) qs.set("user_id", params.user_id)
    if (params.from_date) qs.set("from_date", params.from_date)
    if (params.to_date) qs.set("to_date", params.to_date)
    if (params.offset != null) qs.set("offset", String(params.offset))
    if (params.limit != null) qs.set("limit", String(params.limit))
    const query = qs.toString()
    return requestJson<AuditLogPage>(
      `/api/admin/audit-log${query ? `?${query}` : ""}`,
      { token, signal }
    )
  },

  createRole(token: string | null, payload: CreateRolePayload) {
    return requestJson<Role>("/api/admin/roles", {
      method: "POST",
      body: payload,
      token,
    })
  },

  createUser(token: string | null, payload: CreateUserPayload) {
    return requestJson<User>("/api/usuarios", {
      method: "POST",
      body: payload,
      token,
    })
  },

  updateUser(token: string | null, userId: string, payload: UpdateUserPayload) {
    return requestJson<User>(`/api/usuarios/${userId}`, {
      method: "PATCH",
      body: payload,
      token,
    })
  },

  changePassword(token: string | null, userId: string, newPassword: string) {
    return requestJson<void>(`/api/usuarios/${userId}/password`, {
      method: "PATCH",
      body: { new_password: newPassword },
      token,
    })
  },

  assignRole(token: string | null, userId: string, roleCode: string) {
    return requestJson<User>(`/api/usuarios/${userId}/roles`, {
      method: "POST",
      body: { role_code: roleCode },
      token,
    })
  },

  revokeRole(token: string | null, userId: string, roleCode: string) {
    return requestJson<void>(`/api/usuarios/${userId}/roles/${roleCode}`, {
      method: "DELETE",
      token,
    })
  },

  updateRolePermissions(token: string | null, roleId: number, permissionCodes: string[]) {
    return requestJson<Role>(`/api/admin/roles/${roleId}/permissions`, {
      method: "PUT",
      body: { permission_codes: permissionCodes },
      token,
    })
  },
}
