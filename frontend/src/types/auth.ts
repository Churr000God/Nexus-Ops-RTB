export type UserRole = "operativo" | "admin" | "viewer"

export type User = {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  last_login_at: string | null
  created_at: string
  roles: string[]
  permissions: string[]
}

export type LoginRequest = {
  email: string
  password: string
}

export type TokenResponse = {
  access_token: string
}

export type RefreshResponse = {
  access_token: string
}
