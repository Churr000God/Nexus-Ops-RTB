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

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type LineSeries<T> = {
  dataKey: keyof T & string
  name: string
  color?: string
  dashed?: boolean
  yAxisId?: "left" | "right"
}

type LineChartProps<T extends Record<string, unknown>> = {
  data: T[]
  xKey: keyof T & string
  lines: LineSeries<T>[]
  height?: number
  valueFormatter?: (value: number) => string
  showDots?: boolean
  rightAxisFormatter?: (value: number) => string
  tooltipContent?: ReactNode | ((props: unknown) => ReactNode)
  className?: string
}

export function LineChart<T extends Record<string, unknown>>({
  data,
  xKey,
  lines,
  height = 320,
  valueFormatter,
  showDots = true,
  rightAxisFormatter,
  tooltipContent,
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

  const rightSeriesKeys = new Set(
    lines.filter((series) => series.yAxisId === "right").map((series) => series.dataKey)
  )

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
            yAxisId="left"
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) =>
              typeof v === "number" && valueFormatter ? valueFormatter(v) : String(v)
            }
          />
          {rightSeriesKeys.size > 0 ? (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(v) =>
                typeof v === "number" && rightAxisFormatter ? rightAxisFormatter(v) : String(v)
              }
            />
          ) : null}
          <Tooltip
            content={tooltipContent as never}
            formatter={(value, _name, props) => {
              if (typeof value !== "number") return String(value)
              const key = String((props as { dataKey?: unknown } | null)?.dataKey ?? "")
              if (rightAxisFormatter && rightSeriesKeys.has(key as keyof T & string)) {
                return rightAxisFormatter(value)
              }
              return valueFormatter ? valueFormatter(value) : String(value)
            }}
            contentStyle={
              tooltipContent
                ? undefined
                : {
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                  }
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
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
              dot={
                showDots
                  ? {
                      r: 3,
                      stroke: series.color ?? "hsl(var(--primary))",
                      strokeWidth: 0,
                      fill: series.color ?? "hsl(var(--primary))",
                    }
                  : false
              }
              activeDot={{ r: 5 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}
