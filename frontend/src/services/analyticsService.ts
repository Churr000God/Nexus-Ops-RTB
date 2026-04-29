import { requestJson } from "@/lib/http"
import type {
  AccountsPayableRow,
  AccountsReceivableRow,
  CashFlowRow,
  CategoryMarginRow,
  CfdiEmittedRow,
  CfdiSummaryByPeriodRow,
  CustomerProfitabilityRow,
  ExecutiveDashboard,
  ExpensesByCategoryRow,
  NcBySupplierRow,
  PaymentUnappliedRow,
  ProductMarginRow,
  QuoteConversionRow,
  RouteEfficiencyRow,
  SalesByPeriodRow,
  SalesRepRow,
  SupplierInvoicesAgingRow,
  SupplierPerformanceRow,
  TopCustomerRow,
  TopSupplierRow,
  WarehouseKpis,
} from "@/types/analytics"

const BASE = "/api/analytics"

// ── Ejecutivo ─────────────────────────────────────────────────────────────────

export function getExecutiveDashboard(signal?: AbortSignal): Promise<ExecutiveDashboard> {
  return requestJson(`${BASE}/ejecutivo`, { signal })
}

// ── Comercial ─────────────────────────────────────────────────────────────────

export function getSalesByPeriod(
  params: { year?: number } = {},
  signal?: AbortSignal,
): Promise<SalesByPeriodRow[]> {
  const q = new URLSearchParams()
  if (params.year) q.set("year", String(params.year))
  return requestJson(`${BASE}/ventas/por-periodo?${q}`, { signal })
}

export function getTopCustomers(
  params: { limit?: number } = {},
  signal?: AbortSignal,
): Promise<TopCustomerRow[]> {
  const q = new URLSearchParams()
  if (params.limit) q.set("limit", String(params.limit))
  return requestJson(`${BASE}/ventas/top-clientes?${q}`, { signal })
}

export function getQuoteConversion(
  params: { year?: number } = {},
  signal?: AbortSignal,
): Promise<QuoteConversionRow[]> {
  const q = new URLSearchParams()
  if (params.year) q.set("year", String(params.year))
  return requestJson(`${BASE}/ventas/conversion?${q}`, { signal })
}

export function getSalesRepPerformance(signal?: AbortSignal): Promise<SalesRepRow[]> {
  return requestJson(`${BASE}/ventas/por-vendedor`, { signal })
}

// ── Margen ────────────────────────────────────────────────────────────────────

export function getProductMargin(signal?: AbortSignal): Promise<ProductMarginRow[]> {
  return requestJson(`${BASE}/margen/productos`, { signal })
}

export function getCustomerProfitability(
  params: { limit?: number } = {},
  signal?: AbortSignal,
): Promise<CustomerProfitabilityRow[]> {
  const q = new URLSearchParams()
  if (params.limit) q.set("limit", String(params.limit))
  return requestJson(`${BASE}/margen/clientes?${q}`, { signal })
}

export function getCategoryMargin(signal?: AbortSignal): Promise<CategoryMarginRow[]> {
  return requestJson(`${BASE}/margen/categorias`, { signal })
}

// ── Compras ───────────────────────────────────────────────────────────────────

export function getTopSuppliers(
  params: { limit?: number } = {},
  signal?: AbortSignal,
): Promise<TopSupplierRow[]> {
  const q = new URLSearchParams()
  if (params.limit) q.set("limit", String(params.limit))
  return requestJson(`${BASE}/compras/top-proveedores?${q}`, { signal })
}

export function getSupplierPerformance(signal?: AbortSignal): Promise<SupplierPerformanceRow[]> {
  return requestJson(`${BASE}/compras/desempeno-proveedores`, { signal })
}

export function getSupplierInvoicesAging(signal?: AbortSignal): Promise<SupplierInvoicesAgingRow[]> {
  return requestJson(`${BASE}/compras/aging-facturas`, { signal })
}

// ── Financiero ────────────────────────────────────────────────────────────────

export function getAccountsReceivable(signal?: AbortSignal): Promise<AccountsReceivableRow[]> {
  return requestJson(`${BASE}/financiero/cuentas-por-cobrar`, { signal })
}

export function getAccountsPayable(signal?: AbortSignal): Promise<AccountsPayableRow[]> {
  return requestJson(`${BASE}/financiero/cuentas-por-pagar`, { signal })
}

export function getCashFlowProjection(signal?: AbortSignal): Promise<CashFlowRow[]> {
  return requestJson(`${BASE}/financiero/flujo-caja`, { signal })
}

export function getExpensesByCategory(
  params: { year?: number } = {},
  signal?: AbortSignal,
): Promise<ExpensesByCategoryRow[]> {
  const q = new URLSearchParams()
  if (params.year) q.set("year", String(params.year))
  return requestJson(`${BASE}/financiero/gastos?${q}`, { signal })
}

export function getCfdiEmitted(
  params: { year?: number; month?: number } = {},
  signal?: AbortSignal,
): Promise<CfdiEmittedRow[]> {
  const q = new URLSearchParams()
  if (params.year) q.set("year", String(params.year))
  if (params.month) q.set("month", String(params.month))
  return requestJson(`${BASE}/financiero/cfdi-emitidos?${q}`, { signal })
}

export function getCfdiSummaryByPeriod(
  params: { year?: number } = {},
  signal?: AbortSignal,
): Promise<CfdiSummaryByPeriodRow[]> {
  const q = new URLSearchParams()
  if (params.year) q.set("year", String(params.year))
  return requestJson(`${BASE}/financiero/cfdi-por-periodo?${q}`, { signal })
}

export function getPaymentsUnapplied(signal?: AbortSignal): Promise<PaymentUnappliedRow[]> {
  return requestJson(`${BASE}/financiero/pagos-sin-aplicar`, { signal })
}

// ── Operación ─────────────────────────────────────────────────────────────────

export function getWarehouseKpis(signal?: AbortSignal): Promise<WarehouseKpis> {
  return requestJson(`${BASE}/operacion/almacen-kpis`, { signal })
}

export function getNcBySupplier(signal?: AbortSignal): Promise<NcBySupplierRow[]> {
  return requestJson(`${BASE}/operacion/ncs-proveedor`, { signal })
}

export function getRouteEfficiency(
  params: { limit?: number } = {},
  signal?: AbortSignal,
): Promise<RouteEfficiencyRow[]> {
  const q = new URLSearchParams()
  if (params.limit) q.set("limit", String(params.limit))
  return requestJson(`${BASE}/operacion/rutas?${q}`, { signal })
}
