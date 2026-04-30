import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

type ViewOption<V extends string> = {
  value: V
  label: string
  icon: LucideIcon
}

type ViewToggleProps<V extends string> = {
  options: ViewOption<V>[]
  active: V
  onChange: (value: V) => void
  className?: string
}

export function ViewToggle<V extends string>({
  options,
  active,
  onChange,
  className,
}: ViewToggleProps<V>) {
  return (
    <div
      className={cn(
        "inline-flex items-center overflow-hidden rounded-[var(--radius-md)] border border-border",
        className
      )}
    >
      {options.map((opt) => {
        const isActive = active === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            title={opt.label}
          >
            <opt.icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
