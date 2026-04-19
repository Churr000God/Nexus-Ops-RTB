export type Sale = {
  id: string
  name: string
  sold_on: string | null
  customer_name: string | null
  status: string | null
  subtotal: number | null
  total: number | null
  purchase_cost: number | null
  gross_margin: number | null
  margin_percent: number | null
  year_month: string | null
}

export type SalesByMonth = {
  year_month: string
  sale_count: number
  total_revenue: number
  total_gross_margin: number
}

export type SalesByCustomer = {
  customer: string
  sale_count: number
  total_revenue: number
  average_ticket: number
}

export type GrossMarginByProduct = {
  product: string
  sku: string | null
  qty: number
  revenue: number
  cost: number
  gross_margin: number
  margin_percent: number | null
}

export type ApprovedVsCancelledByMonth = {
  year_month: string
  approved_count: number
  cancelled_count: number
}

export type DashboardOverview = {
  start_date: string | null
  end_date: string | null
  sale_count: number
  total_revenue: number
  total_gross_margin: number
  approved_quotes: number
  cancelled_quotes: number
}
