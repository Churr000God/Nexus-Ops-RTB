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
  category: string | null
  sale_count: number
  total_revenue: number
  average_ticket: number
}

export type SalesByCustomerType = {
  tipo_cliente: string
  total_ventas: number
  porcentaje_ventas: number
}

export type MonthlyGrowthYoYByCustomerType = {
  tipo_cliente: string
  ventas_mes_actual: number
  ventas_mismo_mes_anio_pasado: number
  tasa_crecimiento_pct: number | null
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
  diff_vs_po_monto: number
  diff_vs_po_pct: number | null
}

export type SalesProjectionByMonth = {
  year_month: string
  num_ventas: number
  subtotal: number
  total_con_iva: number
  margen_bruto: number
  costo_compra: number
  projected_sales: number
}

export type SalesByProductDistribution = {
  product: string
  sku: string | null
  qty: number
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
  po_pr: string | null
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

export type AtRiskCustomer = {
  customer_id: string | null
  external_id: string | null
  customer_name: string
  compras_ult_90: number
  compras_90_previos: number
  ultima_compra: string | null
  riesgo_abandono: string
}

export type PaymentTrend = {
  customer_name: string
  promedio_dias_pago: number
  ultimo_pago: string | null
  riesgo_pago: "Bajo" | "Medio" | "Alto"
}

export type AvgSalesByCustomerType = {
  tipo_cliente: string
  numero_clientes: number
  venta_promedio_por_cliente: number
}

export type ProductsByCustomerType = {
  tipo_cliente: string
  cantidad_solicitada: number
  cantidad_empacada: number
}

export type QuarterlyGrowthByCustomerType = {
  tipo_cliente: string
  ventas_trim_actual: number
  ventas_trim_anio_pasado: number
  crecimiento_trimestral_pct: number | null
}

export type PendingPaymentCustomer = {
  customer_name: string
  tipo_cliente: string | null
  num_pedidos: number
  total_adeudado: number
  desde_fecha: string | null
  dias_sin_pagar: number | null
}

export type CustomerPaymentStat = {
  customer_id: string | null
  customer_name: string
  cotizaciones_base: number
  promedio_dias_pago: number
  monto_pendiente_mxn: number
  cot_sin_pagar: number
  max_dias_sin_pago: number | null
}

export type CustomerSearchItem = {
  id: string
  name: string
  external_id: string | null
}

export type PendingPaymentStat = {
  customer_id: string | null
  customer_name: string
  cot_pendientes: number
  monto_pendiente: number
  fecha_mas_antigua: string | null
  dias_sin_pagar: number | null
}

export type ApprovalTimeTrend = {
  year_month: string
  avg_days: number | null
  upper_days: number | null
  lower_days: number | null
  count: number
  projected_days: number | null
}
