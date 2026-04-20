import { requestJson } from "@/lib/http"
import type {
  ApprovedVsCancelledByMonth,
  DashboardOverview,
  GrossMarginByProduct,
  MissingDemandByProduct,
  QuoteStatusByMonth,
  RecentQuote,
  Sale,
  SalesByProductDistribution,
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

  topCustomers(
    token: string,
    params?: { startDate?: string | null; endDate?: string | null; limit?: number },
    signal?: AbortSignal
  ) {
    return requestJson<SalesByCustomer[]>(
      withQuery("/api/ventas/top-customers", {
        start_date: params?.startDate,
        end_date: params?.endDate,
        limit: params?.limit,
      }),
      { token, signal }
    )
  },

  grossMarginByProduct(
    token: string,
    params?: { startDate?: string | null; endDate?: string | null; limit?: number },
    signal?: AbortSignal
  ) {
    return requestJson<GrossMarginByProduct[]>(
      withQuery("/api/ventas/gross-margin-by-product", {
        start_date: params?.startDate,
        end_date: params?.endDate,
        limit: params?.limit,
      }),
      { token, signal }
    )
  },

  productDistribution(
    token: string,
    params?: { startDate?: string | null; endDate?: string | null; limit?: number },
    signal?: AbortSignal
  ) {
    return requestJson<SalesByProductDistribution[]>(
      withQuery("/api/ventas/product-distribution", {
        start_date: params?.startDate,
        end_date: params?.endDate,
        limit: params?.limit,
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
}
