// Tipos TypeScript — Módulo de Compras

export type ItemType = "GOODS_RESALE" | "GOODS_INTERNAL" | "SERVICE"
export type PRStatus = "DRAFT" | "APPROVED" | "PARTIALLY_ORDERED" | "ORDERED" | "REJECTED" | "CANCELLED"
export type POType = "GOODS" | "SERVICES" | "MIXED"
export type POStatus = "DRAFT" | "SENT" | "CONFIRMED" | "PARTIAL_RECEIVED" | "RECEIVED" | "INVOICED" | "PAID" | "CANCELLED"
export type InvoiceType = "GOODS" | "SERVICES" | "MIXED"
export type InvoiceStatus = "RECEIVED" | "VALIDATED" | "PAID" | "CANCELLED"
export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID"

// ── Catálogos SAT ────────────────────────────────────────────────────────────

export interface SatPaymentForm {
  form_id: string
  description: string
  is_active: boolean
}

export interface SatPaymentMethod {
  method_id: string
  description: string
  is_credit: boolean
  is_active: boolean
}

// ── Purchase Requests ────────────────────────────────────────────────────────

export interface PurchaseRequestItem {
  request_item_id: number
  line_number: number
  item_type: ItemType
  product_id: string | null
  service_description: string | null
  unit_of_measure: string | null
  quantity_requested: number
  quantity_ordered: number
  suggested_supplier_id: number | null
  quote_item_id: number | null
  in_package: boolean
  exception_reason: string | null
  notes: string | null
}

export interface PurchaseRequest {
  request_id: number
  request_number: string
  requested_by: string | null
  request_date: string
  status: PRStatus
  notes: string | null
  created_at: string
  updated_at: string
  items: PurchaseRequestItem[]
}

export interface PurchaseRequestListItem {
  request_id: number
  request_number: string
  requested_by: string | null
  request_date: string
  status: PRStatus
  notes: string | null
  created_at: string
}

export interface PurchaseRequestItemIn {
  line_number: number
  item_type: ItemType
  product_id?: string | null
  service_description?: string | null
  unit_of_measure?: string | null
  quantity_requested: number
  suggested_supplier_id?: number | null
  quote_item_id?: number | null
  in_package?: boolean
  exception_reason?: string | null
  notes?: string | null
}

export interface PurchaseRequestIn {
  request_number: string
  request_date: string
  notes?: string | null
  items: PurchaseRequestItemIn[]
}

// ── Purchase Orders ──────────────────────────────────────────────────────────

export interface PurchaseOrderItem {
  po_item_id: number
  line_number: number
  request_item_id: number | null
  item_type: ItemType
  product_id: string | null
  service_description: string | null
  unit_of_measure: string | null
  quantity_ordered: number
  quantity_received: number
  unit_cost: number | null
  tax_pct: number
  subtotal: number | null
  notes: string | null
}

export interface PurchaseOrder {
  po_id: number
  po_number: string
  supplier_id: number
  po_type: POType
  status: POStatus
  collection_status: string | null
  issue_date: string | null
  sent_date: string | null
  confirmation_date: string | null
  estimated_pickup_date: string | null
  pickup_date: string | null
  is_confirmed: boolean
  is_email_sent: boolean
  is_printed: boolean
  currency: string
  exchange_rate: number
  subtotal: number | null
  tax_amount: number | null
  shipping_amount: number | null
  total: number | null
  notes: string | null
  created_at: string
  updated_at: string
  items: PurchaseOrderItem[]
}

export interface PurchaseOrderListItem {
  po_id: number
  po_number: string
  supplier_id: number
  po_type: POType
  status: POStatus
  issue_date: string | null
  estimated_pickup_date: string | null
  total: number | null
  created_at: string
}

export interface PurchaseOrderItemIn {
  line_number: number
  request_item_id?: number | null
  item_type: ItemType
  product_id?: string | null
  service_description?: string | null
  unit_of_measure?: string | null
  quantity_ordered: number
  unit_cost?: number | null
  tax_pct?: number
  notes?: string | null
}

export interface PurchaseOrderIn {
  po_number: string
  supplier_id: number
  po_type?: POType
  issue_date?: string | null
  estimated_pickup_date?: string | null
  currency?: string
  exchange_rate?: number
  subtotal?: number | null
  tax_amount?: number | null
  shipping_amount?: number | null
  total?: number | null
  notes?: string | null
  items: PurchaseOrderItemIn[]
}

// ── Goods Receipts ───────────────────────────────────────────────────────────

export interface GoodsReceiptItem {
  receipt_item_id: number
  po_item_id: number
  line_number: number
  product_id: string | null
  quantity_requested: number
  quantity_received: number
  unit_cost: number | null
  notes: string | null
}

