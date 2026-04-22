import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
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
  height?: number | string
  valueFormatter?: (value: number) => string
  className?: string
  horizontal?: boolean
  colorScale?: string[]
}

export function BarChart<T extends Record<string, unknown>>({
  data,
  xKey,
  bars,
  height = 320,
  valueFormatter,
  className,
  horizontal = false,
  colorScale,
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

  const tickFormatter = (v: unknown) =>
    typeof v === "number" && valueFormatter ? valueFormatter(v) : String(v)

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={horizontal ? { left: 8, right: 24, top: 4, bottom: 4 } : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          {horizontal ? (
            <>
              <YAxis
                dataKey={xKey as unknown as string}
                type="category"
                width={160}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={tickFormatter}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey as unknown as string}
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={tickFormatter}
              />
            </>
          )}
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
          {!colorScale && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {bars.map((series) => (
            <Bar
              key={series.dataKey}
              dataKey={series.dataKey as unknown as string}
              name={series.name}
              fill={series.color ?? "hsl(var(--primary))"}
              radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            >
              {colorScale
                ? data.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={colorScale[index % colorScale.length]}
                    />
                  ))
                : null}
            </Bar>
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}
