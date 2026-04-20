import type { ReactNode } from "react"
import { Info } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type ChartPanelProps = {
  title: string
  subtitle?: string
  infoLabel?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function ChartPanel({
  title,
  subtitle,
  infoLabel,
  action,
  children,
  className,
  contentClassName,
}: ChartPanelProps) {
  return (
    <Card className={cn("surface-card surface-card-hover border-white/70", className)}>
      <CardHeader className="pb-4">
        <div className="panel-header">
          <div className="min-w-0">
            <CardTitle className="text-[15px] font-semibold tracking-tight text-foreground">
              {title}
            </CardTitle>
            {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          {action ? (
            action
          ) : infoLabel ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground"
              aria-label={infoLabel}
              title={infoLabel}
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{infoLabel}</span>
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className={cn("pt-0", contentClassName)}>{children}</CardContent>
    </Card>
  )
}
