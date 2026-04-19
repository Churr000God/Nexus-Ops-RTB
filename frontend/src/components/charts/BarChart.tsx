import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "@/lib/utils"

type BarSeries<T> = {
  dataKey: keyof T & string
  name: string
  color?: string
}

type BarChartProps<T extends Record<string, unknown>> = {
  data: T[]
  xKey: keyof T & string
  bars: BarSeries<T>[]
  height?: number
  valueFormatter?: (value: number) => string
  className?: string
}

export function BarChart<T extends Record<string, unknown>>({
  data,
  xKey,
  bars,
  height = 320,
  valueFormatter,
  className,
}: BarChartProps<T>) {
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
        <RechartsBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey={xKey as unknown as string}
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) =>
              typeof v === "number" && valueFormatter ? valueFormatter(v) : String(v)
            }
          />
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
          {bars.map((series) => (
            <Bar
              key={series.dataKey}
              dataKey={series.dataKey as unknown as string}
              name={series.name}
              fill={series.color ?? "hsl(var(--primary))"}
              radius={[6, 6, 0, 0]}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}
