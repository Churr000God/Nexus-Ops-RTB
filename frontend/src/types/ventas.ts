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

export type SalesSummary = {
  start_date: string | null
  end_date: string | null
  total_sales: number
  pending_quotes: number
  average_margin_percent: number
  conversion_rate: number
  total_quotes: number
  approved_quotes: number
  cancelled_quotes: number
  expired_quotes: number
  review_quotes: number
}

export type SalesProjectionByMonth = {
  year_month: string
  actual_sales: number
  projected_sales: number
}

export type SalesByProductDistribution = {
  product: string
  revenue: number
  percentage: number
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

export type QuoteStatusByMonth = {
  year_month: string
  approved_count: number
  cancelled_count: number
  expired_count: number
  review_count: number
  quoting_count: number
  rejected_count: number
  approved_amount: number
  cancelled_amount: number
  expired_amount: number
  review_amount: number
  quoting_amount: number
  rejected_amount: number
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

export type RecentQuote = {
  id: string
  name: string
  created_on: string | null
  customer_name: string | null
  status: string | null
  total: number | null
  subtotal: number | null
  can_convert: boolean
}

export type MissingDemandByProduct = {
  product: string
  sku: string | null
  category: string | null
  demanda_faltante: number
  valor_venta_pendiente: number
  costo_compra_estimado: number
  pareto_percent: number | null
}

export type SalesForecastByProduct = {
  product: string
  sku: string | null
  category: string | null
  predicted_units: number
}
