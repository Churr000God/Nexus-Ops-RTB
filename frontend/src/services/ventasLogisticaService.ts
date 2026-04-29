import { requestJson } from "@/lib/http"
import type {
  CFDI,
  CFDICancelRequest,
  CFDICancellation,
  CFDICreate,
  Carrier,
  CarrierCreate,
  CarrierUpdate,
  DeliveryNote,
  DeliveryNoteCreate,
  DeliveryNoteUpdate,
  IncompleteOrder,
  Order,
  OrderItemPackUpdate,
  OrderItem,
  OrderPaymentStatus,
  OrderPackingProgress,
  OrderUpdate,
  Payment,
  PaymentApplicationCreate,
  PaymentApplication,
  PaymentCreate,
  Quote,
  QuoteApprove,
  QuoteCreate,
  QuoteLinkDeliveryNotes,
  QuoteReject,
  QuoteUpdate,
  Route,
  RouteCreate,
  RouteStop,
  RouteStopCreate,
  RouteStopUpdate,
  RouteUpdate,
  Shipment,
  ShipmentCreate,
  ShipmentDeliverRequest,
  ShipmentOverview,
  ShipmentUpdate,
  TrackingEvent,
  TrackingEventCreate,
} from "@/types/ventasLogistica"

const BASE = "/api/ventas-logistica"

// ─── Carriers ────────────────────────────────────────────────────────────────

export const getCarriers = (activeOnly = true) =>
  requestJson<Carrier[]>(`${BASE}/carriers?active_only=${activeOnly}`)

export const getCarrier = (id: number) =>
  requestJson<Carrier>(`${BASE}/carriers/${id}`)

export const createCarrier = (data: CarrierCreate) =>
  requestJson<Carrier>(`${BASE}/carriers`, { method: "POST", body: JSON.stringify(data) })

export const updateCarrier = (id: number, data: CarrierUpdate) =>
  requestJson<Carrier>(`${BASE}/carriers/${id}`, { method: "PATCH", body: JSON.stringify(data) })

export const deleteCarrier = (id: number) =>
  requestJson<void>(`${BASE}/carriers/${id}`, { method: "DELETE" })

// ─── Delivery Notes ──────────────────────────────────────────────────────────

export type DeliveryNoteListParams = {
  customer_id?: number
  status?: string
  limit?: number
  offset?: number
}

export const getDeliveryNotes = (params: DeliveryNoteListParams = {}) => {
  const q = new URLSearchParams()
  if (params.customer_id) q.set("customer_id", String(params.customer_id))
  if (params.status) q.set("status", params.status)
  if (params.limit) q.set("limit", String(params.limit))
  if (params.offset) q.set("offset", String(params.offset))
  return requestJson<DeliveryNote[]>(`${BASE}/delivery-notes?${q}`)
}

export const getDeliveryNote = (id: number) =>
  requestJson<DeliveryNote>(`${BASE}/delivery-notes/${id}`)

export const createDeliveryNote = (data: DeliveryNoteCreate) =>
  requestJson<DeliveryNote>(`${BASE}/delivery-notes`, { method: "POST", body: JSON.stringify(data) })

export const updateDeliveryNote = (id: number, data: DeliveryNoteUpdate) =>
  requestJson<DeliveryNote>(`${BASE}/delivery-notes/${id}`, { method: "PATCH", body: JSON.stringify(data) })

// ─── Quotes ──────────────────────────────────────────────────────────────────

export type QuoteListParams = {
  customer_id?: number
  status?: string
  limit?: number
  offset?: number
}

export const getQuotes = (params: QuoteListParams = {}) => {
  const q = new URLSearchParams()
  if (params.customer_id) q.set("customer_id", String(params.customer_id))
  if (params.status) q.set("status", params.status)
  if (params.limit) q.set("limit", String(params.limit))
  if (params.offset) q.set("offset", String(params.offset))
  return requestJson<Quote[]>(`${BASE}/quotes?${q}`)
}

