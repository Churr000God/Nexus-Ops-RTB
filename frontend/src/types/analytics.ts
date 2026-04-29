// Tipos TypeScript — Módulo de Reportes y Analytics (Módulo 15)

// ── CFDI ─────────────────────────────────────────────────────────────────────

export interface CfdiEmittedRow {
  cfdi_id: number
  uuid: string | null
  cfdi_type: string
  series: string | null
  folio: number | null
  customer: string | null
  receiver_rfc: string | null
  receiver_legal_name: string | null
  cfdi_use_id: string | null
  payment_method_id: string | null
  payment_form_id: string | null
  issue_date: string | null
  timbre_date: string | null
  subtotal: number | null
  discount: number | null
  tax_amount: number | null
  total: number | null
  status: string
  cancelled_at: string | null
  cancellation_reason: string | null
  sat_cancellation_motive: string | null
  replaced_by_uuid: string | null
  replaces_uuid: string | null
  amount_paid_via_complementos: number
  credit_note_amount: number
}

export interface CfdiSummaryByPeriodRow {
  year: number
  month: number
  cfdi_type: string
  status: string
  num_cfdis: number
  subtotal: number | null
  tax: number | null
  total: number | null
}

export interface PaymentUnappliedRow {
  payment_id: number
  payment_number: string | null
  payment_date: string | null
  customer: string | null
  amount: number
  amount_applied: number
  amount_unapplied: number
  bank_reference: string | null
  notes: string | null
}

// ── Compras ───────────────────────────────────────────────────────────────────

export type AgingBucket = "PAID" | "CURRENT" | "OVERDUE_0_30" | "OVERDUE_30_60" | "OVERDUE_60_PLUS"

export interface SupplierInvoicesAgingRow {
  invoice_id: number
  invoice_number: string
  supplier_code: string
  supplier: string
  invoice_type: string | null
  invoice_date: string | null
  payment_due_date: string | null
  total: number | null
  payment_status: string | null
  is_credit: boolean | null
  sat_payment_method_id: string | null
  aging_bucket: AgingBucket
  days_overdue: number | null
}

export interface TopSupplierRow {
  supplier_id: number
  code: string
  business_name: string
  supplier_type: string | null
  num_pos: number
  total_purchased: number | null
  avg_po_value: number | null
  avg_payment_time_days: number | null
  last_po_date: string | null
  days_since_last_po: number | null
}

export interface SupplierPerformanceRow {
  supplier_id: number
  code: string
  business_name: string
  pos_completed: number
  avg_actual_lead_days: number | null
  avg_estimated_lead_days: number | null
  avg_delay_days: number | null
  on_time: number
  on_time_pct: number
  total_ncs: number
}

// ── Comercial ─────────────────────────────────────────────────────────────────

export interface SalesByPeriodRow {
  year: number
  quarter: number
  month: number
  num_orders: number
  subtotal: number | null
  tax: number | null
  total: number | null
  cost: number | null
  gross_margin: number | null
  margin_pct: number | null
}

export interface TopCustomerRow {
  customer_id: number
  code: string
  business_name: string
  locality: string | null
  num_orders: number
  total_revenue: number | null
  total_cost: number | null
  gross_margin: number | null
  margin_pct: number | null
  avg_order_value: number | null
  last_order_date: string | null
  days_since_last_order: number | null
}

export interface QuoteConversionRow {
  year: number
  month: number
  total_quotes: number
  approved: number
  rejected: number
  cancelled: number
  expired: number
  still_open: number
  conversion_pct: number
  total_quoted: number | null
  total_won: number | null
}

export interface SalesRepRow {
  user_id: string
  sales_rep: string
  quotes_created: number
  quotes_approved: number
  conversion_pct: number
  revenue_generated: number | null
  margin_generated: number | null
  avg_order_value: number | null
}

// ── Margen ────────────────────────────────────────────────────────────────────

export interface ProductMarginRow {
  product_id: string
  sku: string
  name: string
  category: string | null
  category_target_margin: number | null
  times_sold: number
  units_sold: number | null
  revenue: number | null
  cost: number | null
  gross_margin: number | null
  actual_margin_pct: number | null
  current_avg_cost: number | null
}

export interface CustomerProfitabilityRow {
  customer_id: number
  code: string
  business_name: string
  num_orders: number
  revenue: number | null
  cost: number | null
  gross_margin: number | null
  margin_pct: number | null
  amount_collected: number
  amount_outstanding: number | null
  avg_days_to_pay: number | null
}

export interface CategoryMarginRow {
  category_id: string
  category: string
  target_margin: number | null
  items_sold: number | null
  revenue: number | null
  cost: number | null
  margin: number | null
  actual_margin_pct: number | null
}

// ── Financiero ────────────────────────────────────────────────────────────────

export interface AccountsReceivableRow {
  customer_id: number
  code: string
  business_name: string
  billed: number | null
  collected: number
  outstanding: number | null
  bucket_0_30: number
  bucket_31_60: number
  bucket_61_90: number
  bucket_90_plus: number
}

export interface AccountsPayableRow {
  supplier_id: number
  code: string
  business_name: string
  outstanding: number | null
  bucket_current: number | null
  bucket_overdue_30: number | null
  bucket_overdue_60: number | null
  bucket_overdue_60_plus: number | null
}

export interface CashFlowRow {
  period: string
  period_date: string
  inflow: number
  outflow: number
  net: number
}

export interface ExpensesByCategoryRow {
  year: number
  month: number
  category: string | null
  num_expenses: number
  subtotal: number | null
  tax: number | null
  total: number | null
  deductible: number | null
  non_deductible: number | null
}

// ── Operación ─────────────────────────────────────────────────────────────────

export interface WarehouseKpis {
  active_skus_saleable: number
  skus_out_of_stock: number
  skus_below_min: number
  total_inventory_value: number | null
  receipts_this_month: number
  issues_this_month: number
  active_orders: number
  orders_with_shortage: number
  orders_in_packing: number
  open_non_conformities: number
}

export interface NcBySupplierRow {
  supplier_code: string | null
  business_name: string | null
  total_ncs: number
  ncs_last_90d: number
  open_ncs: number
  total_quantity_affected: number | null
}

export interface RouteEfficiencyRow {
  route_id: number
  route_number: string | null
  route_date: string | null
  driver: string | null
  total_stops: number
  completed_stops: number
  failed_stops: number
  deliveries: number
  pickups: number
  duration_hours: number | null
  total_distance_km: number | null
  completion_pct: number
}

// ── Ejecutivo ─────────────────────────────────────────────────────────────────

export interface ExecutiveDashboard {
  revenue_mtd: number
  margin_mtd: number | null
  open_quotes: number
  open_quotes_value: number
  total_ar: number | null
  ar_overdue_60_plus: number | null
  total_ap: number | null
  inventory_value: number | null
  skus_in_alert: number
  active_orders: number
  orders_with_shortage: number
  open_ncs: number
  cfdis_emitted_mtd: number
  cfdis_cancelled_mtd: number
}
