import { useAuthStore } from "@/stores/authStore"

export function usePermission(code: string): boolean {
  const user = useAuthStore((s) => s.user)
  return user?.permissions?.includes(code) ?? false
}
