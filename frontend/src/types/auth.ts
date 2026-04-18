export type UserRole = "operativo" | "admin" | "viewer"

export type User = {
  id: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
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
