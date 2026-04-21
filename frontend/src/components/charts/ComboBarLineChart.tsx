import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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

type LineSeries<T> = {
  dataKey: keyof T & string
  name: string
  color?: string
  dashed?: boolean
  yAxisId?: "left" | "right"
}

type ComboBarLineChartProps<T extends Record<string, unknown>> = {
  data: T[]
  xKey: keyof T & string
  bars: BarSeries<T>[]
  lines: LineSeries<T>[]
  height?: number
  leftValueFormatter?: (value: number) => string
  rightValueFormatter?: (value: number) => string
  className?: string
}

export function ComboBarLineChart<T extends Record<string, unknown>>({
  data,
  xKey,
  bars,
  lines,
  height = 340,
  leftValueFormatter,
  rightValueFormatter,
  className,
}: ComboBarLineChartProps<T>) {
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

  const rightSeriesKeys = new Set(
    lines.filter((series) => series.yAxisId === "right").map((series) => series.dataKey)
  )

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey={xKey as unknown as string}
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) =>
              typeof v === "number" && leftValueFormatter ? leftValueFormatter(v) : String(v)
            }
          />
          {rightSeriesKeys.size > 0 ? (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(v) =>
                typeof v === "number" && rightValueFormatter ? rightValueFormatter(v) : String(v)
              }
            />
          ) : null}
          <Tooltip
            formatter={(value, _name, props) => {
              if (value === null || value === undefined) return "—"
              if (typeof value !== "number") return String(value)
              const key = String((props as { dataKey?: unknown } | null)?.dataKey ?? "")
              if (rightValueFormatter && rightSeriesKeys.has(key as keyof T & string)) {
                return rightValueFormatter(value)
              }
              return leftValueFormatter ? leftValueFormatter(value) : String(value)
            }}
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
              yAxisId="left"
              dataKey={series.dataKey as unknown as string}
              name={series.name}
              fill={series.color ?? "hsl(var(--primary))"}
              radius={[6, 6, 0, 0]}
            />
          ))}

          {lines.map((series) => (
            <Line
              key={series.dataKey}
              type="monotone"
              dataKey={series.dataKey as unknown as string}
              yAxisId={series.yAxisId ?? "left"}
              name={series.name}
              stroke={series.color ?? "hsl(var(--primary))"}
              strokeWidth={2.5}
              strokeDasharray={series.dashed ? "6 4" : undefined}
              dot={{
                r: 3,
                stroke: series.color ?? "hsl(var(--primary))",
                strokeWidth: 0,
                fill: series.color ?? "hsl(var(--primary))",
              }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
