import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type KpiTrend = "up" | "down" | "flat"

type KpiCardProps = {
  title: string
  value: string
  description?: string
  trend?: {
    direction: KpiTrend
    label: string
  }
  className?: string
}

const trendStyles: Record<KpiTrend, { icon: typeof ArrowRight; className: string }> = {
  up: { icon: ArrowUpRight, className: "text-emerald-600 dark:text-emerald-400" },
  down: { icon: ArrowDownRight, className: "text-rose-600 dark:text-rose-400" },
  flat: { icon: ArrowRight, className: "text-muted-foreground" },
}

export function KpiCard({ title, value, description, trend, className }: KpiCardProps) {
  const trendMeta = trend ? trendStyles[trend.direction] : null
  const TrendIcon = trendMeta?.icon

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-semibold leading-none tracking-tight">{value}</div>
        {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
        {trendMeta && TrendIcon ? (
          <div className={cn("inline-flex items-center gap-1 text-xs", trendMeta.className)}>
            <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{trend?.label}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
