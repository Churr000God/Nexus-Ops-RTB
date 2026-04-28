import { requestJson } from "@/lib/http"
import type { AuditLogPage, AuditLogParams, Permission, Role } from "@/types/admin"
import type { User } from "@/types/auth"

export const adminService = {
  listUsers(token: string | null, signal?: AbortSignal) {
    return requestJson<User[]>("/api/usuarios", { token, signal })
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
}