export const getQuote = (id: number) =>
  requestJson<Quote>(`${BASE}/quotes/${id}`)

export const createQuote = (data: QuoteCreate) =>
  requestJson<Quote>(`${BASE}/quotes`, { method: "POST", body: JSON.stringify(data) })

export const updateQuote = (id: number, data: QuoteUpdate) =>
  requestJson<Quote>(`${BASE}/quotes/${id}`, { method: "PATCH", body: JSON.stringify(data) })

export const approveQuote = (id: number, data: QuoteApprove = {}) =>
  requestJson<Quote>(`${BASE}/quotes/${id}/approve`, { method: "POST", body: JSON.stringify(data) })

export const rejectQuote = (id: number, data: QuoteReject) =>
  requestJson<Quote>(`${BASE}/quotes/${id}/reject`, { method: "POST", body: JSON.stringify(data) })

export const linkDeliveryNotes = (id: number, data: QuoteLinkDeliveryNotes) =>
  requestJson<Quote>(`${BASE}/quotes/${id}/link-delivery-notes`, { method: "POST", body: JSON.stringify(data) })

// ─── Orders ──────────────────────────────────────────────────────────────────

export type OrderListParams = {
  customer_id?: number
  status?: string
  packing_status?: string
  limit?: number
  offset?: number
}

export const getOrders = (params: OrderListParams = {}) => {
  const q = new URLSearchParams()
  if (params.customer_id) q.set("customer_id", String(params.customer_id))
  if (params.status) q.set("status", params.status)
  if (params.packing_status) q.set("packing_status", params.packing_status)
  if (params.limit) q.set("limit", String(params.limit))
  if (params.offset) q.set("offset", String(params.offset))
  return requestJson<Order[]>(`${BASE}/orders?${q}`)
}

export const getOrder = (id: number) =>
  requestJson<Order>(`${BASE}/orders/${id}`)

export const updateOrder = (id: number, data: OrderUpdate) =>
  requestJson<Order>(`${BASE}/orders/${id}`, { method: "PATCH", body: JSON.stringify(data) })

export const packOrderItem = (orderId: number, itemId: number, data: OrderItemPackUpdate) =>
  requestJson<OrderItem>(`${BASE}/orders/${orderId}/items/${itemId}/pack`, { method: "PATCH", body: JSON.stringify(data) })

export const getOrderPackingProgress = (id: number) =>
  requestJson<OrderPackingProgress>(`${BASE}/orders/${id}/packing-progress`)

export const getOrderPaymentStatus = (id: number) =>
  requestJson<OrderPaymentStatus>(`${BASE}/orders/${id}/payment-status`)

export const getIncompleteOrders = () =>
  requestJson<IncompleteOrder[]>(`${BASE}/orders/incomplete`)

// ─── CFDI ────────────────────────────────────────────────────────────────────

export type CFDIListParams = {
  customer_id?: number
  status?: string
  limit?: number
  offset?: number
}

export const getCFDIList = (params: CFDIListParams = {}) => {
  const q = new URLSearchParams()
  if (params.customer_id) q.set("customer_id", String(params.customer_id))
  if (params.status) q.set("status", params.status)
  if (params.limit) q.set("limit", String(params.limit))
  if (params.offset) q.set("offset", String(params.offset))
  return requestJson<CFDI[]>(`${BASE}/cfdi?${q}`)
}

export const getCFDI = (id: number) =>
  requestJson<CFDI>(`${BASE}/cfdi/${id}`)

export const createCFDI = (data: CFDICreate) =>
  requestJson<CFDI>(`${BASE}/cfdi`, { method: "POST", body: JSON.stringify(data) })

export const cancelCFDI = (id: number, data: CFDICancelRequest) =>
  requestJson<CFDI>(`${BASE}/cfdi/${id}/cancel`, { method: "POST", body: JSON.stringify(data) })

