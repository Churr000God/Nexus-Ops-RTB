import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "@/lib/utils"

type LineSeries<T> = {
  dataKey: keyof T & string
  name: string
  color?: string
}

type LineChartProps<T extends Record<string, unknown>> = {
  data: T[]
  xKey: keyof T & string
  lines: LineSeries<T>[]
  height?: number
  valueFormatter?: (value: number) => string
  className?: string
}

export function LineChart<T extends Record<string, unknown>>({
  data,
  xKey,
  lines,
  height = 320,
  valueFormatter,
  className,
}: LineChartProps<T>) {
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
        <RechartsLineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey={xKey as unknown as string}
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
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
          {lines.map((series) => (
            <Line
              key={series.dataKey}
              type="monotone"
              dataKey={series.dataKey as unknown as string}
              name={series.name}
              stroke={series.color ?? "hsl(var(--primary))"}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}
