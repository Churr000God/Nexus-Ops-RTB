import { useCallback, useMemo, useState } from "react"
import { EmailReportModal } from "@/components/common/EmailReportModal"
import { ReportModal } from "@/components/common/ReportModal"
import {
  BarChart3,
  BrainCircuit,
  Clock,
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
import { ComboBarLineChart } from "@/components/charts/ComboBarLineChart"
import { LineChart } from "@/components/charts/LineChart"
import { PieChart } from "@/components/charts/PieChart"
import { AtRiskCustomerSearch } from "@/components/common/AtRiskCustomerSearch"
import { CustomerSearchInput } from "@/components/common/CustomerSearchInput"
import { PaymentCustomerSearch } from "@/components/common/PaymentCustomerSearch"
import { ProductSearchInput } from "@/components/common/ProductSearchInput"
import { QuoteSearchInput } from "@/components/common/QuoteSearchInput"
import { DataTable } from "@/components/common/DataTable"
import { DateRangePicker } from "@/components/common/DateRangePicker"
import { KpiCard } from "@/components/common/KpiCard"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/useApi"
import { useFilters } from "@/hooks/useFilters"
import { ventasService } from "@/services/ventasService"
import { useAuthStore } from "@/stores/authStore"
import { useSyncStore } from "@/stores/syncStore"
import { exportVentasDashboardToZip } from "@/lib/dashboardExport"
import { formatCurrencyMXN, formatIsoDate, formatNumber } from "@/lib/utils"
import type {
  ApprovalTimeTrend,
  AtRiskCustomer,
  CustomerPaymentStat,
  CustomerSearchItem,
  PendingPaymentCustomer,
  PendingPaymentStat,
  AvgSalesByCustomerType,
  MonthlyGrowthYoYByCustomerType,
  PaymentTrend,
  ProductsByCustomerType,
  QuarterlyGrowthByCustomerType,
  RecentQuote,
  SalesByCustomerType,
} from "@/types/ventas"

export function VentasDashboard() {
  const token = useAuthStore((s) => s.accessToken)
  const syncVersion = useSyncStore((s) => s.syncVersion)
  const { datePreset, startDate, endDate, setDatePreset, setDateRange, reset } = useFilters()
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const [customerSearch, setCustomerSearch] = useState("")
  const [selectedMonthYoY, setSelectedMonthYoY] = useState<number | null>(null)
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null)
  const [productSearch, setProductSearch] = useState("")
  const [selectedProductSku, setSelectedProductSku] = useState<string | null>(null)
  const [marginProductSearch, setMarginProductSearch] = useState("")
  const [selectedMarginProductSku, setSelectedMarginProductSku] = useState<string | null>(null)
  const [missingDemandSearch, setMissingDemandSearch] = useState("")
  const [selectedMissingDemandSku, setSelectedMissingDemandSku] = useState<string | null>(null)
  const [forecastProductSearch, setForecastProductSearch] = useState("")
  const [selectedForecastProductSku, setSelectedForecastProductSku] = useState<string | null>(null)
  const [quoteSearch, setQuoteSearch] = useState("")
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)
  const [selectedAtRiskCustomer, setSelectedAtRiskCustomer] = useState<AtRiskCustomer | null>(null)
  const [selectedPaymentCustomer, setSelectedPaymentCustomer] = useState<CustomerSearchItem | null>(null)
  const [paymentCustomerQuery, setPaymentCustomerQuery] = useState("")
  const [selectedPendingCustomer, setSelectedPendingCustomer] = useState<CustomerSearchItem | null>(null)
  const [pendingCustomerQuery, setPendingCustomerQuery] = useState("")

  const fetchSummary = useCallback(
    (signal: AbortSignal) =>
      ventasService.salesSummary(token ?? "", { startDate, endDate }, signal),
    [token, startDate, endDate, syncVersion]
  )
  const summary = useApi(
    fetchSummary,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion
  )

  const fetchSalesProjection = useCallback(
    (signal: AbortSignal) =>
      ventasService.salesVsProjection(token ?? "", { startDate, endDate }, signal),
    [token, startDate, endDate, syncVersion]
  )
  const salesProjection = useApi(
    fetchSalesProjection,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion
  )

  const fetchTopCustomers = useCallback(
    (signal: AbortSignal) =>
      ventasService.topCustomers(
        token ?? "",
        { startDate, endDate, limit: customerSearch ? 50 : 10, customerSearch: customerSearch || undefined },
        signal
      ),
    [token, startDate, endDate, syncVersion, customerSearch]
  )
  const topCustomers = useApi(
    fetchTopCustomers,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion, customerSearch
  )

  const fetchProductDistribution = useCallback(
    (signal: AbortSignal) =>
      ventasService.productDistribution(
        token ?? "",
        {
          startDate,
          endDate,
          limit: selectedProductSku ? 1 : 10,
          productSearch: selectedProductSku || productSearch || undefined,
        },
        signal
      ),
    [token, startDate, endDate, syncVersion, productSearch, selectedProductSku]
  )
  const productDistribution = useApi(
    fetchProductDistribution,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion, productSearch, selectedProductSku
  )

  const fetchQuoteStatusByMonth = useCallback(
    (signal: AbortSignal) =>
      ventasService.quoteStatusByMonth(token ?? "", { startDate, endDate }, signal),
    [token, startDate, endDate, syncVersion]
  )
  const quoteStatusByMonth = useApi(
    fetchQuoteStatusByMonth,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion
  )

  const fetchGrossMarginByProduct = useCallback(
    (signal: AbortSignal) =>
      ventasService.grossMarginByProduct(
        token ?? "",
        {
          startDate,
          endDate,
          limit: selectedMarginProductSku ? 1 : 10,
          productSearch: selectedMarginProductSku || marginProductSearch || undefined,
        },
        signal
      ),
    [token, startDate, endDate, syncVersion, marginProductSearch, selectedMarginProductSku]
  )
  const grossMarginByProduct = useApi(
    fetchGrossMarginByProduct,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion, marginProductSearch, selectedMarginProductSku
  )

  const fetchRecentQuotes = useCallback(
    (signal: AbortSignal) =>
      ventasService.recentQuotes(
        token ?? "",
        {
          limit: selectedQuoteId ? 1 : quoteSearch ? 30 : 10,
          status: statusFilter === "all" ? null : statusFilter,
          search: selectedQuoteId || quoteSearch || undefined,
        },
        signal
      ),
    [token, statusFilter, syncVersion, quoteSearch, selectedQuoteId]
  )
  const recentQuotes = useApi(
    fetchRecentQuotes,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion, statusFilter, quoteSearch, selectedQuoteId
  )

  const fetchProductForecast = useCallback(
    (signal: AbortSignal) =>
      ventasService.productForecast(token ?? "", {
        startDate,
        endDate,
        limit: selectedForecastProductSku ? 1 : 10,
        monthsWindow: 3,
        productSearch: selectedForecastProductSku || forecastProductSearch || undefined,
      }, signal),
    [token, startDate, endDate, syncVersion, forecastProductSearch, selectedForecastProductSku]
  )
  const productForecast = useApi(
    fetchProductForecast,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion, forecastProductSearch, selectedForecastProductSku
  )

  const fetchMissingDemand = useCallback(
    (signal: AbortSignal) =>
      ventasService.missingDemand(
        token ?? "",
        {
          startDate,
          endDate,
          limit: selectedMissingDemandSku ? 1 : 10,
          productSearch: selectedMissingDemandSku || missingDemandSearch || undefined,
        },
        signal
      ),
    [token, startDate, endDate, syncVersion, missingDemandSearch, selectedMissingDemandSku]
  )
  const missingDemand = useApi(
    fetchMissingDemand,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion, missingDemandSearch, selectedMissingDemandSku
  )

  const fetchAtRiskCustomers = useCallback(
    (signal: AbortSignal) => ventasService.atRiskCustomers(token ?? "", signal),
    [token, syncVersion]
  )
  const atRiskCustomers = useApi(
    fetchAtRiskCustomers,
    { enabled: Boolean(token) },
    token, syncVersion
  )

  const fetchPendingPayments = useCallback(
    (signal: AbortSignal) => ventasService.pendingPayments(token ?? "", signal),
    [token, syncVersion]
  )
  const pendingPayments = useApi(
    fetchPendingPayments,
    { enabled: Boolean(token) },
    token, syncVersion
  )

  const fetchPaymentTrend = useCallback(
    (signal: AbortSignal) =>
      ventasService.paymentTrend(token ?? "", { startDate, endDate, limit: 20 }, signal),
    [token, startDate, endDate, syncVersion]
  )
  const paymentTrend = useApi(
    fetchPaymentTrend,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion
  )

  const fetchPaymentCustomerSearch = useCallback(
    (signal: AbortSignal) =>
      paymentCustomerQuery.length >= 2
        ? ventasService.customerSearch(token ?? "", paymentCustomerQuery, signal)
        : Promise.resolve([] as CustomerSearchItem[]),
    [token, paymentCustomerQuery]
  )
  const paymentCustomerSearchResult = useApi(
    fetchPaymentCustomerSearch,
    { enabled: Boolean(token) && paymentCustomerQuery.length >= 2 },
    token, paymentCustomerQuery
  )

  const fetchCustomerPaymentStats = useCallback(
    (signal: AbortSignal) =>
      ventasService.customerPaymentStats(
        token ?? "",
        { customerId: selectedPaymentCustomer?.id ?? undefined },
        signal
      ),
    [token, selectedPaymentCustomer?.id, syncVersion]
  )
  const customerPaymentStats = useApi(
    fetchCustomerPaymentStats,
    { enabled: Boolean(token) },
    token, selectedPaymentCustomer?.id, syncVersion
  )

  const fetchPendingCustomerSearch = useCallback(
    (signal: AbortSignal) =>
      pendingCustomerQuery.length >= 2
        ? ventasService.customerSearch(token ?? "", pendingCustomerQuery, signal)
        : Promise.resolve([] as CustomerSearchItem[]),
    [token, pendingCustomerQuery]
  )
  const pendingCustomerSearchResult = useApi(
    fetchPendingCustomerSearch,
    { enabled: Boolean(token) && pendingCustomerQuery.length >= 2 },
    token, pendingCustomerQuery
  )

  const fetchPendingPaymentStats = useCallback(
    (signal: AbortSignal) =>
      ventasService.pendingPaymentStats(
        token ?? "",
        { customerId: selectedPendingCustomer?.id ?? undefined },
        signal
      ),
    [token, selectedPendingCustomer?.id, syncVersion]
  )
  const pendingPaymentStats = useApi(
    fetchPendingPaymentStats,
    { enabled: Boolean(token) },
    token, selectedPendingCustomer?.id, syncVersion
  )

  const fetchProductsByCustomerType = useCallback(
    (signal: AbortSignal) =>
      ventasService.productsByCustomerType(token ?? "", { startDate: startDate ?? undefined, endDate: endDate ?? undefined }, signal),
    [token, startDate, endDate, syncVersion]
  )
  const productsByCustomerType = useApi(
    fetchProductsByCustomerType,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion
  )

  const fetchSalesByCustomerType = useCallback(
    (signal: AbortSignal) =>
      ventasService.salesByCustomerType(token ?? "", { startDate, endDate }, signal),
    [token, startDate, endDate, syncVersion]
  )
  const salesByCustomerType = useApi(
    fetchSalesByCustomerType,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion
  )

  const fetchAvgSalesByCustomerType = useCallback(
    (signal: AbortSignal) =>
      ventasService.avgSalesByCustomerType(token ?? "", { startDate, endDate }, signal),
    [token, startDate, endDate, syncVersion]
  )
  const avgSalesByCustomerType = useApi(
    fetchAvgSalesByCustomerType,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion
  )

  const fetchQuarterlyGrowth = useCallback(
    (signal: AbortSignal) =>
      ventasService.quarterlyGrowthByCustomerType(
        token ?? "",
        { selectedQuarter },
        signal
      ),
    [token, syncVersion, selectedQuarter]
  )
  const quarterlyGrowth = useApi(
    fetchQuarterlyGrowth,
    { enabled: Boolean(token) },
    token, syncVersion, selectedQuarter
  )

  const fetchMonthlyGrowthYoY = useCallback(
    (signal: AbortSignal) =>
      ventasService.monthlyGrowthYoYByCustomerType(
        token ?? "",
        { selectedMonth: selectedMonthYoY },
        signal
      ),
    [token, syncVersion, selectedMonthYoY]
  )
  const monthlyGrowthYoY = useApi(
    fetchMonthlyGrowthYoY,
    { enabled: Boolean(token) },
    token, syncVersion, selectedMonthYoY
  )

  const fetchApprovalTimeTrend = useCallback(
    (signal: AbortSignal) =>
      ventasService.approvalTimeTrend(token ?? "", { startDate, endDate }, signal),
    [token, startDate, endDate, syncVersion]
  )
  const approvalTimeTrend = useApi(
    fetchApprovalTimeTrend,
    { enabled: Boolean(token) },
    token, startDate, endDate, syncVersion
  )

  const kpis = useMemo(() => {
    const data = summary.data
    const trendRows = (approvalTimeTrend.data ?? []).filter(
      (r: ApprovalTimeTrend) => r.count > 0 && r.avg_days !== null
    )
    const avgApprovalDays =
      trendRows.length > 0
        ? trendRows.reduce((acc: number, r: ApprovalTimeTrend) => acc + (r.avg_days ?? 0), 0) / trendRows.length
        : null
    const approvalDaysLabel =
      avgApprovalDays !== null ? `${formatNumber(avgApprovalDays)} días` : "—"

    if (!data) {
      return {
        totalSales: "—",
        pendingQuotes: "—",
        marginPct: "—",
        conversionRate: "—",
        approvedQuotes: "—",
        reviewQuotes: "—",
        avgApprovalDays: approvalDaysLabel,
      }
    }

    return {
      totalSales: formatCurrencyMXN(data.total_sales),
      pendingQuotes: formatNumber(data.pending_quotes),
      marginPct: `${formatNumber(data.average_margin_percent)}%`,
      conversionRate: `${formatNumber(data.conversion_rate)}%`,
      approvedQuotes: formatNumber(data.approved_quotes),
      reviewQuotes: formatNumber(data.review_quotes),
      avgApprovalDays: approvalDaysLabel,
    }
  }, [summary.data, approvalTimeTrend.data])

  const pendingQuotesBadge = useMemo(() => {
    const target = endDate ? new Date(`${endDate}T12:00:00`) : new Date()
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0)
    const day = String(lastDay.getDate()).padStart(2, "0")
    const month = lastDay.toLocaleDateString("es-MX", { month: "short" })
    return `Vencen el ${day} ${month}`
  }, [endDate])

  const handleCustomerSearch = useCallback((value: string) => {
    setCustomerSearch(value)
  }, [])

  const handleProductSearch = useCallback((value: string) => {
    setProductSearch(value)
    if (!value.trim()) {
      setSelectedProductSku(null)
    }
  }, [])

  const handleProductSelect = useCallback((sku: string | null, _name: string) => {
    setSelectedProductSku(sku)
  }, [])

  const handleMarginProductSearch = useCallback((value: string) => {
    setMarginProductSearch(value)
    if (!value.trim()) {
      setSelectedMarginProductSku(null)
    }
  }, [])

  const handleMarginProductSelect = useCallback((sku: string | null, _name: string) => {
    setSelectedMarginProductSku(sku)
  }, [])

  const handleMissingDemandSearch = useCallback((value: string) => {
    setMissingDemandSearch(value)
    if (!value.trim()) {
      setSelectedMissingDemandSku(null)
    }
  }, [])

  const handleMissingDemandSelect = useCallback((sku: string | null, _name: string) => {
    setSelectedMissingDemandSku(sku)
  }, [])

  const handleForecastProductSearch = useCallback((value: string) => {
    setForecastProductSearch(value)
    if (!value.trim()) {
      setSelectedForecastProductSku(null)
    }
  }, [])

  const handleForecastProductSelect = useCallback((sku: string | null, _name: string) => {
    setSelectedForecastProductSku(sku)
  }, [])

  const handleQuoteSearch = useCallback((value: string) => {
    setQuoteSearch(value)
    if (!value.trim()) {
      setSelectedQuoteId(null)
    }
  }, [])

  const handleQuoteSelect = useCallback((id: string | null) => {
    setSelectedQuoteId(id)
  }, [])

  const byCustomerChart = useMemo(() => {
    return (topCustomers.data ?? []).map((row) => ({
      customer: row.customer,
      category: row.category ?? "—",
      revenue: row.total_revenue,
      sales: row.sale_count,
    }))
  }, [topCustomers.data])

  const productsByCustomerTypeChart = useMemo(() => {
    return (productsByCustomerType.data ?? []).map((row: ProductsByCustomerType) => ({
      tipo: row.tipo_cliente,
      solicitada: row.cantidad_solicitada,
      empacada: row.cantidad_empacada,
    }))
  }, [productsByCustomerType.data])

  const projectionChart = useMemo(() => {
    const rows = salesProjection.data ?? []
    return rows.map((row, index) => {
      const prev = index > 0 ? rows[index - 1]?.subtotal : null
      const momChange =
        typeof prev === "number" && prev > 0
          ? ((row.subtotal - prev) / prev) * 100
          : null

      return {
        month: row.year_month,
        subtotal: row.subtotal,
        total_con_iva: row.total_con_iva,
        margen_bruto: row.margen_bruto,
        costo_compra: row.costo_compra,
        proyeccion: row.projected_sales,
        cantidad_ventas: row.num_ventas,
        variacion_porcentual: momChange,
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
      product: selectedMarginProductSku ? row.sku ?? row.product : row.product,
      gross_margin: row.gross_margin,
      margin_percent: row.margin_percent ?? 0,
      revenue: row.revenue,
      sku: row.sku,
      qty: row.qty,
      cost: row.cost,
    }))
  }, [grossMarginByProduct.data, selectedMarginProductSku])

  const forecastChart = useMemo(() => {
    return (productForecast.data ?? []).map((row) => ({
      product: row.product,
      predicted_units: row.predicted_units,
      sku: row.sku ?? "",
      category: row.category ?? "",
    }))
  }, [productForecast.data])

  const forecastProductSuggestions = useMemo(() => {
    return (productForecast.data ?? []).map((row) => ({
      product: row.product,
      sku: row.sku,
      qty: row.predicted_units,
    }))
  }, [productForecast.data])

  const missingDemandChart = useMemo(() => {
    return (missingDemand.data ?? []).map((row) => ({
      product: selectedMissingDemandSku ? row.sku ?? row.product : row.product,
      demanda_faltante: row.demanda_faltante,
      sku: row.sku ?? "",
    }))
  }, [missingDemand.data, selectedMissingDemandSku])

  const RISK_ORDER: Record<string, number> = { Crítico: 0, Alto: 1, Medio: 2 }

  const atRiskSorted = useMemo(() => {
    const all = atRiskCustomers.data ?? []
    return [...all].sort((a, b) => {
      const rDiff = (RISK_ORDER[a.riesgo_abandono] ?? 3) - (RISK_ORDER[b.riesgo_abandono] ?? 3)
      if (rDiff !== 0) return rDiff
      return a.compras_ult_90 - b.compras_ult_90
    })
  }, [atRiskCustomers.data])

  const atRiskVisible = useMemo(
    () => (selectedAtRiskCustomer ? [selectedAtRiskCustomer] : atRiskSorted.slice(0, 10)),
    [selectedAtRiskCustomer, atRiskSorted]
  )

  const atRiskChart = useMemo(() => {
    return atRiskVisible.map((row) => ({
      customer: row.customer_name,
      ultimos_90: row.compras_ult_90,
      previos_90: row.compras_90_previos,
    }))
  }, [atRiskVisible])

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
      sku: row.sku ?? "—",
      qty: formatNumber(row.qty),
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

    const base = top.map((row) => ({ name: row.sku ?? row.product, value: row.revenue }))
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

  const approvalTimeChart = useMemo(() => {
    return (approvalTimeTrend.data ?? []).map((row: ApprovalTimeTrend) => ({
      month: row.year_month,
      promedio: row.avg_days ?? undefined,
      superior: row.upper_days ?? undefined,
      inferior: row.lower_days ?? undefined,
      proyeccion: row.projected_days ?? undefined,
    }))
  }, [approvalTimeTrend.data])

  const salesByCustomerTypeChart = useMemo(() => {
    const labelFor = (tipo: string) => {
      const normalized = (tipo ?? "").trim().toLowerCase()
      if (normalized === "foraneo" || normalized === "foráneo") return "Foráneo"
      if (normalized === "local") return "Local"
      return tipo || "Sin tipo"
    }

    return (salesByCustomerType.data ?? []).map((row: SalesByCustomerType) => ({
      tipo: labelFor(row.tipo_cliente),
      ventas: row.total_ventas,
      porcentaje: row.porcentaje_ventas,
    }))
  }, [salesByCustomerType.data])

  const salesByCustomerTypePie = useMemo(() => {
    return salesByCustomerTypeChart.map((row) => ({ name: row.tipo, value: row.ventas }))
  }, [salesByCustomerTypeChart])

  const avgSalesByCustomerTypeChart = useMemo(() => {
    const labelFor = (tipo: string) => {
      const normalized = (tipo ?? "").trim().toLowerCase()
      if (normalized === "foraneo" || normalized === "foráneo") return "Foráneo"
      if (normalized === "local") return "Local"
      return tipo || "Sin tipo"
    }

    return (avgSalesByCustomerType.data ?? []).map((row: AvgSalesByCustomerType) => ({
      tipo: labelFor(row.tipo_cliente),
      venta_promedio: row.venta_promedio_por_cliente,
      numero_clientes: row.numero_clientes,
    }))
  }, [avgSalesByCustomerType.data])

  const quarterlyGrowthChart = useMemo(() => {
    const labelFor = (tipo: string) => {
      const normalized = (tipo ?? "").trim().toLowerCase()
      if (normalized === "foraneo" || normalized === "foráneo") return "Foráneo"
      if (normalized === "local") return "Local"
      return tipo || "Sin tipo"
    }

    return (quarterlyGrowth.data ?? []).map((row: QuarterlyGrowthByCustomerType) => ({
      tipo: labelFor(row.tipo_cliente),
      trim_actual: row.ventas_trim_actual,
      trim_anio_pasado: row.ventas_trim_anio_pasado,
      crecimiento_pct: row.crecimiento_trimestral_pct,
    }))
  }, [quarterlyGrowth.data])

  const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
  const QUARTERS_ES = ["T1 (Ene–Mar)", "T2 (Abr–Jun)", "T3 (Jul–Sep)", "T4 (Oct–Dic)"]

  const availableMonthsYoY = useMemo(() => {
    const current = new Date().getMonth() + 1
    return Array.from({ length: current }, (_, i) => ({ value: i + 1, label: MONTHS_ES[i] }))
  }, [])

  const availableQuartersYoY = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1
    const currentQuarter = Math.ceil(currentMonth / 3)
    return Array.from({ length: currentQuarter }, (_, i) => ({ value: i + 1, label: QUARTERS_ES[i] }))
  }, [])

  const selectedMonthYoYLabel = selectedMonthYoY
    ? MONTHS_ES[selectedMonthYoY - 1]
    : MONTHS_ES[new Date().getMonth()]

  const selectedQuarterYoYLabel = selectedQuarter
    ? QUARTERS_ES[selectedQuarter - 1]
    : QUARTERS_ES[Math.ceil((new Date().getMonth() + 1) / 3) - 1]

  const monthlyGrowthYoYChart = useMemo(() => {
    return (monthlyGrowthYoY.data ?? []).map((row: MonthlyGrowthYoYByCustomerType) => ({
      tipo: row.tipo_cliente,
      mes_actual: row.ventas_mes_actual,
      mes_anio_pasado: row.ventas_mismo_mes_anio_pasado,
      crecimiento_pct: row.tasa_crecimiento_pct,
    }))
  }, [monthlyGrowthYoY.data])

  const filteredQuotes = useMemo(() => {
    const rows = recentQuotes.data ?? []
    if (selectedQuoteId) {
      return rows.filter((row) => row.id === selectedQuoteId)
    }
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
  }, [recentQuotes.data, statusFilter, selectedQuoteId])

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
    salesByCustomerType.status === "error" ||
    avgSalesByCustomerType.status === "error" ||
    monthlyGrowthYoY.status === "error" ||
    quarterlyGrowth.status === "error" ||
    productDistribution.status === "error" ||
    quoteStatusByMonth.status === "error" ||
    grossMarginByProduct.status === "error" ||
    recentQuotes.status === "error" ||
    missingDemand.status === "error" ||
    atRiskCustomers.status === "error" ||
    paymentTrend.status === "error" ||
    approvalTimeTrend.status === "error"

  const firstError =
    summary.error ??
    salesProjection.error ??
    topCustomers.error ??
    salesByCustomerType.error ??
    avgSalesByCustomerType.error ??
    monthlyGrowthYoY.error ??
    quarterlyGrowth.error ??
    productDistribution.error ??
    quoteStatusByMonth.error ??
    grossMarginByProduct.error ??
    recentQuotes.error ??
    missingDemand.error ??
    atRiskCustomers.error ??
    paymentTrend.error ??
    approvalTimeTrend.error

  const isLoading =
    summary.status === "loading" ||
    salesProjection.status === "loading" ||
    topCustomers.status === "loading" ||
    salesByCustomerType.status === "loading" ||
    avgSalesByCustomerType.status === "loading" ||
    monthlyGrowthYoY.status === "loading" ||
    quarterlyGrowth.status === "loading" ||
    productDistribution.status === "loading" ||
    quoteStatusByMonth.status === "loading" ||
    grossMarginByProduct.status === "loading" ||
    recentQuotes.status === "loading" ||
    missingDemand.status === "loading" ||
    atRiskCustomers.status === "loading" ||
    paymentTrend.status === "loading" ||
    approvalTimeTrend.status === "loading"

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

          <div className="grid gap-2 xl:min-w-[200px]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReportModalOpen(true)}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Reporte
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                toast.info("Generando archivos CSV, espera un momento…")
                try {
                  await exportVentasDashboardToZip({
                    summary: summary.data,
                    salesVsProjection: salesProjection.data,
                    topCustomers: topCustomers.data,
                    salesByCustomerType: salesByCustomerType.data,
                    productDistribution: productDistribution.data,
                    grossMarginByProduct: grossMarginByProduct.data,
                    quoteStatusByMonth: quoteStatusByMonth.data,
                    missingDemand: missingDemand.data,
                    productForecast: productForecast.data,
                    atRiskCustomers: atRiskCustomers.data,
                    paymentTrend: paymentTrend.data,
                    recentQuotes: recentQuotes.data,
                    pendingPayments: pendingPayments.data,
                    productsByCustomerType: productsByCustomerType.data,
                    avgSalesByCustomerType: avgSalesByCustomerType.data,
                    quarterlyGrowth: quarterlyGrowth.data,
                    monthlyGrowthYoY: monthlyGrowthYoY.data,
                  })
                  toast.success("Dashboard exportado correctamente")
                } catch {
                  toast.error("Error al exportar el dashboard")
                }
              }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => setEmailModalOpen(true)}>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
        <KpiCard
          title="Tiempo Promedio de Aprobación"
          value={kpis.avgApprovalDays}
          description="Desde creación de cotización hasta venta registrada"
          icon={Clock}
          tone="neutral"
        />
      </div>

      <div className="grid gap-4">
        <ChartPanel
          title="Productos Vendidos por Tipo de Cliente"
          subtitle="Unidades de cotizaciones Aprobadas — cantidad solicitada vs. empacada"
          infoLabel="3.1.2 Volumen por segmento"
        >
          <BarChart
            data={productsByCustomerTypeChart}
            xKey="tipo"
            bars={[
              { dataKey: "solicitada", name: "Solicitada", color: "hsl(var(--primary))" },
              { dataKey: "empacada", name: "Empacada", color: "hsl(var(--chart-2))" },
            ]}
            valueFormatter={(v) => formatNumber(v)}
            height={260}
          />
        </ChartPanel>

        <ChartPanel
          title={customerSearch ? `Clientes: "${customerSearch}"` : "Top 10 Clientes por Ventas"}
          subtitle="Cotizaciones Aprobadas — monto subtotal por cliente, de mayor a menor"
          infoLabel="Top de clientes"
        >
          {/* Buscador con sugerencias */}
          <CustomerSearchInput
            suggestions={byCustomerChart}
            loading={topCustomers.status === "loading"}
            onSearch={handleCustomerSearch}
          />

          {byCustomerChart.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-sm text-muted-foreground">
              {customerSearch ? `Sin resultados para "${customerSearch}"` : "Sin datos"}
            </div>
          ) : (
            <BarChart
              data={byCustomerChart}
              xKey="customer"
              bars={[{ dataKey: "revenue", name: "Subtotal (cotiz. aprobadas)", color: "hsl(var(--primary))" }]}
              valueFormatter={formatCurrencyMXN}
              height={360}
            />
          )}
        </ChartPanel>

        <ChartPanel
          title="Ventas por Tipo de Cliente"
          subtitle="Monto total de ventas (solo ventas con estado Aprobada) para Local vs Foráneo"
          infoLabel="3.1.1 Tipo de cliente"
        >
          {salesByCustomerType.status === "loading" ? (
            <div
              className="flex items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground"
              style={{ height: 340 }}
            >
              Cargando ventas por tipo de cliente...
            </div>
          ) : salesByCustomerType.status === "error" ? (
            <div className="rounded-lg border bg-card p-4 text-sm text-destructive">
              No se pudo cargar la métrica de ventas por tipo de cliente.{" "}
              {salesByCustomerType.error?.message ?? "Error desconocido"}
            </div>
          ) : salesByCustomerTypeChart.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-sm text-muted-foreground">
              Sin ventas para Local/Foráneo en el periodo
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_420px] xl:items-start">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Participación
                </div>
                <PieChart
                  data={salesByCustomerTypePie}
                  nameKey="name"
                  valueKey="value"
                  valueFormatter={formatCurrencyMXN}
                  height={280}
                  innerRadius={70}
                  outerRadius={110}
                />
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Comparación
                </div>
                <BarChart
                  data={salesByCustomerTypeChart}
                  xKey="tipo"
                  bars={[{ dataKey: "ventas", name: "Ventas", color: "hsl(var(--primary))" }]}
                  valueFormatter={formatCurrencyMXN}
                  height={280}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Detalle
                </div>
                <div className="overflow-hidden rounded-[var(--radius-md)] border">
                  <table className="w-full text-sm" aria-label="Ventas por tipo de cliente">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Tipo
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Ventas
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesByCustomerTypeChart.map((row) => (
                        <tr key={row.tipo} className="border-t">
                          <td className="px-3 py-2 text-[13px] text-foreground">{row.tipo}</td>
                          <td className="px-3 py-2 text-right text-[13px] font-semibold text-foreground">
                            {formatCurrencyMXN(row.ventas)}
                          </td>
                          <td className="px-3 py-2 text-right text-[13px] text-muted-foreground">
                            {formatNumber(row.porcentaje)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-[var(--radius-md)] border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                  Indicador: permite identificar qué tipo de cliente genera mayor ingreso.
                </div>
              </div>
            </div>
          )}
        </ChartPanel>

        <ChartPanel
          title="Venta Promedio por Cliente"
          subtitle="Monto promedio vendido por cliente (solo ventas con estado Aprobada) — Locales vs Foráneos"
          infoLabel="3.2.1 Venta promedio"
        >
          {avgSalesByCustomerType.status === "loading" ? (
            <div
              className="flex items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground"
              style={{ height: 340 }}
            >
              Cargando venta promedio por cliente...
            </div>
          ) : avgSalesByCustomerType.status === "error" ? (
            <div className="rounded-lg border bg-card p-4 text-sm text-destructive">
              No se pudo cargar la métrica de venta promedio por cliente.{" "}
              {avgSalesByCustomerType.error?.message ?? "Error desconocido"}
            </div>
          ) : avgSalesByCustomerTypeChart.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-sm text-muted-foreground">
              Sin datos de clientes Local/Foráneo en el periodo
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Comparación
                </div>
                <BarChart
                  data={avgSalesByCustomerTypeChart}
                  xKey="tipo"
                  bars={[{ dataKey: "venta_promedio", name: "Venta promedio", color: "#AF52DE" }]}
                  valueFormatter={formatCurrencyMXN}
                  height={320}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Detalle
                </div>
                <div className="overflow-hidden rounded-[var(--radius-md)] border">
                  <table className="w-full text-sm" aria-label="Venta promedio por tipo de cliente">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Tipo
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Clientes
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Promedio
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {avgSalesByCustomerTypeChart.map((row) => (
                        <tr key={row.tipo} className="border-t">
                          <td className="px-3 py-2 text-[13px] text-foreground">{row.tipo}</td>
                          <td className="px-3 py-2 text-right text-[13px] font-semibold text-foreground">
                            {formatNumber(row.numero_clientes)}
                          </td>
                          <td className="px-3 py-2 text-right text-[13px] text-muted-foreground">
                            {formatCurrencyMXN(row.venta_promedio)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-[var(--radius-md)] border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                  Indicador: permite detectar si un tipo de cliente genera ventas más grandes en promedio.
                </div>
              </div>
            </div>
          )}
        </ChartPanel>

        <ChartPanel
          title={`Crecimiento mensual — ${selectedMonthYoYLabel} vs ${selectedMonthYoYLabel} año anterior`}
          subtitle="Ventas reales (subtotal ventas) por tipo de cliente vs mismo mes del año pasado"
          infoLabel="3.3.1 Crecimiento mensual YoY"
          action={
            <select
              value={selectedMonthYoY ?? ""}
              onChange={(e) => setSelectedMonthYoY(e.target.value ? Number(e.target.value) : null)}
              className="h-8 rounded-[var(--radius-md)] border bg-background px-2 text-xs text-foreground shadow-soft-sm focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Seleccionar mes"
            >
              <option value="">Mes actual</option>
              {availableMonthsYoY.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          }
        >
          {monthlyGrowthYoY.status === "loading" ? (
            <div
              className="flex items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground"
              style={{ height: 340 }}
            >
              Cargando crecimiento mensual...
            </div>
          ) : monthlyGrowthYoY.status === "error" ? (
            <div className="rounded-lg border bg-card p-4 text-sm text-destructive">
              No se pudo cargar el crecimiento mensual. {monthlyGrowthYoY.error?.message ?? "Error desconocido"}
            </div>
          ) : monthlyGrowthYoYChart.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-sm text-muted-foreground">
              Sin datos de crecimiento mensual
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Columnas + línea de crecimiento
                </div>
                <ComboBarLineChart
                  data={monthlyGrowthYoYChart}
                  xKey="tipo"
                  bars={[
                    { dataKey: "mes_actual", name: "Mes actual", color: "#0051FF" },
                    { dataKey: "mes_anio_pasado", name: "Mismo mes año pasado", color: "#8E8E93" },
                  ]}
                  lines={[
                    { dataKey: "crecimiento_pct", name: "Crecimiento %", color: "#34C759", yAxisId: "right" },
                  ]}
                  leftValueFormatter={formatCurrencyMXN}
                  rightValueFormatter={(v) => `${formatNumber(v)}%`}
                  height={340}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Detalle
                </div>
                <div className="overflow-hidden rounded-[var(--radius-md)] border">
                  <table className="w-full text-sm" aria-label="Crecimiento mensual vs año anterior por tipo de cliente">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Tipo
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Mes actual
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Año ant.
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Crec. %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyGrowthYoYChart.map((row) => {
                        const growth = row.crecimiento_pct
                        const growthValue = typeof growth === "number" ? growth : null
                        return (
                          <tr key={row.tipo} className="border-t">
                            <td className="px-3 py-2 text-[13px] text-foreground">{row.tipo}</td>
                            <td className="px-3 py-2 text-right text-[13px] font-semibold text-foreground">
                              {formatCurrencyMXN(row.mes_actual)}
                            </td>
                            <td className="px-3 py-2 text-right text-[13px] text-muted-foreground">
                              {formatCurrencyMXN(row.mes_anio_pasado)}
                            </td>
                            <td className="px-3 py-2 text-right text-[13px]">
                              {growthValue === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span
                                  className={
                                    growthValue > 0
                                      ? "font-semibold text-green-600"
                                      : growthValue < 0
                                        ? "font-semibold text-red-600"
                                        : "text-muted-foreground"
                                  }
                                >
                                  {growthValue > 0 ? "+" : ""}
                                  {formatNumber(growthValue)}%
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-[var(--radius-md)] border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                  Indicador: permite ver si el crecimiento viene más de clientes Locales o Foráneos.
                </div>
              </div>
            </div>
          )}
        </ChartPanel>

        <ChartPanel
          title={`Crecimiento trimestral — ${selectedQuarterYoYLabel} vs ${selectedQuarterYoYLabel} año anterior`}
          subtitle="Ventas reales (subtotal ventas) por tipo de cliente vs mismo trimestre del año pasado"
          infoLabel="3.3.2 Crecimiento trimestral"
          action={
            <select
              value={selectedQuarter ?? ""}
              onChange={(e) => setSelectedQuarter(e.target.value ? Number(e.target.value) : null)}
              className="h-8 rounded-[var(--radius-md)] border bg-background px-2 text-xs text-foreground shadow-soft-sm focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Seleccionar trimestre"
            >
              <option value="">Trimestre actual</option>
              {availableQuartersYoY.map((q) => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
          }
        >
          {quarterlyGrowth.status === "loading" ? (
            <div
              className="flex items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground"
              style={{ height: 340 }}
            >
              Cargando crecimiento trimestral...
            </div>
          ) : quarterlyGrowth.status === "error" ? (
            <div className="rounded-lg border bg-card p-4 text-sm text-destructive">
              No se pudo cargar el crecimiento trimestral.{" "}
              {quarterlyGrowth.error?.message ?? "Error desconocido"}
            </div>
          ) : quarterlyGrowthChart.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-sm text-muted-foreground">
              Sin datos de crecimiento trimestral
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Columnas + línea de crecimiento
                </div>
                <ComboBarLineChart
                  data={quarterlyGrowthChart}
                  xKey="tipo"
                  bars={[
                    { dataKey: "trim_actual", name: "Trimestre actual", color: "#0051FF" },
                    { dataKey: "trim_anio_pasado", name: "Mismo trimestre año pasado", color: "#8E8E93" },
                  ]}
                  lines={[
                    { dataKey: "crecimiento_pct", name: "Crecimiento %", color: "#34C759", yAxisId: "right" },
                  ]}
                  leftValueFormatter={formatCurrencyMXN}
                  rightValueFormatter={(v) => `${formatNumber(v)}%`}
                  height={340}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Variación %
                </div>
                <div className="overflow-hidden rounded-[var(--radius-md)] border">
                  <table className="w-full text-sm" aria-label="Crecimiento trimestral por tipo de cliente">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Tipo
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Actual
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Año ant.
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Crec. %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {quarterlyGrowthChart.map((row) => {
                        const growthValue = typeof row.crecimiento_pct === "number" ? row.crecimiento_pct : null
                        return (
                          <tr key={row.tipo} className="border-t">
                            <td className="px-3 py-2 text-[13px] text-foreground">{row.tipo}</td>
                            <td className="px-3 py-2 text-right text-[13px] font-semibold text-foreground">
                              {formatCurrencyMXN(row.trim_actual)}
                            </td>
                            <td className="px-3 py-2 text-right text-[13px] text-muted-foreground">
                              {formatCurrencyMXN(row.trim_anio_pasado)}
                            </td>
                            <td className="px-3 py-2 text-right text-[13px]">
                              {growthValue === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span
                                  className={
                                    growthValue > 0
                                      ? "font-semibold text-green-600"
                                      : growthValue < 0
                                        ? "font-semibold text-red-600"
                                        : "text-muted-foreground"
                                  }
                                >
                                  {growthValue > 0 ? "+" : ""}
                                  {formatNumber(growthValue)}%
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-[var(--radius-md)] border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                  Indicador: mide evolución menos sensible al ruido mensual.
                </div>
              </div>
            </div>
          )}
        </ChartPanel>

        <ChartPanel
          title={selectedProductSku ? `Producto: ${selectedProductSku}` : "Distribución de Ventas por Producto"}
          subtitle={selectedProductSku ? "Detalle del producto seleccionado" : "Top 10 productos más vendidos por monto — participación real sobre el total de ventas"}
          infoLabel="Mix de productos"
        >
          <ProductSearchInput
            suggestions={productDistribution.data ?? []}
            loading={productDistribution.status === "loading"}
            onSearch={handleProductSearch}
            onSelect={handleProductSelect}
            selectedProduct={selectedProductSku}
          />

          {productSearch && !selectedProductSku ? (
            <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-sm text-muted-foreground">
              Selecciona un producto de la lista para ver su información
            </div>
          ) : productDistributionRows.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-sm text-muted-foreground">
              Sin datos de productos en el periodo
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)] xl:items-start">
              <PieChart
                data={productPie}
                nameKey="name"
                valueKey="value"
                valueFormatter={formatCurrencyMXN}
                height={300}
                colors={["#0051FF", "#1AAD58", "#FFB020", "#AF52DE", "#FF6B6B", "#8E8E93"]}
                innerRadius={60}
                outerRadius={100}
              />
              <div className="overflow-hidden rounded-[var(--radius-md)] border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Producto
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        SKU
                      </th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Cant.
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
                      <tr key={row.sku + row.product} className="border-t">
                        <td className="px-3 py-2 text-[13px] text-foreground max-w-[160px] truncate" title={row.product}>{row.product}</td>
                        <td className="px-3 py-2 text-[13px] text-muted-foreground break-all max-w-[70px] leading-tight">{row.sku}</td>
                        <td className="px-3 py-2 text-right text-[13px] text-foreground">{row.qty}</td>
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
          )}
        </ChartPanel>
      </div>

      <div className="flex flex-col gap-4">
        <ChartPanel
          title="Ventas Reales vs Proyecciones"
          subtitle="Datos reales desde ventas.sold_on; proyección con promedio móvil 3 meses de cotizaciones aprobadas"
          infoLabel="Serie temporal"
        >
          <LineChart
            data={projectionChart}
            xKey="month"
            lines={[
              { dataKey: "subtotal", name: "Subtotal", color: "#0051FF" },
              { dataKey: "margen_bruto", name: "Margen Bruto", color: "#1AAD58" },
              { dataKey: "costo_compra", name: "Costo Compra", color: "#E5534B" },
              {
                dataKey: "proyeccion",
                name: "Proyección",
                color: "#8E8E93",
                dashed: true,
              },
              {
                dataKey: "variacion_porcentual",
                name: "Variación % mes a mes",
                color: "#9B59B6",
                dashed: true,
                yAxisId: "right",
              },
            ]}
            valueFormatter={formatCurrencyMXN}
            rightAxisFormatter={(value) => `${value > 0 ? "+" : ""}${formatNumber(value)}%`}
            height={400}
          />
        </ChartPanel>

        <ChartPanel
          title={selectedMarginProductSku ? `Margen: ${selectedMarginProductSku}` : "Margen de Ganancia por Producto"}
          subtitle={selectedMarginProductSku ? "Detalle del producto seleccionado" : "Top 10 productos con mayor margen bruto total — ordenados de mayor a menor margen"}
          infoLabel="Rentabilidad"
        >
          <ProductSearchInput
            suggestions={grossMarginByProduct.data ?? []}
            loading={grossMarginByProduct.status === "loading"}
            onSearch={handleMarginProductSearch}
            onSelect={handleMarginProductSelect}
            selectedProduct={selectedMarginProductSku}
          />

          {marginProductSearch && !selectedMarginProductSku ? (
            <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-sm text-muted-foreground">
              Selecciona un producto de la lista para ver su información
            </div>
          ) : marginByProductChart.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-sm text-muted-foreground">
              Sin datos de margen en el periodo
            </div>
          ) : (
            <div className="space-y-4">
              <BarChart
                data={marginByProductChart}
                xKey="product"
                bars={[{ dataKey: "gross_margin", name: "Margen bruto", color: "#1AAD58" }]}
                valueFormatter={formatCurrencyMXN}
                height={360}
              />
              <div className="overflow-hidden rounded-[var(--radius-md)] border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Producto
                      </th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        SKU
                      </th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Cant. Solicitada
                      </th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Costo de Venta
                      </th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Costo
                      </th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        % Margen
                      </th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Margen Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {marginByProductChart.map((row) => (
                      <tr key={row.sku + row.product} className="border-t">
                        <td className="px-3 py-2 text-[13px] text-foreground max-w-[160px] truncate" title={row.product}>{row.product}</td>
                        <td className="px-3 py-2 text-[13px] text-muted-foreground break-all max-w-[70px] leading-tight">{row.sku}</td>
                        <td className="px-3 py-2 text-right text-[13px] text-foreground">{formatNumber(row.qty)}</td>
                        <td className="px-3 py-2 text-right text-[13px] text-foreground">{formatCurrencyMXN(row.revenue)}</td>
                        <td className="px-3 py-2 text-right text-[13px] text-foreground">{formatCurrencyMXN(row.cost)}</td>
                        <td className="px-3 py-2 text-right text-[13px] text-muted-foreground">{formatNumber(row.margin_percent)}%</td>
                        <td className="px-3 py-2 text-right text-[13px] font-semibold text-[hsl(var(--success))]">{formatCurrencyMXN(row.gross_margin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
        title="Tiempos de Aprobación de Cotizaciones"
        subtitle="Días entre creación de cotización y registro de venta — promedio mensual, variación (±σ) y proyección"
        infoLabel="Eficiencia del proceso"
      >
        {approvalTimeTrend.status === "loading" ? (
          <div
            className="flex items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground"
            style={{ height: 340 }}
          >
            Cargando tiempos de aprobación...
          </div>
        ) : approvalTimeChart.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-sm text-muted-foreground">
            Sin datos de aprobación en el periodo seleccionado
          </div>
        ) : (
          <LineChart
            data={approvalTimeChart}
            xKey="month"
            lines={[
              { dataKey: "promedio", name: "Promedio (días)", color: "#0051FF" },
              { dataKey: "superior", name: "+1σ variación", color: "#0051FF", dashed: true },
              { dataKey: "inferior", name: "−1σ variación", color: "#0051FF", dashed: true },
              { dataKey: "proyeccion", name: "Proyección", color: "#AF52DE", dashed: true },
            ]}
            tooltipContent={(props) => {
              const { active, label, payload } = props as {
                active?: boolean
                label?: string
                payload?: Array<{ name?: string; value?: number; color?: string }>
              }
              if (!active || !payload?.length) return null
              return (
                <div className="min-w-[200px] rounded-[var(--radius-md)] border bg-card p-3 shadow-soft-sm">
                  <div className="mb-2 text-xs font-semibold text-foreground">{label ?? "—"}</div>
                  {payload.map((entry) =>
                    entry.value !== undefined && entry.value !== null ? (
                      <div key={entry.name} className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ background: entry.color }}
                          />
                          <span className="text-muted-foreground">{entry.name}</span>
                        </div>
                        <span className="font-medium tabular-nums text-foreground">
                          {formatNumber(entry.value)} días
                        </span>
                      </div>
                    ) : null
                  )}
                </div>
              )
            }}
            valueFormatter={(v) => `${formatNumber(v)} d`}
            height={340}
          />
        )}
      </ChartPanel>

      <ChartPanel
        title={selectedMissingDemandSku ? `Demanda: ${selectedMissingDemandSku}` : "Demanda de Productos Faltantes"}
        subtitle={selectedMissingDemandSku ? "Detalle del producto seleccionado" : "Cantidad pendiente por empacar desde cotizaciones aprobadas — top productos con mayor faltante"}
        infoLabel="Presión operativa"
      >
        <ProductSearchInput
          suggestions={(missingDemand.data ?? []).map((d) => ({
            product: d.product,
            sku: d.sku,
            qty: d.demanda_faltante,
            revenue: d.valor_venta_pendiente,
          }))}
          loading={missingDemand.status === "loading"}
          onSearch={handleMissingDemandSearch}
          onSelect={handleMissingDemandSelect}
          selectedProduct={selectedMissingDemandSku}
        />

        {missingDemandSearch && !selectedMissingDemandSku ? (
          <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-sm text-muted-foreground">
            Selecciona un producto de la lista para ver su información
          </div>
        ) : missingDemandParetoRows.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-sm text-muted-foreground">
            Sin productos faltantes por empacar en el periodo
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-start" style={{ minHeight: 600 }}>
            <div className="h-[600px]">
              <BarChart
                data={missingDemandChart}
                xKey="product"
                bars={[{ dataKey: "demanda_faltante", name: "Demanda faltante (u)" }]}
                height="100%"
                valueFormatter={(v) => `${formatNumber(v)} u`}
                horizontal
                colorScale={[
                  "#FF453A", "#FF6B6B", "#FF9F0A", "#FFB020",
                  "#FFD60A", "#1AAD58", "#30D158", "#34C759",
                  "#00C2FF", "#0A84FF", "#0051FF", "#AF52DE",
                  "#BF5AF2", "#E040FB", "#FF6E40",
                ]}
              />
            </div>
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
            </div>
          </div>
        )}
      </ChartPanel>

      <ChartPanel
        title={selectedForecastProductSku ? `Predicción: ${selectedForecastProductSku}` : "Predicción de Ventas por Producto"}
        subtitle={selectedForecastProductSku ? "Detalle del producto seleccionado" : "Promedio móvil de los últimos 3 meses — top 10 productos con mayor demanda proyectada"}
        infoLabel="Pronóstico"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--primary)/0.08)] px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--primary))]">
            <BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" />
            Promedio 3 meses
          </span>
        }
      >
        <ProductSearchInput
          suggestions={forecastProductSuggestions}
          loading={productForecast.status === "loading"}
          onSearch={handleForecastProductSearch}
          onSelect={handleForecastProductSelect}
          selectedProduct={selectedForecastProductSku}
        />

        {forecastProductSearch && !selectedForecastProductSku ? (
          <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-sm text-muted-foreground">
            Selecciona un producto de la lista para ver su información
          </div>
        ) : forecastChart.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border bg-card py-10 text-sm text-muted-foreground">
            Sin datos suficientes para proyectar
          </div>
        ) : (
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
                {selectedForecastProductSku ? "Producto seleccionado" : "Top productos"}
              </div>
              {forecastChart.map((row, index) => (
                <div
                  key={row.product}
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-foreground">
                      {selectedForecastProductSku ? row.product : `${index + 1}. ${row.product}`}
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
            </div>
          </div>
        )}
      </ChartPanel>

      <ChartPanel
        title="Clientes en Riesgo de Abandono"
        subtitle="Subtotal acumulado (cotizaciones aprobadas): últimos 90 días vs historial anterior"
        infoLabel="Retención de clientes"
      >
        <AtRiskCustomerSearch
          customers={atRiskCustomers.data ?? []}
          selected={selectedAtRiskCustomer}
          onSelect={setSelectedAtRiskCustomer}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
          <BarChart
            data={atRiskChart}
            xKey="customer"
            bars={[
              { dataKey: "ultimos_90", name: "Últimos 90 días", color: "#0051FF" },
              { dataKey: "previos_90", name: "Antes de 90 días", color: "#8E8E93" },
            ]}
            height={Math.max(280, atRiskChart.length * 40)}
            valueFormatter={formatCurrencyMXN}
            horizontal
          />
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {selectedAtRiskCustomer ? "Detalle del cliente" : "Semáforo de riesgo"}
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
                      Antes 90d
                    </th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Riesgo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {atRiskVisible.map((row) => {
                    const riskColor =
                      row.riesgo_abandono === "Crítico"
                        ? "bg-red-100 text-red-700"
                        : row.riesgo_abandono === "Alto"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-yellow-100 text-yellow-700"
                    return (
                      <tr key={row.customer_id ?? row.customer_name} className="border-t">
                        <td className="px-3 py-2 text-[13px] text-foreground">
                          <div className="truncate max-w-[140px]" title={row.customer_name}>
                            {row.customer_name}
                          </div>
                          {row.external_id && (
                            <div className="text-[11px] text-muted-foreground">
                              ID: {row.external_id}
                            </div>
                          )}
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
            <div className="space-y-2 w-full">
              <div className="flex items-center justify-between">
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
              </div>
              <QuoteSearchInput
                suggestions={recentQuotes.data ?? []}
                loading={recentQuotes.status === "loading"}
                onSearch={handleQuoteSearch}
                onSelect={handleQuoteSelect}
                selectedQuoteId={selectedQuoteId}
              />
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
        subtitle={
          selectedPaymentCustomer
            ? `Cliente: ${selectedPaymentCustomer.name}`
            : "Top 10 por días sin pago — ordenados por monto pendiente"
        }
        infoLabel="2.3.1 Comportamiento de pago"
      >
        {/* Barra de búsqueda */}
        <PaymentCustomerSearch
          query={paymentCustomerQuery}
          onQueryChange={(q) => {
            setPaymentCustomerQuery(q)
            if (!q) setSelectedPaymentCustomer(null)
          }}
          suggestions={paymentCustomerSearchResult.data ?? []}
          loading={paymentCustomerSearchResult.status === "loading"}
          selectedCustomer={selectedPaymentCustomer}
          onSelect={(item) => {
            setSelectedPaymentCustomer(item)
            setPaymentCustomerQuery(item.name)
          }}
          onClear={() => {
            setSelectedPaymentCustomer(null)
            setPaymentCustomerQuery("")
          }}
        />

        <div className="flex flex-col gap-6">
          {/* Gráfica: solo visible cuando hay cliente seleccionado */}
          {selectedPaymentCustomer && (
            <div className="max-w-lg">
              <BarChart
                data={(customerPaymentStats.data ?? []).map((row: CustomerPaymentStat) => ({
                  customer: row.customer_name,
                  dias: row.promedio_dias_pago,
                  riesgo:
                    row.promedio_dias_pago <= 30
                      ? "Bajo"
                      : row.promedio_dias_pago <= 60
                        ? "Medio"
                        : "Alto",
                }))}
                xKey="customer"
                bars={[{ dataKey: "dias", name: "Días promedio de pago" }]}
                height={180}
                valueFormatter={(v) => `${formatNumber(v)} días`}
                horizontal
                colorScale={(customerPaymentStats.data ?? []).map((row: CustomerPaymentStat) =>
                  row.promedio_dias_pago <= 30
                    ? "#1AAD58"
                    : row.promedio_dias_pago <= 60
                      ? "#FFB020"
                      : "#FF453A"
                )}
              />
            </div>
          )}

          {/* Tabla con nuevas columnas */}
          <div className="overflow-hidden rounded-[var(--radius-md)] border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Cliente
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Cotizaciones
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Prom. días pago
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Monto pendiente
                  </th>
                  <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Sin pagar
                  </th>
                  <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Máx. días sin pago
                  </th>
                </tr>
              </thead>
              <tbody>
                {(customerPaymentStats.data ?? []).map((row: CustomerPaymentStat) => {
                  const maxDias = row.max_dias_sin_pago ?? 0
                  const urgencia =
                    maxDias > 90 ? "error" : maxDias > 45 ? "warning" : "neutral"
                  return (
                    <tr key={row.customer_name} className="border-t">
                      <td className="px-3 py-2 text-[13px] text-foreground">
                        <div className="truncate max-w-[220px]" title={row.customer_name}>
                          {row.customer_name}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-[13px] text-foreground">
                        {row.cotizaciones_base}
                      </td>
                      <td className="px-3 py-2 text-right text-[13px] font-semibold text-foreground">
                        {formatNumber(row.promedio_dias_pago)} d
                      </td>
                      <td className="px-3 py-2 text-right text-[13px] font-semibold text-foreground">
                        {formatCurrencyMXN(row.monto_pendiente_mxn)}
                      </td>
                      <td className="px-3 py-2 text-center text-[13px] text-foreground">
                        {row.cot_sin_pagar}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.max_dias_sin_pago !== null ? (
                          <StatusBadge variant={urgencia}>
                            {row.max_dias_sin_pago} d
                          </StatusBadge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {(customerPaymentStats.data ?? []).length === 0 &&
            customerPaymentStats.status !== "loading" && (
              <div className="rounded-[var(--radius-md)] border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                Sin datos de pagos para mostrar
              </div>
            )}
        </div>
      </ChartPanel>

      <ChartPanel
        title="Clientes con Pagos Pendientes"
        subtitle={
          selectedPendingCustomer
            ? `Cliente: ${selectedPendingCustomer.name}`
            : "Top 10 por monto pendiente — cotizaciones aprobadas sin pagar"
        }
        infoLabel="Cobranza"
      >
        <PaymentCustomerSearch
          query={pendingCustomerQuery}
          onQueryChange={(q) => {
            setPendingCustomerQuery(q)
            if (!q) setSelectedPendingCustomer(null)
          }}
          suggestions={pendingCustomerSearchResult.data ?? []}
          loading={pendingCustomerSearchResult.status === "loading"}
          selectedCustomer={selectedPendingCustomer}
          onSelect={(item) => {
            setSelectedPendingCustomer(item)
            setPendingCustomerQuery(item.name)
          }}
          onClear={() => {
            setSelectedPendingCustomer(null)
            setPendingCustomerQuery("")
          }}
        />

        <div className="overflow-hidden rounded-[var(--radius-md)] border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Cliente
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Cot. pendientes
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Monto pendiente
                </th>
                <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Fecha más antigua
                </th>
                <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Días sin pagar
                </th>
              </tr>
            </thead>
            <tbody>
              {(pendingPaymentStats.data ?? []).map((row: PendingPaymentStat) => {
                const dias = row.dias_sin_pagar ?? 0
                const urgencia = dias > 90 ? "error" : dias > 45 ? "warning" : "neutral"
                return (
                  <tr key={row.customer_name} className="border-t">
                    <td className="px-3 py-2 text-[13px] text-foreground">
                      <div className="truncate max-w-[220px]" title={row.customer_name}>
                        {row.customer_name}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-[13px] text-foreground">
                      {row.cot_pendientes}
                    </td>
                    <td className="px-3 py-2 text-right text-[13px] font-semibold text-foreground">
                      {formatCurrencyMXN(row.monto_pendiente)}
                    </td>
                    <td className="px-3 py-2 text-center text-[13px] text-muted-foreground">
                      {row.fecha_mas_antigua ? formatIsoDate(row.fecha_mas_antigua) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.dias_sin_pagar !== null ? (
                        <StatusBadge variant={urgencia}>
                          {row.dias_sin_pagar} d
                        </StatusBadge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {(pendingPaymentStats.data ?? []).length === 0 &&
          pendingPaymentStats.status !== "loading" && (
            <div className="rounded-[var(--radius-md)] border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
              Sin pagos pendientes
            </div>
          )}
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

      <ReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        startDate={startDate}
        endDate={endDate}
      />

      <EmailReportModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  )
}
