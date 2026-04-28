export type Permission = {
  permission_id: number
  code: string
  description: string | null
}

export type Role = {
  role_id: number
  code: string
  name: string
  description: string | null
  permissions: Permission[]
}

export type AuditLogEntry = {
  audit_id: number
  user_id: string | null
  entity_type: string
  entity_id: string
  action: "INSERT" | "UPDATE" | "DELETE"
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  changed_at: string
}

export type AuditLogPage = {
  items: AuditLogEntry[]
  total: number
}

export type AuditLogParams = {
  entity_type?: string
  entity_id?: string
  user_id?: string
  from_date?: string
  to_date?: string
  offset?: number
  limit?: number
}
