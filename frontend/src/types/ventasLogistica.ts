// Tipos TypeScript — Módulo Ventas y Logística

// ─── Carriers ───────────────────────────────────────────────────────────────

export interface Carrier {
  carrier_id: number
  code: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  tracking_url_template: string | null
  is_internal: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CarrierCreate {
  code: string
  name: string
  contact_name?: string
  phone?: string
  email?: string
  tracking_url_template?: string
  is_internal?: boolean
  is_active?: boolean
}

export interface CarrierUpdate {
  name?: string
  contact_name?: string
  phone?: string
  email?: string
  tracking_url_template?: string
  is_internal?: boolean
  is_active?: boolean
}

// ─── Delivery Notes ──────────────────────────────────────────────────────────

export type DeliveryNoteStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'DELIVERED'
  | 'TRANSFORMED'
  | 'PARTIALLY_INVOICED'
  | 'INVOICED'
  | 'CANCELLED'

export interface DeliveryNoteItem {
  item_id: number
  delivery_note_id: number
  product_id: string | null
  sku: string | null
  description: string
  quantity: number
  unit_price: number
  discount_amount: number
  tax_rate: number
  subtotal: number
  tax_amount: number
  total: number
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface DeliveryNote {
  delivery_note_id: number
  note_number: string
  customer_id: number
  shipping_address_id: number | null
  sales_rep_id: string | null
  issue_date: string
  delivery_date: string | null
  status: DeliveryNoteStatus
  customer_po_number: string | null
  customer_po_date: string | null
  subtotal: number
  tax_amount: number
  total: number
  notes: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  items: DeliveryNoteItem[]
  created_at: string
  updated_at: string
}

export interface DeliveryNoteItemCreate {
  product_id?: string
  sku?: string
  description: string
  quantity: number
  unit_price: number
  discount_amount?: number
  tax_rate?: number
  notes?: string
  sort_order?: number
}

export interface DeliveryNoteCreate {
  customer_id: number
  shipping_address_id?: number
  issue_date: string
  delivery_date?: string
  customer_po_number?: string
  customer_po_date?: string
  notes?: string
  items?: DeliveryNoteItemCreate[]
}

export interface DeliveryNoteUpdate {
  shipping_address_id?: number
  delivery_date?: string
  status?: DeliveryNoteStatus
  customer_po_number?: string
  customer_po_date?: string
  notes?: string
  cancellation_reason?: string
}

// ─── Quotes ──────────────────────────────────────────────────────────────────

export type QuoteStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'

export interface QuoteItem {
  quote_item_id: number
  quote_id: number
  product_id: string | null
  delivery_note_item_id: number | null
  sku: string | null
  description: string
  quantity: number
  unit_price: number
  discount_pct: number
  tax_rate: number
  subtotal: number
  tax_amount: number
  total: number
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface QuoteStatusHistory {
  history_id: number
  quote_id: number
  from_status: string | null
  to_status: string
  changed_by: string | null
  changed_at: string
  notes: string | null
}

export interface Quote {
  quote_id: number
  quote_number: string
  customer_id: number
  sales_rep_id: string | null
  status: QuoteStatus
  issue_date: string
  expiry_date: string | null
  customer_po_number: string | null
  customer_po_date: string | null
  currency: string
  exchange_rate: number
  payment_terms: string | null
  shipping_address_id: number | null
  subtotal: number
  tax_amount: number
  total: number
  notes: string | null
  internal_notes: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejection_reason: string | null
  items: QuoteItem[]
  created_at: string
  updated_at: string
}

export interface QuoteItemCreate {
  product_id?: string
  delivery_note_item_id?: number
  sku?: string
  description: string
  quantity: number
  unit_price: number
  discount_pct?: number
  tax_rate?: number
  notes?: string
  sort_order?: number
}

export interface QuoteCreate {
  customer_id: number
  issue_date: string
  expiry_date?: string
  customer_po_number?: string
  customer_po_date?: string
  currency?: string
  exchange_rate?: number
  payment_terms?: string
  shipping_address_id?: number
  notes?: string
  internal_notes?: string
  items?: QuoteItemCreate[]
}

export interface QuoteUpdate {
  expiry_date?: string
  customer_po_number?: string
  currency?: string
  payment_terms?: string
  shipping_address_id?: number
  notes?: string
  internal_notes?: string
}

export interface QuoteApprove {
  notes?: string
}

export interface QuoteReject {
  rejection_reason: string
}

export interface QuoteLinkDeliveryNotes {
  delivery_note_ids: number[]
  notes?: string
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'CREATED'
  | 'CONFIRMED'
  | 'IN_PRODUCTION'
  | 'READY_TO_SHIP'
  | 'PARTIALLY_SHIPPED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'INVOICED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'CANCELLED'

export type PackingStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'READY'
  | 'PACKED_FOR_ROUTE'
  | 'DISPATCHED'

export interface OrderItem {
  order_item_id: number
  order_id: number
  quote_item_id: number | null
  product_id: string | null
  sku: string | null
  description: string
  quantity_ordered: number
  quantity_packed: number
  quantity_shipped: number
  unit_price: number
  discount_pct: number
  tax_rate: number
  subtotal: number
  tax_amount: number
  total: number
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface OrderMilestone {
  milestone_id: number
  order_id: number
  milestone_type: string
  occurred_at: string
  recorded_by: string | null
  notes: string | null
}

export interface Order {
  order_id: number
  order_number: string
  quote_id: number | null
  customer_id: number
  sales_rep_id: string | null
  packer_id: string | null
  status: OrderStatus
  packing_status: PackingStatus
  order_date: string
  requested_delivery_date: string | null
  delivery_date: string | null
  shipping_address_id: number | null
  currency: string
  exchange_rate: number
  payment_terms: string | null
  subtotal: number
  tax_amount: number
  total: number
  amount_paid: number
  notes: string | null
  internal_notes: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  items: OrderItem[]
  milestones: OrderMilestone[]
  created_at: string
  updated_at: string
}

export interface OrderUpdate {
  status?: OrderStatus
  packing_status?: PackingStatus
  packer_id?: string
  requested_delivery_date?: string
  shipping_address_id?: number
  payment_terms?: string
  notes?: string
  internal_notes?: string
  cancellation_reason?: string
}

export interface OrderItemPackUpdate {
  quantity_packed: number
}

// ─── Views ───────────────────────────────────────────────────────────────────

export interface OrderPackingProgress {
  order_id: number
  order_number: string
  customer: string
  status: string
  packing_status: string
  qty_ordered: number
  qty_packed: number
  packed_pct: number
  computed_status: string
  assigned_packer: string | null
}

export interface OrderPaymentStatus {
  order_id: number
  order_number: string
  customer_id: number
  customer: string
  total: number
  amount_paid: number
  amount_pending: number
  computed_payment_status: 'UNPAID' | 'PARTIAL' | 'PAID'
  first_payment_date: string | null
  last_payment_date: string | null
  num_payments: number
}

export interface IncompleteOrder {
  order_id: number
  order_number: string
  customer: string
  status: string
  order_date: string
  days_open: number
  qty_total: number
  qty_shipped: number
  qty_pending_to_ship: number
  completion_date: string | null
}

export interface ShipmentOverview {
  shipment_id: number
  shipment_number: string
  status: string
  order_id: number
  order_number: string
  customer: string
  carrier_name: string | null
  tracking_number: string | null
  shipping_date: string | null
  estimated_arrival: string | null
  actual_arrival: string | null
  days_in_transit: number | null
  received_by_name: string | null
  incident_notes: string | null
}

export interface CFDICancellation {
  cfdi_id: number
  cfdi_number: string
  uuid: string | null
  customer_id: number
  customer: string
  total: number
  status: string
  cancelled_at: string | null
  cancellation_reason: string | null
  sat_cancellation_motive: string | null
  sat_cancellation_uuid_substitute: string | null
  substitute_cfdi_number: string | null
  substitute_uuid: string | null
  substitute_status: string | null
}

// ─── CFDI ────────────────────────────────────────────────────────────────────

export interface CFDIItem {
  cfdi_item_id: number
  cfdi_id: number
  order_item_id: number | null
  product_id: string | null
  quantity: number
  unit_key: string | null
  product_key: string | null
  description: string
  unit_price: number
  discount_amount: number
  tax_rate: number
  subtotal: number
  tax_amount: number
  total: number
  sort_order: number
  created_at: string
}

export interface CFDI {
  cfdi_id: number
  cfdi_number: string
  uuid: string | null
  cfdi_type: string
  series: string | null
  order_id: number | null
  customer_id: number
  sales_rep_id: string | null
  issue_date: string
  certification_date: string | null
  subtotal: number
  tax_amount: number
  total: number
  currency: string
  exchange_rate: number
  payment_method: string | null
  payment_form: string | null
  cfdi_use: string | null
  status: string
  replaces_cfdi_id: number | null
  replaced_by_cfdi_id: number | null
  sat_cancellation_motive: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  items: CFDIItem[]
  created_at: string
  updated_at: string
}

export interface CFDIItemCreate {
  order_item_id?: number
  product_id?: string
  quantity: number
  unit_key?: string
  product_key?: string
  description: string
  unit_price: number
  discount_amount?: number
  tax_rate?: number
  sort_order?: number
}

export interface CFDICreate {
  order_id?: number
  customer_id: number
  cfdi_type?: string
  series?: string
  issue_date: string
  currency?: string
  exchange_rate?: number
  payment_method?: string
  payment_form?: string
  cfdi_use?: string
  items?: CFDIItemCreate[]
}

export interface CFDICancelRequest {
  sat_cancellation_motive: '01' | '02' | '03' | '04'
  cancellation_reason: string
  replaces_cfdi_id?: number
}

// ─── Payments ────────────────────────────────────────────────────────────────

export interface PaymentApplication {
  application_id: number
  payment_id: number
  order_id: number | null
  cfdi_id: number | null
  amount_applied: number
  applied_at: string
  applied_by: string | null
  notes: string | null
}

export interface Payment {
  payment_id: number
  payment_number: string
  customer_id: number
  payment_date: string
  payment_form: string
  currency: string
  exchange_rate: number
  amount: number
  bank_reference: string | null
  bank_account: string | null
  notes: string | null
  status: string
  recorded_by: string | null
  applications: PaymentApplication[]
  created_at: string
  updated_at: string
}

export interface PaymentCreate {
  customer_id: number
  payment_date: string
  payment_form: string
  currency?: string
  exchange_rate?: number
  amount: number
  bank_reference?: string
  bank_account?: string
  notes?: string
}

export interface PaymentApplicationCreate {
  order_id?: number
  cfdi_id?: number
  amount_applied: number
  notes?: string
}

// ─── Shipments ───────────────────────────────────────────────────────────────

export type ShipmentStatus =
  | 'PREPARING'
  | 'READY'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'RETURNED'
  | 'INCIDENT'
  | 'CANCELLED'

export interface ShipmentItem {
  shipment_item_id: number
  shipment_id: number
  order_item_id: number
  quantity: number
  notes: string | null
  created_at: string
}

export interface TrackingEvent {
  event_id: number
  shipment_id: number
  event_date: string
  location: string | null
  status_code: string
  description: string | null
  recorded_by: string | null
  is_automatic: boolean
  created_at: string
}

export interface Shipment {
  shipment_id: number
  shipment_number: string
  order_id: number
  delivery_note_id: number | null
  customer_address_id: number | null
  carrier_id: number | null
  tracking_number: string | null
  tracking_url: string | null
  status: ShipmentStatus
  shipping_cost: number | null
  shipping_date: string | null
  estimated_arrival: string | null
  actual_arrival: string | null
  received_by_name: string | null
  delivery_evidence_url: string | null
  incident_notes: string | null
  items: ShipmentItem[]
  tracking_events: TrackingEvent[]
  created_at: string
  updated_at: string
}

export interface ShipmentItemCreate {
  order_item_id: number
  quantity: number
  notes?: string
}

export interface ShipmentCreate {
  order_id: number
  delivery_note_id?: number
  customer_address_id?: number
  carrier_id?: number
  tracking_number?: string
  shipping_date?: string
  estimated_arrival?: string
  shipping_cost?: number
  items?: ShipmentItemCreate[]
}

export interface ShipmentUpdate {
  carrier_id?: number
  tracking_number?: string
  tracking_url?: string
  status?: ShipmentStatus
  shipping_date?: string
  estimated_arrival?: string
  actual_arrival?: string
  received_by_name?: string
  delivery_evidence_url?: string
  incident_notes?: string
  shipping_cost?: number
}

export interface ShipmentDeliverRequest {
  received_by_name: string
  actual_arrival?: string
  delivery_evidence_url?: string
}

export interface TrackingEventCreate {
  event_date?: string
  location?: string
  status_code: string
  description?: string
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export type RouteStatus = 'PLANNING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type RouteStopType = 'DELIVERY' | 'PICKUP'
export type RouteStopStatus = 'PENDING' | 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED' | 'FAILED' | 'SKIPPED'

export interface RouteStop {
  stop_id: number
  route_id: number
  stop_order: number
  stop_type: RouteStopType
  customer_address_id: number | null
  shipment_id: number | null
  supplier_address_id: number | null
  purchase_order_id: string | null
  goods_receipt_id: string | null
  estimated_arrival: string | null
  actual_arrival: string | null
  actual_departure: string | null
  status: RouteStopStatus
  failure_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Route {
  route_id: number
  route_number: string
  route_date: string
  driver_user_id: string | null
  vehicle_plate: string | null
  vehicle_label: string | null
  status: RouteStatus
  start_time: string | null
  end_time: string | null
  total_distance_km: number | null
  notes: string | null
  stops: RouteStop[]
  created_at: string
  updated_at: string
}

export interface RouteStopCreate {
  stop_order: number
  stop_type: RouteStopType
  customer_address_id?: number
  shipment_id?: number
  supplier_address_id?: number
  purchase_order_id?: string
  goods_receipt_id?: string
  estimated_arrival?: string
  notes?: string
}

export interface RouteCreate {
  route_date: string
  driver_user_id?: string
  vehicle_plate?: string
  vehicle_label?: string
  notes?: string
  stops?: RouteStopCreate[]
}

export interface RouteUpdate {
  route_date?: string
  driver_user_id?: string
  vehicle_plate?: string
  vehicle_label?: string
  status?: RouteStatus
  start_time?: string
  end_time?: string
  total_distance_km?: number
  notes?: string
}

export interface RouteStopUpdate {
  stop_order?: number
  shipment_id?: number
  goods_receipt_id?: string
  estimated_arrival?: string
  actual_arrival?: string
  actual_departure?: string
  status?: RouteStopStatus
  failure_reason?: string
  notes?: string
}
