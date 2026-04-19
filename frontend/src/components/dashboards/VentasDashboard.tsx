import { useCallback, useMemo } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart } from "@/components/charts/BarChart"
import { LineChart } from "@/components/charts/LineChart"
import { PieChart } from "@/components/charts/PieChart"
import { DataTable } from "@/components/common/DataTable"
import { DateRangePicker } from "@/components/common/DateRangePicker"
import { KpiCard } from "@/components/common/KpiCard"
import { useApi } from "@/hooks/useApi"
import { useFilters } from "@/hooks/useFilters"
import { ventasService } from "@/services/ventasService"
import { useAuthStore } from "@/stores/authStore"
import { formatCurrencyMXN, formatIsoDate, formatNumber } from "@/lib/utils"
import type { Sale } from "@/types/ventas"

export function VentasDashboard() {
  const token = useAuthStore((s) => s.accessToken)
  const { datePreset, startDate, endDate, setDatePreset, setDateRange, reset } = useFilters()

  const fetchOverview = useCallback(
    (signal: AbortSignal) =>
      ventasService.dashboardOverview(token ?? "", { startDate, endDate }, signal),
    [token, startDate, endDate]
  )
  const overview = useApi(fetchOverview, { enabled: Boolean(token) }, token, startDate, endDate)

  const fetchSalesByCustomer = useCallback(
    (signal: AbortSignal) =>
      ventasService.salesByCustomer(token ?? "", { startDate, endDate, limit: 10 }, signal),
    [token, startDate, endDate]
  )
  const salesByCustomer = useApi(
    fetchSalesByCustomer,
    { enabled: Boolean(token) },
    token,
    startDate,
    endDate
  )

  const fetchApprovedVsCancelled = useCallback(
    (signal: AbortSignal) =>
      ventasService.approvedVsCancelled(token ?? "", { startDate, endDate }, signal),
    [token, startDate, endDate]
  )
  const approvedVsCancelled = useApi(
    fetchApprovedVsCancelled,
    { enabled: Boolean(token) },
    token,
    startDate,
    endDate
  )

  const fetchGrossMarginByProduct = useCallback(
    (signal: AbortSignal) =>
      ventasService.grossMarginByProduct(token ?? "", { startDate, endDate, limit: 10 }, signal),
    [token, startDate, endDate]
  )
  const grossMarginByProduct = useApi(
    fetchGrossMarginByProduct,
    { enabled: Boolean(token) },
    token,
    startDate,
    endDate
  )

  const fetchSalesList = useCallback(
    (signal: AbortSignal) =>
      ventasService.listSales(token ?? "", { startDate, endDate, limit: 25, offset: 0 }, signal),
    [token, startDate, endDate]
  )
  const salesList = useApi(fetchSalesList, { enabled: Boolean(token) }, token, startDate, endDate)

  const kpis = useMemo(() => {
    const data = overview.data
    if (!data) {
      return {
        revenue: "—",
        grossMargin: "—",
        marginPct: "—",
        approvedPct: "—",
        cancelledPct: "—",
      }
    }

    const revenue = data.total_revenue
    const grossMargin = data.total_gross_margin
    const marginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0
    const quotesTotal = data.approved_quotes + data.cancelled_quotes
    const approvedPct = quotesTotal > 0 ? (data.approved_quotes / quotesTotal) * 100 : 0
    const cancelledPct = quotesTotal > 0 ? (data.cancelled_quotes / quotesTotal) * 100 : 0

    return {
      revenue: formatCurrencyMXN(revenue),
      grossMargin: formatCurrencyMXN(grossMargin),
      marginPct: `${formatNumber(marginPct)}%`,
      approvedPct: `${formatNumber(approvedPct)}%`,
      cancelledPct: `${formatNumber(cancelledPct)}%`,
    }
  }, [overview.data])

  const byCustomerChart = useMemo(() => {
    return (salesByCustomer.data ?? []).map((row) => ({
      customer: row.customer,
      revenue: row.total_revenue,
      sales: row.sale_count,
    }))
  }, [salesByCustomer.data])

  const approvedCancelledChart = useMemo(() => {
    return (approvedVsCancelled.data ?? []).map((row) => ({
      month: row.year_month,
      approved: row.approved_count,
      cancelled: row.cancelled_count,
    }))
  }, [approvedVsCancelled.data])

  const marginByProductChart = useMemo(() => {
    return (grossMarginByProduct.data ?? []).map((row) => ({
      product: row.product,
      gross_margin: row.gross_margin,
      margin_percent: row.margin_percent ?? 0,
      revenue: row.revenue,
    }))
  }, [grossMarginByProduct.data])

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

  const tableColumns = useMemo(() => {
    return [
      {
        key: "sold_on",
        header: "Fecha",
        cell: (row: Sale) => (row.sold_on ? formatIsoDate(row.sold_on) : "—"),
        className: "w-[140px]",
      },
      {
        key: "customer",
        header: "Cliente",
        cell: (row: Sale) => row.customer_name ?? "—",
        className: "max-w-[260px] truncate",
      },
      {
        key: "name",
        header: "Venta",
        cell: (row: Sale) => row.name,
        className: "max-w-[320px] truncate",
      },
      {
        key: "total",
        header: "Total",
        cell: (row: Sale) => (row.total !== null ? formatCurrencyMXN(row.total) : "—"),
        className: "text-right",
      },
      {
        key: "gross_margin",
        header: "Margen",
        cell: (row: Sale) =>
          row.gross_margin !== null ? formatCurrencyMXN(row.gross_margin) : "—",
        className: "text-right",
      },
    ]
  }, [])

  const hasError =
    overview.status === "error" ||
    salesByCustomer.status === "error" ||
    approvedVsCancelled.status === "error" ||
    grossMarginByProduct.status === "error" ||
    salesList.status === "error"

  const firstError =
    overview.error ??
    salesByCustomer.error ??
    approvedVsCancelled.error ??
    grossMarginByProduct.error ??
    salesList.error

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
        <KpiCard title="Ventas Totales" value={kpis.revenue} description="Periodo seleccionado" />
        <KpiCard title="Margen Bruto" value={kpis.grossMargin} description="Ventas − costo" />
        <KpiCard title="% Margen" value={kpis.marginPct} description="Margen / ventas" />
        <KpiCard title="% Aprobadas" value={kpis.approvedPct} description="Aprobadas / total" />
        <KpiCard title="% Canceladas" value={kpis.cancelledPct} description="Canceladas / total" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas por Cliente (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={byCustomerChart}
              xKey="customer"
              bars={[{ dataKey: "revenue", name: "Ventas", color: "hsl(var(--primary))" }]}
              valueFormatter={formatCurrencyMXN}
            />
          </CardContent>
        </Card>

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
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Margen Bruto por Producto</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={marginByProductChart}
              xKey="product"
              bars={[{ dataKey: "gross_margin", name: "Margen bruto", color: "hsl(142 70% 45%)" }]}
              valueFormatter={formatCurrencyMXN}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle de Ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={tableColumns}
            rows={salesList.data ?? []}
            rowKey={(row) => row.id}
            emptyLabel={
              salesList.status === "loading" ? "Cargando..." : "Sin ventas en el rango seleccionado"
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