export const getCFDICancellations = (days = 30) =>
  requestJson<CFDICancellation[]>(`${BASE}/cfdi/cancellations?days=${days}`)

// ─── Payments ────────────────────────────────────────────────────────────────

export const getPayments = (customerId?: number, limit = 50, offset = 0) => {
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (customerId) q.set("customer_id", String(customerId))
  return requestJson<Payment[]>(`${BASE}/payments?${q}`)
}

export const getPayment = (id: number) =>
  requestJson<Payment>(`${BASE}/payments/${id}`)

export const createPayment = (data: PaymentCreate) =>
  requestJson<Payment>(`${BASE}/payments`, { method: "POST", body: JSON.stringify(data) })

export const applyPayment = (id: number, data: PaymentApplicationCreate) =>
  requestJson<PaymentApplication>(`${BASE}/payments/${id}/apply`, { method: "POST", body: JSON.stringify(data) })

// ─── Shipments ───────────────────────────────────────────────────────────────

export type ShipmentListParams = {
  order_id?: number
  status?: string
  limit?: number
  offset?: number
}

export const getShipments = (params: ShipmentListParams = {}) => {
  const q = new URLSearchParams()
  if (params.order_id) q.set("order_id", String(params.order_id))
  if (params.status) q.set("status", params.status)
  if (params.limit) q.set("limit", String(params.limit))
  if (params.offset) q.set("offset", String(params.offset))
  return requestJson<Shipment[]>(`${BASE}/shipments?${q}`)
}

export const getShipment = (id: number) =>
  requestJson<Shipment>(`${BASE}/shipments/${id}`)

export const createShipment = (data: ShipmentCreate) =>
  requestJson<Shipment>(`${BASE}/shipments`, { method: "POST", body: JSON.stringify(data) })

export const updateShipment = (id: number, data: ShipmentUpdate) =>
  requestJson<Shipment>(`${BASE}/shipments/${id}`, { method: "PATCH", body: JSON.stringify(data) })

export const deliverShipment = (id: number, data: ShipmentDeliverRequest) =>
  requestJson<Shipment>(`${BASE}/shipments/${id}/deliver`, { method: "POST", body: JSON.stringify(data) })

export const addTrackingEvent = (id: number, data: TrackingEventCreate) =>
  requestJson<TrackingEvent>(`${BASE}/shipments/${id}/tracking-events`, { method: "POST", body: JSON.stringify(data) })

export const getShipmentsOverview = () =>
  requestJson<ShipmentOverview[]>(`${BASE}/shipments/overview`)

// ─── Routes ──────────────────────────────────────────────────────────────────

export type RouteListParams = {
  route_date?: string
  status?: string
  limit?: number
  offset?: number
}

export const getRoutes = (params: RouteListParams = {}) => {
  const q = new URLSearchParams()
  if (params.route_date) q.set("route_date", params.route_date)
  if (params.status) q.set("status", params.status)
  if (params.limit) q.set("limit", String(params.limit))
  if (params.offset) q.set("offset", String(params.offset))
  return requestJson<Route[]>(`${BASE}/routes?${q}`)
}

export const getRoute = (id: number) =>
  requestJson<Route>(`${BASE}/routes/${id}`)

export const createRoute = (data: RouteCreate) =>
  requestJson<Route>(`${BASE}/routes`, { method: "POST", body: JSON.stringify(data) })

export const updateRoute = (id: number, data: RouteUpdate) =>
  requestJson<Route>(`${BASE}/routes/${id}`, { method: "PATCH", body: JSON.stringify(data) })

export const addRouteStop = (routeId: number, data: RouteStopCreate) =>
  requestJson<RouteStop>(`${BASE}/routes/${routeId}/stops`, { method: "POST", body: JSON.stringify(data) })

export const updateRouteStop = (routeId: number, stopId: number, data: RouteStopUpdate) =>
  requestJson<RouteStop>(`${BASE}/routes/${routeId}/stops/${stopId}`, { method: "PATCH", body: JSON.stringify(data) })
