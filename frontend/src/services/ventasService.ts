import { requestJson } from "@/lib/http"
import type {
  ApprovedVsCancelledByMonth,
  DashboardOverview,
  GrossMarginByProduct,
  Sale,
  SalesByCustomer,
  SalesByMonth,
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
}
