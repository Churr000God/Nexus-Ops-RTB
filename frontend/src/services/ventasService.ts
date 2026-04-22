import { requestJson } from "@/lib/http"
import type {
  ApprovedVsCancelledByMonth,
  AtRiskCustomer,
  AvgSalesByCustomerType,
  DashboardOverview,
  GrossMarginByProduct,
  MonthlyGrowthYoYByCustomerType,
  MissingDemandByProduct,
  PaymentTrend,
  PendingPaymentCustomer,
  ProductsByCustomerType,
  QuarterlyGrowthByCustomerType,
  QuoteStatusByMonth,
  RecentQuote,
  Sale,
  SalesByProductDistribution,
  SalesByCustomerType,
  SalesByCustomer,
  SalesByMonth,
  SalesForecastByProduct,
  SalesProjectionByMonth,
  SalesSummary,
} from "@/types/ventas"

function withQuery(path: string, params?: Record<string, string | number | null | undefined>) {
  if (!params) return path
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue
    usp.set(key, String(value))
  }
  const qs = usp.toString()
  return qs ? `${path}?${qs}` : path
}

export const ventasService = {
  dashboardOverview(
    token: string,
    params?: { startDate?: string | null; endDate?: string | null },
    signal?: AbortSignal
  ) {
    return requestJson<DashboardOverview>(
      withQuery("/api/dashboard", {
        start_date: params?.startDate,
        end_date: params?.endDate,
      }),
      { token, signal }
    )
  },

  listSales(
    token: string,
    params?: {
      startDate?: string | null
      endDate?: string | null
      limit?: number
      offset?: number
    },
    signal?: AbortSignal
  ) {
    return requestJson<Sale[]>(
      withQuery("/api/ventas", {
        start_date: params?.startDate,
        end_date: params?.endDate,
        limit: params?.limit,
        offset: params?.offset,
      }),
      { token, signal }
    )
  },

  salesSummary(
    token: string,
    params?: { startDate?: string | null; endDate?: string | null },
    signal?: AbortSignal
  ) {
    return requestJson<SalesSummary>(
      withQuery("/api/ventas/summary", {
        start_date: params?.startDate,
        end_date: params?.endDate,
      }),
      { token, signal }
    )
  },

  salesByMonth(
    token: string,
    params?: { startDate?: string | null; endDate?: string | null },
    signal?: AbortSignal
  ) {
    return requestJson<SalesByMonth[]>(
      withQuery("/api/ventas/by-month", {
        start_date: params?.startDate,
        end_date: params?.endDate,
      }),
      { token, signal }
    )
  },

  salesVsProjection(
    token: string,
    params?: { startDate?: string | null; endDate?: string | null },
    signal?: AbortSignal
  ) {
    return requestJson<SalesProjectionByMonth[]>(
      withQuery("/api/ventas/sales-vs-projection", {
        start_date: params?.startDate,
        end_date: params?.endDate,
      }),
      { token, signal }
    )
  },

  salesByCustomer(
    token: string,
    params?: { startDate?: string | null; endDate?: string | null; limit?: number },
    signal?: AbortSignal
  ) {
    return requestJson<SalesByCustomer[]>(
      withQuery("/api/ventas/by-customer", {
        start_date: params?.startDate,
        end_date: params?.endDate,
        limit: params?.limit,
      }),
      { token, signal }
    )
  },

  salesByCustomerType(
    token: string,
    params?: { startDate?: string | null; endDate?: string | null },
    signal?: AbortSignal
  ) {
    return requestJson<SalesByCustomerType[]>(
      withQuery("/api/ventas/sales-by-customer-type", {
        start_date: params?.startDate,
        end_date: params?.endDate,
      }),
      { token, signal }
    )
  },

  topCustomers(
    token: string,
    params?: { startDate?: string | null; endDate?: string | null; limit?: number; customerSearch?: string },
    signal?: AbortSignal
  ) {
    return requestJson<SalesByCustomer[]>(
      withQuery("/api/ventas/top-customers", {
        start_date: params?.startDate,
        end_date: params?.endDate,
        limit: params?.limit,
        customer_search: params?.customerSearch || undefined,
      }),
      { token, signal }
    )
  },

  grossMarginByProduct(
    token: string,
    params?: { startDate?: string | null; endDate?: string | null; limit?: number; productSearch?: string },
    signal?: AbortSignal
  ) {
    return requestJson<GrossMarginByProduct[]>(
      withQuery("/api/ventas/gross-margin-by-product", {
        start_date: params?.startDate,
        end_date: params?.endDate,
        limit: params?.limit,
        product_search: params?.productSearch || undefined,
      }),
      { token, signal }
    )
  },

  productDistribution(
    token: string,
    params?: { startDate?: string | null; endDate?: string | null; limit?: number; productSearch?: string },
    signal?: AbortSignal
  ) {
    return requestJson<SalesByProductDistribution[]>(
      withQuery("/api/ventas/product-distribution", {
        start_date: params?.startDate,
        end_date: params?.endDate,
        limit: params?.limit,
        product_search: params?.productSearch || undefined,
      }),
      { token, signal }
    )
  },

  approvedVsCancelled(
    token: string,
    params?: { startDate?: string | null; endDate?: string | null },
    signal?: AbortSignal
  ) {
    return requestJson<ApprovedVsCancelledByMonth[]>(
      withQuery("/api/ventas/approved-vs-cancelled", {
        start_date: params?.startDate,
        end_date: params?.endDate,
      }),
      { token, signal }
    )
  },

  quoteStatusByMonth(
    token: string,
    params?: { startDate?: string | null; endDate?: string | null },
    signal?: AbortSignal
  ) {
    return requestJson<QuoteStatusByMonth[]>(
      withQuery("/api/ventas/quote-status-by-month", {
        start_date: params?.startDate,
        end_date: params?.endDate,
      }),
      { token, signal }
    )
  },

  recentQuotes(
    token: string,
    params?: {
      startDate?: string | null
      endDate?: string | null
      status?: string | null
      limit?: number
    },
    signal?: AbortSignal
  ) {
    return requestJson<RecentQuote[]>(
      withQuery("/api/ventas/recent-quotes", {
        start_date: params?.startDate,
        end_date: params?.endDate,
        status: params?.status,
        limit: params?.limit,
      }),
      { token, signal }
    )
  },

  missingDemand(
    token: string,
    params?: {
      startDate?: string | null
      endDate?: string | null
      limit?: number
    },
    signal?: AbortSignal
  ) {
    return requestJson<MissingDemandByProduct[]>(
      withQuery("/api/ventas/missing-demand", {
        start_date: params?.startDate,
        end_date: params?.endDate,
        limit: params?.limit,
      }),
      { token, signal }
    )
  },

  productForecast(
    token: string,
    params?: {
      startDate?: string | null
      endDate?: string | null
      limit?: number
      monthsWindow?: number
    },
    signal?: AbortSignal
  ) {
    return requestJson<SalesForecastByProduct[]>(
      withQuery("/api/ventas/product-forecast", {
        start_date: params?.startDate,
        end_date: params?.endDate,
        limit: params?.limit,
        months_window: params?.monthsWindow,
      }),
      { token, signal }
    )
  },

  atRiskCustomers(token: string, signal?: AbortSignal) {
    return requestJson<AtRiskCustomer[]>(
      withQuery("/api/ventas/at-risk-customers", {}),
      { token, signal }
    )
  },

  paymentTrend(
    token: string,
    params?: {
      startDate?: string | null
      endDate?: string | null
      limit?: number
    },
    signal?: AbortSignal
  ) {
    return requestJson<PaymentTrend[]>(
      withQuery("/api/ventas/payment-trend", {
        start_date: params?.startDate,
        end_date: params?.endDate,
        limit: params?.limit,
      }),
      { token, signal }
    )
  },

  productsByCustomerType(
    token: string,
    params?: { startDate?: string; endDate?: string },
    signal?: AbortSignal
  ) {
    return requestJson<ProductsByCustomerType[]>(
      withQuery("/api/ventas/products-by-customer-type", {
        start_date: params?.startDate,
        end_date: params?.endDate,
      }),
      { token, signal }
    )
  },

  avgSalesByCustomerType(
    token: string,
    params?: { startDate?: string | null; endDate?: string | null },
    signal?: AbortSignal
  ) {
    return requestJson<AvgSalesByCustomerType[]>(
      withQuery("/api/ventas/avg-sales-by-customer-type", {
        start_date: params?.startDate,
        end_date: params?.endDate,
      }),
      { token, signal }
    )
  },

  monthlyGrowthYoYByCustomerType(
    token: string,
    params?: { selectedMonth?: number | null },
    signal?: AbortSignal
  ) {
    return requestJson<MonthlyGrowthYoYByCustomerType[]>(
      withQuery("/api/ventas/monthly-growth-yoy-by-customer-type", {
        selected_month: params?.selectedMonth ?? undefined,
      }),
      { token, signal }
    )
  },

  quarterlyGrowthByCustomerType(
    token: string,
    params?: { selectedQuarter?: number | null },
    signal?: AbortSignal
  ) {
    return requestJson<QuarterlyGrowthByCustomerType[]>(
      withQuery("/api/ventas/quarterly-growth-by-customer-type", {
        selected_quarter: params?.selectedQuarter ?? undefined,
      }),
      { token, signal }
    )
  },

  pendingPayments(token: string, signal?: AbortSignal) {
    return requestJson<PendingPaymentCustomer[]>(
      withQuery("/api/ventas/pending-payments", {}),
      { token, signal }
    )
  },
}
