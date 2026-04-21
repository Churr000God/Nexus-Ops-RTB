import { useCallback, useMemo, useState } from "react"
import {
  BarChart3,
  BrainCircuit,
  Download,
  FileText,
  Mail,
  Percent,
  RefreshCw,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ChartPanel } from "@/components/common/ChartPanel"
import { BarChart } from "@/components/charts/BarChart"
import { LineChart } from "@/components/charts/LineChart"
import { PieChart } from "@/components/charts/PieChart"
import { DataTable } from "@/components/common/DataTable"
import { DateRangePicker } from "@/components/common/DateRangePicker"
import { KpiCard } from "@/components/common/KpiCard"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/useApi"
import { useFilters } from "@/hooks/useFilters"
import { ventasService } from "@/services/ventasService"
import { useAuthStore } from "@/stores/authStore"
import { formatCurrencyMXN, formatIsoDate, formatNumber } from "@/lib/utils"
import type { AtRiskCustomer, PaymentTrend, RecentQuote } from "@/types/ventas"

export function VentasDashboard() {
  const token = useAuthStore((s) => s.accessToken)
  const { datePreset, startDate, endDate, setDatePreset, setDateRange, reset } = useFilters()
  const [statusFilter, setStatusFilter] = useState("all")

  const fetchSummary = useCallback(
    (signal: AbortSignal) =>
      ventasService.salesSummary(token ?? "", { startDate, endDate }, signal),
    [token, startDate, endDate]
  )
  const summary = useApi(
    fetchSummary,
    { enabled: Boolean(token) },
    token,
    startDate,
    endDate
  )

  const fetchSalesProjection = useCallback(
    (signal: AbortSignal) =>
      ventasService.salesVsProjection(token ?? "", { startDate, endDate }, signal),
    [token, startDate, endDate]
  )
  const salesProjection = useApi(
    fetchSalesProjection,
    { enabled: Boolean(token) },
    token,
    startDate,
    endDate
  )

  const fetchTopCustomers = useCallback(
    (signal: AbortSignal) =>
      ventasService.topCustomers(token ?? "", { startDate, endDate, limit: 10 }, signal),
    [token, startDate, endDate]
  )
  const topCustomers = useApi(
    fetchTopCustomers,
    { enabled: Boolean(token) },
    token,
    startDate,
    endDate
  )

  const fetchProductDistribution = useCallback(
    (signal: AbortSignal) =>
      ventasService.productDistribution(token ?? "", { startDate, endDate, limit: 10 }, signal),
    [token, startDate, endDate]
  )
  const productDistribution = useApi(
    fetchProductDistribution,
    { enabled: Boolean(token) },
    token,
    startDate,
    endDate
  )

  const fetchQuoteStatusByMonth = useCallback(
    (signal: AbortSignal) =>
      ventasService.quoteStatusByMonth(token ?? "", { startDate, endDate }, signal),
    [token, startDate, endDate]
  )
  const quoteStatusByMonth = useApi(
    fetchQuoteStatusByMonth,
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

  const fetchRecentQuotes = useCallback(
    (signal: AbortSignal) =>
      ventasService.recentQuotes(
        token ?? "",
        { limit: 10, status: statusFilter === "all" ? null : statusFilter },
        signal
      ),
    [token, statusFilter]
  )
  const recentQuotes = useApi(
    fetchRecentQuotes,
    { enabled: Boolean(token) },
    token,
    startDate,
    endDate
  )

  const fetchProductForecast = useCallback(
    (signal: AbortSignal) =>
      ventasService.productForecast(token ?? "", { startDate, endDate, limit: 15 }, signal),
    [token, startDate, endDate]
  )
  const productForecast = useApi(
    fetchProductForecast,
    { enabled: Boolean(token) },
    token,
    startDate,
    endDate
  )

  const fetchMissingDemand = useCallback(
    (signal: AbortSignal) =>
      ventasService.missingDemand(token ?? "", { startDate, endDate, limit: 95 }, signal),
    [token, startDate, endDate]
  )
  const missingDemand = useApi(
    fetchMissingDemand,
    { enabled: Boolean(token) },
    token,
    startDate,
    endDate
  )

  const fetchAtRiskCustomers = useCallback(
    (signal: AbortSignal) => ventasService.atRiskCustomers(token ?? "", signal),
    [token]
  )
  const atRiskCustomers = useApi(
    fetchAtRiskCustomers,
    { enabled: Boolean(token) },
    token
  )

  const fetchPaymentTrend = useCallback(
    (signal: AbortSignal) =>
      ventasService.paymentTrend(token ?? "", { startDate, endDate, limit: 20 }, signal),
    [token, startDate, endDate]
  )
  const paymentTrend = useApi(
    fetchPaymentTrend,
    { enabled: Boolean(token) },
    token,
    startDate,
    endDate
  )

  const kpis = useMemo(() => {
    const data = summary.data
    if (!data) {
      return {
        totalSales: "—",
        pendingQuotes: "—",
        marginPct: "—",
        conversionRate: "—",
        approvedQuotes: "—",
        reviewQuotes: "—",
      }
    }

    return {
      totalSales: formatCurrencyMXN(data.total_sales),
      pendingQuotes: formatNumber(data.pending_quotes),
      marginPct: `${formatNumber(data.average_margin_percent)}%`,
      conversionRate: `${formatNumber(data.conversion_rate)}%`,
      approvedQuotes: formatNumber(data.approved_quotes),
      reviewQuotes: formatNumber(data.review_quotes),
    }
  }, [summary.data])

  const pendingQuotesBadge = useMemo(() => {
    const target = endDate ? new Date(`${endDate}T12:00:00`) : new Date()
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0)
    const day = String(lastDay.getDate()).padStart(2, "0")
    const month = lastDay.toLocaleDateString("es-MX", { month: "short" })
    return `Vencen el ${day} ${month}`
  }, [endDate])

  const byCustomerChart = useMemo(() => {
    return (topCustomers.data ?? []).map((row) => ({
      customer: row.customer,
      revenue: row.total_revenue,
      sales: row.sale_count,
    }))
  }, [topCustomers.data])

  const projectionChart = useMemo(() => {
    const rows = salesProjection.data ?? []
    return rows.map((row, index) => {
      const prev = index > 0 ? rows[index - 1]?.actual_sales : null
      const momChange =
        typeof prev === "number" && prev > 0
          ? ((row.actual_sales - prev) / prev) * 100
          : null

      return {
        month: row.year_month,
        actual_sales: row.actual_sales,
        projected_sales: row.projected_sales,
        mom_change_percent: momChange,
      }
    })
  }, [salesProjection.data])

  const quoteStatusChart = useMemo(() => {
    return (quoteStatusByMonth.data ?? []).map((row) => ({
      month: row.year_month,
      approved: row.approved_count,
      cancelled: row.cancelled_count,
      expired: row.expired_count,
      review: row.review_count,
      quoting: row.quoting_count,
      rejected: row.rejected_count,
      approved_amount: row.approved_amount,
      cancelled_amount: row.cancelled_amount,
      expired_amount: row.expired_amount,
      review_amount: row.review_amount,
      quoting_amount: row.quoting_amount,
      rejected_amount: row.rejected_amount,
    }))
  }, [quoteStatusByMonth.data])

  const marginByProductChart = useMemo(() => {
    return (grossMarginByProduct.data ?? []).map((row) => ({
      product: row.product,
      gross_margin: row.gross_margin,
      margin_percent: row.margin_percent ?? 0,
      revenue: row.revenue,
    }))
  }, [grossMarginByProduct.data])

  const forecastChart = useMemo(() => {
    return (productForecast.data ?? []).map((row) => ({
      product: row.product,
      predicted_units: row.predicted_units,
      sku: row.sku ?? "",
      category: row.category ?? "",
    }))
  }, [productForecast.data])

  const missingDemandChart = useMemo(() => {
    return (missingDemand.data ?? []).map((row) => ({
      product: row.product,
      demanda_faltante: row.demanda_faltante,
      sku: row.sku ?? "",
    }))
  }, [missingDemand.data])

  const atRiskChart = useMemo(() => {
    return (atRiskCustomers.data ?? []).slice(0, 15).map((row: AtRiskCustomer) => ({
      customer: row.customer_name,
      ultimos_90: row.compras_ult_90,
      previos_90: row.compras_90_previos,
    }))
  }, [atRiskCustomers.data])

  const missingDemandParetoRows = useMemo(() => {
    const rows = missingDemand.data ?? []
    const totalDemand = rows.reduce((acc, r) => acc + r.demanda_faltante, 0)
    const totalValue = rows.reduce((acc, r) => acc + r.valor_venta_pendiente, 0)
    return rows.map((row) => ({
      ...row,
      share_percent:
        totalDemand > 0 ? (row.demanda_faltante / totalDemand) * 100 : 0,
      value_share_percent:
        totalValue > 0 ? (row.valor_venta_pendiente / totalValue) * 100 : 0,
    }))
  }, [missingDemand.data])

  const productDistributionRows = useMemo(() => {
    return (productDistribution.data ?? []).map((row) => ({
      product: row.product,
      revenue: formatCurrencyMXN(row.revenue),
      percentage: `${formatNumber(row.percentage)}%`,
    }))
  }, [productDistribution.data])

  const productPie = useMemo(() => {
    const rows = productDistribution.data ?? []
    if (rows.length === 0) return []

    const top = rows.slice(0, 8)
    const rest = rows.slice(8)
    const restValue = rest.reduce((acc, row) => acc + row.revenue, 0)

    const base = top.map((row) => ({ name: row.product, value: row.revenue }))
    if (restValue > 0) base.push({ name: "Otros", value: restValue })
    return base
  }, [productDistribution.data])

  const paymentTrendChart = useMemo(() => {
    return (paymentTrend.data ?? []).map((row: PaymentTrend) => ({
      customer: row.customer_name,
      dias: row.promedio_dias_pago,
      riesgo: row.riesgo_pago,
      ultimo_pago: row.ultimo_pago,
    }))
  }, [paymentTrend.data])

  const filteredQuotes = useMemo(() => {
    const rows = recentQuotes.data ?? []
    if (statusFilter === "all") return rows

    return rows.filter((row) => {
      const normalized = (row.status ?? "").trim().toLowerCase()
      if (statusFilter === "approved") return normalized.includes("aprob") || normalized.includes("approved")
      if (statusFilter === "review") {
        return normalized.includes("revisi") || normalized.includes("pend") || normalized.includes("proceso")
      }
      if (statusFilter === "quoting") return normalized.includes("cotiz")
      if (statusFilter === "cancelled") {
        return normalized.includes("cancel")
      }
      if (statusFilter === "rejected") return normalized.includes("rechaz")
      if (statusFilter === "expired") return normalized.includes("expir")
      return normalized === statusFilter
    })
  }, [recentQuotes.data, statusFilter])

  const salesTableSummary = useMemo(() => {
    return `${formatNumber(filteredQuotes.length)} cotizaciones visibles`
  }, [filteredQuotes.length])

  const tableColumns = useMemo(() => {
    return [
      {
        key: "sold_on",
        header: "Fecha",
        cell: (row: RecentQuote) => (row.created_on ? formatIsoDate(row.created_on) : "—"),
        className: "w-[140px]",
      },
      {
        key: "customer",
        header: "Cliente",
        cell: (row: RecentQuote) => row.customer_name ?? "—",
        className: "max-w-[260px] truncate",
      },
      {
        key: "name",
        header: "Cotización",
        cell: (row: RecentQuote) => row.name,
        className: "max-w-[320px] truncate",
      },
      {
        key: "status",
        header: "Estado",
        cell: (row: RecentQuote) => {
          const normalized = (row.status ?? "").toLowerCase()
          if (normalized.includes("aprob") || normalized.includes("approved")) {
            return <StatusBadge variant="success">Aprobada</StatusBadge>
          }
          if (normalized.includes("revisi") || normalized.includes("proceso")) {
            return <StatusBadge variant="warning">En revisión</StatusBadge>
          }
          if (normalized.includes("cotiz")) {
            return <StatusBadge variant="neutral">En Cotización</StatusBadge>
          }
          if (normalized.includes("rechaz")) {
            return <StatusBadge variant="error">Rechazada</StatusBadge>
          }
          if (normalized.includes("cancel")) {
            return <StatusBadge variant="error">Cancelada</StatusBadge>
          }
          if (normalized.includes("expir")) {
            return <StatusBadge variant="neutral">Expirada</StatusBadge>
          }
          return <StatusBadge variant="neutral">{row.status ?? "Sin estado"}</StatusBadge>
        },
        className: "w-[150px]",
      },
      {
        key: "total",
        header: "Monto",
        cell: (row: RecentQuote) =>
          row.total !== null
            ? formatCurrencyMXN(row.total)
            : row.subtotal !== null
              ? formatCurrencyMXN(row.subtotal)
              : "—",
        className: "text-right",
      },
    ]
  }, [])

  const hasError =
    summary.status === "error" ||
    salesProjection.status === "error" ||
    topCustomers.status === "error" ||
    productDistribution.status === "error" ||
    quoteStatusByMonth.status === "error" ||
    grossMarginByProduct.status === "error" ||
    recentQuotes.status === "error" ||
    missingDemand.status === "error" ||
    atRiskCustomers.status === "error" ||
    paymentTrend.status === "error"

  const firstError =
    summary.error ??
    salesProjection.error ??
    topCustomers.error ??
    productDistribution.error ??
    quoteStatusByMonth.error ??
    grossMarginByProduct.error ??
    recentQuotes.error ??
    missingDemand.error ??
    atRiskCustomers.error ??
    paymentTrend.error

  const isLoading =
    summary.status === "loading" ||
    salesProjection.status === "loading" ||
    topCustomers.status === "loading" ||
    productDistribution.status === "loading" ||
    quoteStatusByMonth.status === "loading" ||
    grossMarginByProduct.status === "loading" ||
    recentQuotes.status === "loading" ||
    missingDemand.status === "loading" ||
    atRiskCustomers.status === "loading" ||
    paymentTrend.status === "loading"

  const showPendingToast = (feature: string) => {
    toast.info(`${feature} queda listo para enlazar cuando definamos el flujo de datos.`)
  }

  return (
    <div className="space-y-6">
      <section className="surface-card border-white/70 bg-white p-5 md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge variant={hasError ? "error" : isLoading ? "warning" : "success"}>
                {hasError ? "Error de carga" : isLoading ? "Actualizando vista" : "Vista lista"}
              </StatusBadge>
              <StatusBadge variant="info">Diseño basado en referencia aprobada</StatusBadge>
              <StatusBadge variant="neutral">Métricas conectadas a modelo real</StatusBadge>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-[30px]">
              Dashboard Operativo de Ventas
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Las tarjetas y gráficas se calculan desde `Reporte de Ventas`, `Cotizaciones a
              Clientes`, `Detalles de Cotizaciones` y el `Directorio` de clientes, siguiendo
              exactamente las reglas que me compartiste.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[360px]">
            <Button type="button" onClick={() => showPendingToast("La actualización manual")}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Actualizar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => showPendingToast("La generación de reporte")}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Reporte
            </Button>
            <Button type="button" variant="outline" onClick={() => showPendingToast("La descarga CSV")}>
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => showPendingToast("El envío por correo")}>
              <Mail className="h-4 w-4" aria-hidden="true" />
              Email
            </Button>
          </div>
        </div>
      </section>

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Ventas Totales del Mes"
          value={kpis.totalSales}
          description="Suma de subtotal en ventas aprobadas"
          icon={TrendingUp}
          tone="blue"
        />
        <KpiCard
          title="Cotizaciones Pendientes"
          value={kpis.pendingQuotes}
          description="En revisión, pendiente o en proceso"
          icon={BarChart3}
          tone="green"
          badge={{ label: pendingQuotesBadge, variant: "warning" }}
        />
        <KpiCard
          title="Margen de Ganancia Promedio"
          value={kpis.marginPct}
          description="Promedio del porcentaje de margen por venta"
          icon={Percent}
          tone="orange"
        />
        <KpiCard
          title="Tasa de Conversión"
          value={kpis.conversionRate}
          description="Cotizaciones aprobadas frente al total"
          icon={FileText}
          tone="purple"
          badge={{ label: `${kpis.approvedQuotes} aprobadas`, variant: "success" }}
        />
      </div>

      <div className="grid gap-4">
        <ChartPanel
          title="Top 10 Clientes por Ventas"
          subtitle="Se cruza `ventas.customer_id` contra `clientes.id` para obtener el nombre del cliente"
          infoLabel="Top de clientes"
        >
          <BarChart
            data={byCustomerChart}
            xKey="customer"
            bars={[{ dataKey: "revenue", name: "Ventas", color: "hsl(var(--primary))" }]}
            valueFormatter={formatCurrencyMXN}
            height={360}
          />
        </ChartPanel>

        <ChartPanel
          title="Distribución de Ventas por Producto"
          subtitle="Participación de cada producto aprobado sobre el ingreso total"
          infoLabel="Mix de productos"
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-center">
            <PieChart
              data={productPie}
              nameKey="name"
              valueKey="value"
              valueFormatter={formatCurrencyMXN}
              height={360}
              colors={["#0051FF", "#1AAD58", "#FFB020", "#AF52DE", "#FF6B6B", "#8E8E93"]}
              innerRadius={74}
              outerRadius={112}
            />
            <div className="overflow-hidden rounded-[var(--radius-md)] border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Producto
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Venta
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productDistributionRows.map((row) => (
                    <tr key={row.product} className="border-t">
                      <td className="px-3 py-2 text-[13px] text-foreground">{row.product}</td>
                      <td className="px-3 py-2 text-right text-[13px] text-foreground">{row.revenue}</td>
                      <td className="px-3 py-2 text-right text-[13px] text-muted-foreground">
                        {row.percentage}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ChartPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel
          title="Ventas Reales vs Proyecciones"
          subtitle="La línea real usa cotizaciones aprobadas confirmadas contra `ventas.quote_id`; la proyección usa histórico aprobado"
          infoLabel="Serie temporal"
        >
          <LineChart
            data={projectionChart}
            xKey="month"
            lines={[
              { dataKey: "actual_sales", name: "Ventas reales", color: "#0051FF" },
              {
                dataKey: "projected_sales",
                name: "Proyección",
                color: "#8E8E93",
                dashed: true,
              },
              {
                dataKey: "mom_change_percent",
                name: "Variación % mes a mes",
                color: "#FFB020",
                dashed: true,
                yAxisId: "right",
              },
            ]}
            valueFormatter={formatCurrencyMXN}
            rightAxisFormatter={(value) => `${value > 0 ? "+" : ""}${formatNumber(value)}%`}
            height={320}
          />
        </ChartPanel>

        <ChartPanel
          title="Margen de Ganancia por Producto"
          subtitle="Se muestra el margen bruto en monto; el porcentaje queda como referencia complementaria"
          infoLabel="Rentabilidad"
        >
          <div className="space-y-4">
            <BarChart
              data={marginByProductChart}
              xKey="product"
              bars={[{ dataKey: "gross_margin", name: "Margen bruto", color: "#1AAD58" }]}
              valueFormatter={formatCurrencyMXN}
              height={320}
            />
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {marginByProductChart.slice(0, 6).map((row) => (
                <div key={row.product} className="rounded-[var(--radius-md)] border bg-muted/30 px-3 py-2">
                  <div className="truncate text-xs font-semibold text-foreground">{row.product}</div>
                  <div className="mt-1 text-sm font-semibold text-[hsl(var(--success))]">
                    {formatCurrencyMXN(row.gross_margin)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(row.margin_percent)}% de margen
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ChartPanel>
      </div>

      <ChartPanel
        title="Aprobadas vs Canceladas vs Expiradas vs En Revisión vs En Cotización vs Rechazada"
        subtitle="Seguimiento mensual del estado de las cotizaciones creadas"
        infoLabel="Estado de cotizaciones"
      >
        <LineChart
          data={quoteStatusChart}
          xKey="month"
          lines={[
            { dataKey: "approved", name: "Aprobadas", color: "#1AAD58" },
            { dataKey: "cancelled", name: "Canceladas", color: "#FF3B30" },
            { dataKey: "expired", name: "Expiradas", color: "#8E8E93" },
            { dataKey: "review", name: "En revisión", color: "#FFB020" },
            { dataKey: "quoting", name: "En Cotización", color: "#AF52DE" },
            { dataKey: "rejected", name: "Rechazada", color: "#FF2D55" },
          ]}
          tooltipContent={(props) => {
            const { active, label, payload } = props as {
              active?: boolean
              label?: string
              payload?: Array<{ payload?: Record<string, unknown> }>
            }
            if (!active || !payload?.length) return null
            const row = payload[0]?.payload ?? {}
            const items = [
              { key: "approved", label: "Aprobadas", color: "#1AAD58" },
              { key: "cancelled", label: "Canceladas", color: "#FF3B30" },
              { key: "expired", label: "Expiradas", color: "#8E8E93" },
              { key: "review", label: "En revisión", color: "#FFB020" },
              { key: "quoting", label: "En Cotización", color: "#AF52DE" },
              { key: "rejected", label: "Rechazada", color: "#FF2D55" },
            ]

            return (
              <div className="min-w-[220px] rounded-[var(--radius-md)] border bg-card p-3 shadow-soft-sm">
                <div className="text-xs font-semibold text-foreground">{label ?? "—"}</div>
                <div className="mt-2 space-y-1">
                  {items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-muted-foreground">{item.label}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-foreground">
                          {formatNumber(Number(row[item.key] ?? 0))}
                        </div>
                        <div className="text-muted-foreground">
                          {formatCurrencyMXN(Number(row[`${item.key}_amount`] ?? 0))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          }}
          valueFormatter={(v) => formatNumber(v)}
          height={320}
        />
      </ChartPanel>

      <ChartPanel
        title="Demanda de Productos Faltantes"
        subtitle="Cantidad pendiente por surtir/empacar desde cotizaciones aprobadas, pendientes o en seguimiento"
        infoLabel="Presión operativa"
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_360px] xl:items-start">
          <BarChart
            data={missingDemandChart}
            xKey="product"
            bars={[{ dataKey: "demanda_faltante", name: "Demanda faltante (u)" }]}
            height={Math.max(320, missingDemandChart.length * 24)}
            valueFormatter={(v) => `${formatNumber(v)} u`}
            horizontal
            colorScale={[
              "#FF453A", "#FF6B6B", "#FF9F0A", "#FFB020",
              "#FFD60A", "#1AAD58", "#30D158", "#34C759",
              "#00C2FF", "#0A84FF", "#0051FF", "#AF52DE",
              "#BF5AF2", "#E040FB", "#FF6E40",
            ]}
          />
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Análisis Pareto
            </div>
            <div className="overflow-hidden rounded-[var(--radius-md)] border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Producto
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Faltante
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      % Acum
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Venta pend.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {missingDemandParetoRows.map((row) => (
                    <tr key={row.product + (row.sku ?? "")} className="border-t">
                      <td className="px-3 py-2 text-[13px] text-foreground">
                        <div className="truncate max-w-[140px]" title={row.product}>
                          {row.product}
                        </div>
                        {row.sku ? (
                          <div className="text-[11px] text-muted-foreground">SKU {row.sku}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right text-[13px] font-semibold text-foreground">
                        {formatNumber(row.demanda_faltante)} u
                      </td>
                      <td className="px-3 py-2 text-right text-[13px] text-muted-foreground">
                        {formatNumber(row.pareto_percent ?? 0)}%
                      </td>
                      <td className="px-3 py-2 text-right text-[13px] text-muted-foreground">
                        {formatCurrencyMXN(row.valor_venta_pendiente)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {missingDemandParetoRows.length === 0 && missingDemand.status !== "loading" ? (
              <div className="rounded-[var(--radius-md)] border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                Sin productos faltantes en el periodo
              </div>
            ) : null}
          </div>
        </div>
      </ChartPanel>

      <ChartPanel
        title="Predicción de Ventas por Producto"
        subtitle="Promedio móvil de los últimos 3 meses — estima unidades a vender el próximo periodo"
        infoLabel="Pronóstico"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--primary)/0.08)] px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--primary))]">
            <BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" />
            Promedio 3 meses
          </span>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
          <BarChart
            data={forecastChart}
            xKey="product"
            bars={[{ dataKey: "predicted_units", name: "Unidades proyectadas" }]}
            height={Math.max(320, forecastChart.length * 36)}
            valueFormatter={(v) => `${formatNumber(v)} u`}
            horizontal
            colorScale={[
              "#0051FF", "#1AAD58", "#FFB020", "#AF52DE",
              "#FF6B6B", "#00C2FF", "#34C759", "#FF9F0A",
              "#BF5AF2", "#FF453A", "#0A84FF", "#30D158",
              "#FFD60A", "#E040FB", "#FF6E40",
            ]}
          />
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Top productos
            </div>
            {forecastChart.slice(0, 8).map((row, index) => (
              <div
                key={row.product}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border bg-muted/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-foreground">
                    {index + 1}. {row.product}
                  </div>
                  {row.sku ? (
                    <div className="text-[11px] text-muted-foreground">SKU {row.sku}</div>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold text-[hsl(var(--primary))]">
                    {formatNumber(row.predicted_units)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">u / mes</div>
                </div>
              </div>
            ))}
            {forecastChart.length === 0 && productForecast.status !== "loading" ? (
              <div className="rounded-[var(--radius-md)] border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                Sin datos suficientes para proyectar
              </div>
            ) : null}
          </div>
        </div>
      </ChartPanel>

      <ChartPanel
        title="Clientes en Riesgo de Abandono"
        subtitle="Comparación de compras: últimos 90 días vs 90 días previos"
        infoLabel="Retención de clientes"
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
          <BarChart
            data={atRiskChart}
            xKey="customer"
            bars={[
              { dataKey: "ultimos_90", name: "Últimos 90 días", color: "#0051FF" },
              { dataKey: "previos_90", name: "90 días previos", color: "#8E8E93" },
            ]}
            height={Math.max(280, atRiskChart.length * 28)}
            valueFormatter={formatCurrencyMXN}
            horizontal
          />
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Semáforo de riesgo
            </div>
            <div className="overflow-hidden rounded-[var(--radius-md)] border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Cliente
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Últ. 90d
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Prev. 90d
                    </th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Riesgo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(atRiskCustomers.data ?? []).map((row) => {
                    const riskColor =
                      row.riesgo_abandono === "Crítico"
                        ? "bg-red-100 text-red-700"
                        : row.riesgo_abandono === "Alto"
                          ? "bg-orange-100 text-orange-700"
                          : row.riesgo_abandono === "Medio"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                    return (
                      <tr key={row.customer_id ?? row.customer_name} className="border-t">
                        <td className="px-3 py-2 text-[13px] text-foreground">
                          <div className="truncate max-w-[140px]" title={row.customer_name}>
                            {row.customer_name}
                          </div>
                          {row.ultima_compra ? (
                            <div className="text-[11px] text-muted-foreground">
                              {formatIsoDate(row.ultima_compra)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right text-[13px] text-foreground">
                          {formatCurrencyMXN(row.compras_ult_90)}
                        </td>
                        <td className="px-3 py-2 text-right text-[13px] text-muted-foreground">
                          {formatCurrencyMXN(row.compras_90_previos)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${riskColor}`}
                          >
                            {row.riesgo_abandono}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {(atRiskCustomers.data ?? []).length === 0 &&
            atRiskCustomers.status !== "loading" ? (
              <div className="rounded-[var(--radius-md)] border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                Sin datos de clientes para evaluar riesgo
              </div>
            ) : null}
          </div>
        </div>
      </ChartPanel>

      <DataTable
        columns={tableColumns}
        rows={filteredQuotes}
        rowKey={(row) => row.id}
        maxHeight="430px"
        toolbar={
          <>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">Cotizaciones recientes</div>
              <div className="text-xs text-muted-foreground">
                {salesTableSummary} · Últimas cotizaciones ordenadas por created_at
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge variant={recentQuotes.status === "error" ? "error" : "success"}>
                {recentQuotes.status === "error" ? "Revisar cotizaciones" : "Datos cargados"}
              </StatusBadge>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-[var(--radius-md)] border bg-background px-3 text-sm text-foreground shadow-soft-sm focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Filtrar ventas por estado"
              >
                <option value="all">Todos los estados</option>
                <option value="approved">Aprobadas</option>
                <option value="review">En revisión</option>
                <option value="quoting">En Cotización</option>
                <option value="cancelled">Canceladas</option>
                <option value="expired">Expiradas</option>
                <option value="rejected">Rechazadas</option>
              </select>
            </div>
          </>
        }
        emptyLabel={
          recentQuotes.status === "loading"
            ? "Cargando cotizaciones..."
            : "Sin cotizaciones recientes"
        }
      />

      <ChartPanel
        title="Tendencia de Pagos por Cliente"
        subtitle="Promedio de días de pago histórico — Bajo ≤15 d, Medio ≤30 d, Alto >30 d"
        infoLabel="2.3.1 Comportamiento de pago"
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <BarChart
            data={paymentTrendChart}
            xKey="customer"
            bars={[{ dataKey: "dias", name: "Días promedio de pago" }]}
            height={Math.max(380, paymentTrendChart.length * 95)}
            valueFormatter={(v) => `${formatNumber(v)} días`}
            horizontal
            colorScale={paymentTrendChart.map((row) =>
              row.riesgo === "Bajo" ? "#1AAD58" : row.riesgo === "Medio" ? "#FFB020" : "#FF453A"
            )}
          />
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Semáforo de riesgo
            </div>
            <div className="overflow-hidden rounded-[var(--radius-md)] border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Cliente
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Días prom.
                    </th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Riesgo
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Último pago
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paymentTrendChart.map((row) => (
                    <tr key={row.customer} className="border-t">
                      <td className="px-3 py-2 text-[13px] text-foreground">
                        <div className="truncate max-w-[140px]" title={row.customer}>
                          {row.customer}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-[13px] font-semibold text-foreground">
                        {formatNumber(row.dias)} d
                      </td>
                      <td className="px-3 py-2 text-center">
                        <StatusBadge
                          variant={
                            row.riesgo === "Bajo"
                              ? "success"
                              : row.riesgo === "Medio"
                                ? "warning"
                                : "error"
                          }
                        >
                          {row.riesgo}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2 text-right text-[13px] text-muted-foreground">
                        {row.ultimo_pago ? formatIsoDate(row.ultimo_pago) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {paymentTrendChart.length === 0 && paymentTrend.status !== "loading" ? (
              <div className="rounded-[var(--radius-md)] border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                Sin datos de tiempos de pago en el periodo
              </div>
            ) : null}
          </div>
        </div>
      </ChartPanel>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="surface-card border-white/70 bg-white p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Automatización</div>
              <div className="mt-1 text-xs text-muted-foreground">
                El botón de actualización manual se enlazará cuando definamos el flujo real.
              </div>
            </div>
            <StatusBadge variant="warning">Pendiente</StatusBadge>
          </div>
        </div>
        <div className="surface-card border-white/70 bg-white p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Reportería</div>
              <div className="mt-1 text-xs text-muted-foreground">
                La estructura visual ya contempla reporte, CSV y correo para esta vista.
              </div>
            </div>
            <StatusBadge variant="info">Listo para conectar</StatusBadge>
          </div>
        </div>
        <div className="surface-card border-white/70 bg-white p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Fuente de Datos</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Cuando me indiques el origen exacto de cada gráfica, la conecto sin rehacer la UI.
              </div>
            </div>
            <StatusBadge variant="neutral">En espera</StatusBadge>
          </div>
        </div>
      </section>
    </div>
  )
}
