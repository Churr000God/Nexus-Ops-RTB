import { CalendarRange } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type DatePreset = "custom" | "hoy" | "7d" | "30d" | "mtd" | "ytd"

type DateRangePickerProps = {
  preset: DatePreset
  startDate: string | null
  endDate: string | null
  onPresetChange: (preset: DatePreset) => void
  onRangeChange: (range: { startDate: string | null; endDate: string | null }) => void
  onReset?: () => void
  className?: string
}

const presetLabels: Record<DatePreset, string> = {
  custom: "Personalizado",
  hoy: "Hoy",
  "7d": "7 días",
  "30d": "30 días",
  mtd: "MTD",
  ytd: "YTD",
}

export function DateRangePicker({
  preset,
  startDate,
  endDate,
  onPresetChange,
  onRangeChange,
  onReset,
  className,
}: DateRangePickerProps) {
  return (
    <div
      className={cn(
        "surface-card flex flex-col gap-4 border-white/70 bg-white p-5 md:p-6",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[hsl(var(--primary)_/_0.10)] text-[hsl(var(--primary))]">
          <CalendarRange className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">Filtros de fecha</div>
          <div className="text-xs text-muted-foreground">
            Ajusta el periodo para recalcular KPIs, gráficas y tabla.
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {onReset ? (
            <Button type="button" variant="ghost" size="sm" onClick={onReset}>
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[220px_1fr_1fr]">
        <div className="space-y-1">
          <label
            htmlFor="datePreset"
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Preset
          </label>
          <select
            id="datePreset"
            value={preset}
            onChange={(e) => onPresetChange(e.target.value as DatePreset)}
            className={cn(
              "flex h-11 w-full rounded-[var(--radius-md)] border border-input bg-background px-3 text-sm shadow-soft-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
            aria-label="Preset de fechas"
          >
            {Object.entries(presetLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="startDate"
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Desde
          </label>
          <Input
            id="startDate"
            type="date"
            value={startDate ?? ""}
            onChange={(e) =>
              onRangeChange({
                startDate: e.target.value ? e.target.value : null,
                endDate,
              })
            }
            aria-label="Fecha inicio"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="endDate"
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Hasta
          </label>
          <Input
            id="endDate"
            type="date"
            value={endDate ?? ""}
            onChange={(e) =>
              onRangeChange({
                startDate,
                endDate: e.target.value ? e.target.value : null,
              })
            }
            aria-label="Fecha fin"
          />
        </div>
      </div>
    </div>
  )
}
