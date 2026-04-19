import {
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

import { cn } from "@/lib/utils"

type PieChartProps<T extends Record<string, unknown>> = {
  data: T[]
  nameKey: keyof T & string
  valueKey: keyof T & string
  height?: number
  valueFormatter?: (value: number) => string
  className?: string
}

const palette = [
  "hsl(var(--primary))",
  "hsl(198 93% 60%)",
  "hsl(142 70% 45%)",
  "hsl(36 100% 55%)",
  "hsl(0 84% 60%)",
  "hsl(262 83% 58%)",
  "hsl(205 16% 55%)",
]

export function PieChart<T extends Record<string, unknown>>({
  data,
  nameKey,
  valueKey,
  height = 320,
  valueFormatter,
  className,
}: PieChartProps<T>) {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground",
          className
        )}
        style={{ height }}
      >
        Sin datos para graficar
      </div>
    )
  }

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Tooltip
            formatter={(value) =>
              typeof value === "number" && valueFormatter ? valueFormatter(value) : String(value)
            }
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Pie
            data={data}
            nameKey={nameKey}
            dataKey={valueKey}
            innerRadius={60}
            outerRadius={110}
            paddingAngle={2}
            stroke="hsl(var(--card))"
            strokeWidth={2}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={palette[index % palette.length]} />
            ))}
          </Pie>
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  )
}
