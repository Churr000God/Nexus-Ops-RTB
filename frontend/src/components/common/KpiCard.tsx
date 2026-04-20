import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react"

import { StatusBadge, type StatusBadgeVariant } from "@/components/common/StatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type KpiTrend = "up" | "down" | "flat"
type KpiTone = "blue" | "green" | "orange" | "purple" | "red" | "neutral"

type KpiCardProps = {
  title?: string
  label?: string
  value: string
  description?: string
  icon?: LucideIcon
  tone?: KpiTone
  trend?: {
    direction: KpiTrend
    label: string
  }
  badge?: {
    label: string
    variant: StatusBadgeVariant
  }
  className?: string
}

const trendStyles: Record<KpiTrend, { icon: typeof ArrowRight; className: string }> = {
  up: { icon: ArrowUpRight, className: "text-[hsl(var(--success))]" },
  down: { icon: ArrowDownRight, className: "text-[hsl(var(--destructive))]" },
  flat: { icon: ArrowRight, className: "text-muted-foreground" },
}

const toneStyles: Record<KpiTone, { icon: string; glow: string }> = {
  blue: {
    icon: "bg-[hsl(var(--primary)_/_0.10)] text-[hsl(var(--primary))]",
    glow: "before:bg-[radial-gradient(circle_at_top_right,rgba(0,81,255,0.12),transparent_55%)]",
  },
  green: {
    icon: "bg-[hsl(var(--success)_/_0.12)] text-[hsl(var(--success))]",
    glow: "before:bg-[radial-gradient(circle_at_top_right,rgba(26,173,88,0.12),transparent_55%)]",
  },
  orange: {
    icon: "bg-[hsl(var(--warning)_/_0.16)] text-[hsl(var(--warning))]",
    glow: "before:bg-[radial-gradient(circle_at_top_right,rgba(255,176,32,0.16),transparent_55%)]",
  },
  purple: {
    icon: "bg-[rgba(175,82,222,0.12)] text-[rgb(175,82,222)]",
    glow: "before:bg-[radial-gradient(circle_at_top_right,rgba(175,82,222,0.14),transparent_55%)]",
  },
  red: {
    icon: "bg-[hsl(var(--destructive)_/_0.10)] text-[hsl(var(--destructive))]",
    glow: "before:bg-[radial-gradient(circle_at_top_right,rgba(255,59,48,0.12),transparent_55%)]",
  },
  neutral: {
    icon: "bg-muted text-foreground",
    glow: "before:bg-[radial-gradient(circle_at_top_right,rgba(100,116,139,0.12),transparent_55%)]",
  },
}

export function KpiCard({
  title,
  label,
  value,
  description,
  icon: Icon,
  tone = "blue",
  trend,
  badge,
  className,
}: KpiCardProps) {
  const heading = title ?? label ?? ""
  const trendMeta = trend ? trendStyles[trend.direction] : null
  const TrendIcon = trendMeta?.icon
  const toneMeta = toneStyles[tone]

  return (
    <Card
      className={cn(
        "surface-card surface-card-hover relative overflow-hidden border-white/70 before:absolute before:inset-0 before:opacity-100 before:content-['']",
        toneMeta.glow,
        className
      )}
    >
      <CardHeader className="relative space-y-0 pb-3">
        <div className="flex items-start justify-between gap-3">
          {Icon ? (
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)]",
                toneMeta.icon
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
          ) : (
            <div />
          )}
          {badge ? <StatusBadge variant={badge.variant}>{badge.label}</StatusBadge> : null}
        </div>
      </CardHeader>
      <CardContent className="relative space-y-3">
        <div className="text-[30px] font-bold leading-none tracking-tight text-foreground">
          {value}
        </div>
        <div className="space-y-1">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {heading}
          </CardTitle>
          {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
        </div>
        {trendMeta && TrendIcon ? (
          <div className={cn("inline-flex items-center gap-1 text-xs font-semibold", trendMeta.className)}>
            <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{trend?.label}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
