import type { ReactNode } from "react"

import { usePermission } from "@/hooks/usePermission"

type Props = {
  permission: string
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGate({ permission, children, fallback = null }: Props) {
  const allowed = usePermission(permission)
  return allowed ? <>{children}</> : <>{fallback}</>
}
