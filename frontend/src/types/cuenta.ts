export type UpdateProfileRequest = {
  full_name: string
}

export type ChangeOwnPasswordRequest = {
  current_password: string
  new_password: string
}

export type SessionInfo = {
  id: string
  user_agent: string | null
  ip_address: string | null
  created_at: string
  last_used_at: string | null
  is_current: boolean
}
