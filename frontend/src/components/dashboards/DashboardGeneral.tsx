import { useCallback, useMemo } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart } from "@/components/charts/BarChart"
import { LineChart } from "@/components/charts/LineChart"
import { PieChart } from "@/components/charts/PieChart"
import { DateRangePicker } from "@/components/common/DateRangePicker"
import { KpiCard } from "@/components/common/KpiCard"
import { useApi } from "@/hooks/useApi"
import { useFilters } from "@/hooks/useFilters"
import { ventasService } from "@/services/ventasService"
import { useAuthStore } from "@/stores/authStore"
import { useSyncStore } from "@/stores/syncStore"
import { formatCurrencyMXN, formatNumber } from "@/lib/utils"

export function DashboardGeneral() {
  const token = useAuthStore((s) => s.accessToken)
  const syncVersion = useSyncStore((s) => s.syncVersion)
  const { datePreset, startDate, endDate, setDatePreset, setDateRange, reset } = useFilters()

  const fetchOverview = useCallback(
    (signal: AbortSignal) =>
      ventasService.dashboardOverview(token ?? "", { startDate, endDate }, signal),
    [token, startDate, endDate, syncVersion]
  )
  const overview = useApi(fetchOverview, { enabled: Boolean(token) }, token, startDate, endDate, syncVersion)

  const fetchSalesByMonth = useCallback(
    (signal: AbortSignal) =>
      ventasService.salesByMonth(token ?? "", { startDate, endDate }, signal),
    [token, startDate, endDate, syncVersion]
  )
  const salesByMonth = useApi(
    fetchSalesByMonth,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion
  )

  const fetchApprovedVsCancelled = useCallback(
    (signal: AbortSignal) =>
      ventasService.approvedVsCancelled(token ?? "", { startDate, endDate }, signal),
    [token, startDate, endDate, syncVersion]
  )
  const approvedVsCancelled = useApi(
    fetchApprovedVsCancelled,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion
  )

  const fetchGrossMarginByProduct = useCallback(
    (signal: AbortSignal) =>
      ventasService.grossMarginByProduct(token ?? "", { startDate, endDate, limit: 12 }, signal),
    [token, startDate, endDate, syncVersion]
  )
  const grossMarginByProduct = useApi(
    fetchGrossMarginByProduct,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion
  )

  const kpis = useMemo(() => {
    const data = overview.data
    if (!data) {
      return {
        saleCount: "—",
        revenue: "—",
        grossMargin: "—",
        marginPct: "—",
        approvedPct: "—",
      }
    }

    const revenue = data.total_revenue
    const grossMargin = data.total_gross_margin
    const marginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0
    const quotesTotal = data.approved_quotes + data.cancelled_quotes
    const approvedPct = quotesTotal > 0 ? (data.approved_quotes / quotesTotal) * 100 : 0

    return {
      saleCount: formatNumber(data.sale_count),
      revenue: formatCurrencyMXN(revenue),
      grossMargin: formatCurrencyMXN(grossMargin),
      marginPct: `${formatNumber(marginPct)}%`,
      approvedPct: `${formatNumber(approvedPct)}%`,
    }
  }, [overview.data])

  const byMonthChart = useMemo(() => {
    return (salesByMonth.data ?? []).map((row) => ({
      month: row.year_month,
      revenue: row.total_revenue,
      gross_margin: row.total_gross_margin,
    }))
  }, [salesByMonth.data])

  const approvedCancelledChart = useMemo(() => {
    return (approvedVsCancelled.data ?? []).map((row) => ({
      month: row.year_month,
      approved: row.approved_count,
      cancelled: row.cancelled_count,
    }))
  }, [approvedVsCancelled.data])

  const productPie = useMemo(() => {
    const rows = grossMarginByProduct.data ?? []
    if (rows.length === 0) return []

    const top = rows.slice(0, 8)
    const rest = rows.slice(8)
    const restValue = rest.reduce((acc, row) => acc + row.revenue, 0)

    const base = top.map((row) => ({ name: row.product, value: row.revenue }))
    if (restValue > 0) base.push({ name: "Otros", value: restValue })
    return base
  }, [grossMarginByProduct.data])

  const hasError =
    overview.status === "error" ||
    salesByMonth.status === "error" ||
    approvedVsCancelled.status === "error" ||
    grossMarginByProduct.status === "error"

  const firstError =
    overview.error ?? salesByMonth.error ?? approvedVsCancelled.error ?? grossMarginByProduct.error

  return (
    <div className="space-y-6">
      <DateRangePicker
        preset={datePreset}
        startDate={startDate}
        endDate={endDate}
        onPresetChange={setDatePreset}
        onRangeChange={setDateRange}
        onReset={reset}
      />

      {hasError && firstError ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{firstError.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="Ventas Totales del Período"
          value={kpis.revenue}
          description="Suma de ventas"
        />
        <KpiCard
          title="Margen Bruto Acumulado"
          value={kpis.grossMargin}
          description="Ventas − costo"
        />
        <KpiCard title="% Margen" value={kpis.marginPct} description="Margen / ventas" />
        <KpiCard
          title="% Ventas Aprobadas"
          value={kpis.approvedPct}
          description="Aprobadas / total"
        />
        <KpiCard title="Operaciones" value={kpis.saleCount} description="Cantidad de ventas" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas por Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={byMonthChart}
              xKey="month"
              bars={[{ dataKey: "revenue", name: "Ventas reales", color: "hsl(var(--primary))" }]}
              valueFormatter={formatCurrencyMXN}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tendencia Histórica de Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              data={byMonthChart}
              xKey="month"
              lines={[{ dataKey: "revenue", name: "Ventas", color: "hsl(var(--primary))" }]}
              valueFormatter={formatCurrencyMXN}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución de Ventas por Producto</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart
              data={productPie}
              nameKey="name"
              valueKey="value"
              valueFormatter={formatCurrencyMXN}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aprobadas vs. Canceladas</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              data={approvedCancelledChart}
              xKey="month"
              lines={[
                { dataKey: "approved", name: "Aprobadas", color: "hsl(142 70% 45%)" },
                { dataKey: "cancelled", name: "Canceladas", color: "hsl(0 84% 60%)" },
              ]}
              valueFormatter={(v) => formatNumber(v)}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado del Sistema</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="text-sm font-medium">Cloudflare Tunnel</div>
            <div className="mt-1 text-sm text-muted-foreground">Pendiente Sprint 5</div>
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="text-sm font-medium">Automatización n8n</div>
            <div className="mt-1 text-sm text-muted-foreground">Pendiente Sprint 5</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
