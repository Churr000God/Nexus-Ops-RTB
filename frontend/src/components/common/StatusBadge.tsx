import type { HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

export type StatusBadgeVariant = "success" | "warning" | "error" | "info" | "neutral"

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: StatusBadgeVariant
  dot?: boolean
}

const variantClasses: Record<StatusBadgeVariant, string> = {
  success: "bg-[hsl(var(--success)_/_0.10)] text-[hsl(var(--success))]",
  warning: "bg-[hsl(var(--warning)_/_0.14)] text-[hsl(var(--warning))]",
  error: "bg-[hsl(var(--destructive)_/_0.10)] text-[hsl(var(--destructive))]",
  info: "bg-[hsl(var(--info)_/_0.10)] text-[hsl(var(--info))]",
  neutral: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
}

const dotClasses: Record<StatusBadgeVariant, string> = {
  success: "bg-[hsl(var(--success))]",
  warning: "bg-[hsl(var(--warning))]",
  error: "bg-[hsl(var(--destructive))]",
  info: "bg-[hsl(var(--info))]",
  neutral: "bg-[hsl(var(--neutral))]",
}

export function StatusBadge({
  children,
  className,
  variant = "neutral",
  dot = true,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dotClasses[variant])} /> : null}
      <span>{children}</span>
    </span>
  )
}
