import { requestJson } from "@/lib/http"
import type {
  GoodsReceipt,
  GoodsReceiptIn,
  GoodsReceiptListItem,
  OperatingExpense,
  OperatingExpenseIn,
  PurchaseOrder,
  PurchaseOrderIn,
  PurchaseOrderListItem,
  POStatus,
  PurchaseRequest,
  PurchaseRequestIn,
  PurchaseRequestListItem,
  SatPaymentForm,
  SatPaymentMethod,
  SupplierInvoice,
  SupplierInvoiceIn,
  SupplierInvoiceListItem,
  SupplierInvoicePayUpdate,
} from "@/types/compras"

const BASE = "/api/compras"
const GASTOS = "/api/gastos"

// ── Catálogos SAT ────────────────────────────────────────────────────────────

export function getSatPaymentForms(signal?: AbortSignal): Promise<SatPaymentForm[]> {
  return requestJson(`${BASE}/sat/formas-pago`, { signal })
}

export function getSatPaymentMethods(signal?: AbortSignal): Promise<SatPaymentMethod[]> {
  return requestJson(`${BASE}/sat/metodos-pago`, { signal })
}

// ── Purchase Requests ────────────────────────────────────────────────────────

export function getPurchaseRequests(
  params: { status?: string; limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<PurchaseRequestListItem[]> {
  const q = new URLSearchParams()
  if (params.status) q.set("status", params.status)
  if (params.limit) q.set("limit", String(params.limit))
  if (params.offset) q.set("offset", String(params.offset))
  return requestJson(`${BASE}/solicitudes?${q}`, { signal })
}

export function getPurchaseRequest(id: number, signal?: AbortSignal): Promise<PurchaseRequest> {
  return requestJson(`${BASE}/solicitudes/${id}`, { signal })
}

export function createPurchaseRequest(body: PurchaseRequestIn): Promise<PurchaseRequest> {
  return requestJson(`${BASE}/solicitudes`, { method: "POST", body: JSON.stringify(body) })
}

export function updatePurchaseRequestStatus(
  id: number,
  status: string,
): Promise<PurchaseRequest> {
  return requestJson(`${BASE}/solicitudes/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

// ── Purchase Orders ──────────────────────────────────────────────────────────

export function getPurchaseOrders(
  params: { status?: string; supplier_id?: number; limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<PurchaseOrderListItem[]> {
  const q = new URLSearchParams()
  if (params.status) q.set("status", params.status)
  if (params.supplier_id) q.set("supplier_id", String(params.supplier_id))
  if (params.limit) q.set("limit", String(params.limit))
  if (params.offset) q.set("offset", String(params.offset))
  return requestJson(`${BASE}/ordenes?${q}`, { signal })
}

export function getPurchaseOrder(id: number, signal?: AbortSignal): Promise<PurchaseOrder> {
  return requestJson(`${BASE}/ordenes/${id}`, { signal })
}

export function createPurchaseOrder(body: PurchaseOrderIn): Promise<PurchaseOrder> {
  return requestJson(`${BASE}/ordenes`, { method: "POST", body: JSON.stringify(body) })
}

export function updatePurchaseOrderStatus(id: number, status: string): Promise<PurchaseOrder> {
  return requestJson(`${BASE}/ordenes/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

// ── Goods Receipts ───────────────────────────────────────────────────────────

export function getGoodsReceipts(
  params: { po_id?: number; supplier_id?: number; limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<GoodsReceiptListItem[]> {
  const q = new URLSearchParams()
  if (params.po_id) q.set("po_id", String(params.po_id))
  if (params.supplier_id) q.set("supplier_id", String(params.supplier_id))
  if (params.limit) q.set("limit", String(params.limit))
  if (params.offset) q.set("offset", String(params.offset))
  return requestJson(`${BASE}/recepciones?${q}`, { signal })
}

export function getGoodsReceipt(id: number, signal?: AbortSignal): Promise<GoodsReceipt> {
  return requestJson(`${BASE}/recepciones/${id}`, { signal })
}

export function createGoodsReceipt(body: GoodsReceiptIn): Promise<GoodsReceipt> {
  return requestJson(`${BASE}/recepciones`, { method: "POST", body: JSON.stringify(body) })
}

// ── Supplier Invoices ────────────────────────────────────────────────────────

export function getSupplierInvoices(
  params: {
    supplier_id?: number
    payment_status?: string
    status?: string
    limit?: number
    offset?: number
  } = {},
  signal?: AbortSignal,
): Promise<SupplierInvoiceListItem[]> {
  const q = new URLSearchParams()
  if (params.supplier_id) q.set("supplier_id", String(params.supplier_id))
  if (params.payment_status) q.set("payment_status", params.payment_status)
  if (params.status) q.set("status", params.status)
  if (params.limit) q.set("limit", String(params.limit))
  if (params.offset) q.set("offset", String(params.offset))
  return requestJson(`${BASE}/facturas?${q}`, { signal })
}

export function getSupplierInvoice(id: number, signal?: AbortSignal): Promise<SupplierInvoice> {
  return requestJson(`${BASE}/facturas/${id}`, { signal })
}

export function createSupplierInvoice(body: SupplierInvoiceIn): Promise<SupplierInvoice> {
  return requestJson(`${BASE}/facturas`, { method: "POST", body: JSON.stringify(body) })
}

export function paySupplierInvoice(
  id: number,
  body: SupplierInvoicePayUpdate,
): Promise<SupplierInvoice> {
  return requestJson(`${BASE}/facturas/${id}/pagar`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

// ── Operating Expenses ───────────────────────────────────────────────────────

export function getOperatingExpenses(
  params: {
    category?: string
    status?: string
    is_deductible?: boolean
    limit?: number
    offset?: number
  } = {},
  signal?: AbortSignal,
): Promise<OperatingExpense[]> {
  const q = new URLSearchParams()
  if (params.category) q.set("category", params.category)
  if (params.status) q.set("status", params.status)
  if (params.is_deductible !== undefined) q.set("is_deductible", String(params.is_deductible))
  if (params.limit) q.set("limit", String(params.limit))
  if (params.offset) q.set("offset", String(params.offset))
  return requestJson(`${GASTOS}?${q}`, { signal })
}

export function createOperatingExpense(body: OperatingExpenseIn): Promise<OperatingExpense> {
  return requestJson(GASTOS, { method: "POST", body: JSON.stringify(body) })
}

export function updateOperatingExpense(
  id: string,
  body: Partial<OperatingExpenseIn>,
): Promise<OperatingExpense> {
  return requestJson(`${GASTOS}/${id}`, { method: "PATCH", body: JSON.stringify(body) })
}