export interface GoodsReceipt {
  receipt_id: number
  receipt_number: string
  po_id: number
  supplier_invoice_id: number | null
  supplier_id: number
  receipt_date: string
  physical_validation: boolean
  validated_by: string | null
  validated_at: string | null
  delivery_pct: number | null
  notes: string | null
  created_at: string
  updated_at: string
  items: GoodsReceiptItem[]
}

export interface GoodsReceiptListItem {
  receipt_id: number
  receipt_number: string
  po_id: number
  supplier_id: number
  receipt_date: string
  physical_validation: boolean
  delivery_pct: number | null
  created_at: string
}

export interface GoodsReceiptItemIn {
  po_item_id: number
  line_number: number
  product_id?: string | null
  quantity_requested: number
  quantity_received: number
  unit_cost?: number | null
  notes?: string | null
}

export interface GoodsReceiptIn {
  receipt_number: string
  po_id: number
  supplier_id: number
  receipt_date: string
  physical_validation?: boolean
  notes?: string | null
  items: GoodsReceiptItemIn[]
}

// ── Supplier Invoices ────────────────────────────────────────────────────────

export interface SupplierInvoiceItem {
  invoice_item_id: number
  po_item_id: number | null
  receipt_item_id: number | null
  line_number: number
  item_type: ItemType
  product_id: string | null
  concept_description: string | null
  unit_of_measure: string | null
  quantity: number
  unit_cost: number | null
  tax_pct: number
  subtotal: number | null
  notes: string | null
}

export interface SupplierInvoice {
  invoice_id: number
  invoice_number: string
  supplier_id: number
  po_id: number | null
  invoice_type: InvoiceType
  invoice_date: string
  received_date: string | null
  status: InvoiceStatus
  payment_status: PaymentStatus
  payment_date: string | null
  sat_payment_form_id: string | null
  sat_payment_method_id: string | null
  is_credit: boolean | null
  uuid_sat: string | null
  subtotal: number | null
  tax_amount: number | null
  shipping_amount: number | null
  discount_amount: number | null
  total: number | null
  currency: string
  exchange_rate: number
  notes: string | null
  created_at: string
  updated_at: string
  items: SupplierInvoiceItem[]
}

export interface SupplierInvoiceListItem {
  invoice_id: number
  invoice_number: string
  supplier_id: number
  po_id: number | null
  invoice_type: InvoiceType
  invoice_date: string
  status: InvoiceStatus
  payment_status: PaymentStatus
  is_credit: boolean | null
  total: number | null
  created_at: string
}

export interface SupplierInvoiceItemIn {
  po_item_id?: number | null
  receipt_item_id?: number | null
  line_number: number
  item_type?: ItemType
  product_id?: string | null
  concept_description?: string | null
  unit_of_measure?: string | null
  quantity: number
  unit_cost?: number | null
  tax_pct?: number
  notes?: string | null
}

export interface SupplierInvoiceIn {
  invoice_number: string
  supplier_id: number
  po_id?: number | null
  invoice_type?: InvoiceType
  invoice_date: string
  received_date?: string | null
  sat_payment_form_id?: string | null
  sat_payment_method_id?: string | null
  uuid_sat?: string | null
  subtotal?: number | null
  tax_amount?: number | null
  shipping_amount?: number | null
  discount_amount?: number | null
  total?: number | null
  currency?: string
  exchange_rate?: number
  notes?: string | null
  items: SupplierInvoiceItemIn[]
}

export interface SupplierInvoicePayUpdate {
  payment_date: string
  sat_payment_form_id?: string | null
}

// ── Operating Expenses ───────────────────────────────────────────────────────

export interface OperatingExpense {
  id: string
  concept: string
  category: string | null
  expense_date: string | null
  subtotal: number | null
  iva: number | null
  total: number | null
  supplier_id: string | null
  supplier_name: string | null
  supplier_rfc: string | null
  invoice_folio: string | null
  uuid_sat: string | null
  expense_number: string | null
  is_deductible: boolean | null
  payment_method: string | null
  sat_payment_form_id: string | null
  sat_payment_method_id: string | null
  status: string | null
  notes: string | null
  created_at: string
}

export interface OperatingExpenseIn {
  concept: string
  category: string
  expense_date: string
  subtotal: number
  supplier_name?: string | null
  supplier_rfc?: string | null
  invoice_folio?: string | null
  uuid_sat?: string | null
  expense_number?: string | null
  is_deductible?: boolean
  payment_method?: string | null
  sat_payment_form_id?: string | null
  sat_payment_method_id?: string | null
  status?: string
  notes?: string | null
}
