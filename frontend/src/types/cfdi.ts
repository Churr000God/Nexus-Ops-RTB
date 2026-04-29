// Tipos TypeScript — Módulo CFDI 4.0

export type CfdiType = "I" | "E" | "P" | "T"
export type CfdiStatus = "DRAFT" | "ISSUED" | "TIMBRADO" | "PAID" | "CANCELLED" | "SUPERSEDED"
export type CfdiCancelReason = "01" | "02" | "03" | "04"
export type PaymentMethod = "PUE" | "PPD"

// ── Issuer Config ────────────────────────────────────────────────────────────

export interface CfdiIssuerConfigOut {
  config_id: number
  rfc: string
  legal_name: string
  tax_regime_id: number | null
  zip_code: string
  csd_serial_number: string | null
  csd_valid_from: string | null
  csd_valid_to: string | null
  pac_provider: string | null
  pac_environment: string
  is_active: boolean
  valid_from: string | null
  valid_to: string | null
  created_at: string
  updated_at: string
}

// ── Series ───────────────────────────────────────────────────────────────────

export interface CfdiSeriesOut {
  series_id: number
  series: string
  cfdi_type: CfdiType
  description: string | null
  next_folio: number
  is_active: boolean
}

// ── CFDI Items ───────────────────────────────────────────────────────────────

export interface CfdiItemOut {
  cfdi_item_id: number
  order_item_id: number | null
  product_id: string | null
  sat_product_key_id: string | null
  sat_unit_key_id: string | null
  unit_key: string | null
  product_key: string | null
  description: string
  quantity: number
  unit_price: number
  discount_amount: number
  iva_pct: number
  subtotal: number
  tax_amount: number
  total: number
  sort_order: number
}

// ── CFDI ─────────────────────────────────────────────────────────────────────

export interface CfdiListItem {
  cfdi_id: number
  cfdi_number: string
  uuid: string | null
  cfdi_type: CfdiType
  series: string | null
  folio: number | null
  issue_date: string
  receiver_name: string | null
  receiver_rfc: string | null
  total: number
  currency: string
  payment_method: string | null
  status: CfdiStatus
  timbre_date: string | null
}

export interface CfdiOut {
  cfdi_id: number
  cfdi_number: string
  uuid: string | null
  cfdi_type: CfdiType
  series: string | null
  series_id: number | null
  folio: number | null
  cfdi_version: string
  issue_date: string
  issuer_rfc: string | null
  issuer_name: string | null
  issuer_tax_regime: string | null
  receiver_rfc: string | null
  receiver_name: string | null
  receiver_tax_regime: string | null
  receiver_zip: string | null
  subtotal: number
  tax_amount: number
  total: number
  currency: string
  exchange_rate: number
  payment_method: string | null
  payment_form: string | null
  cfdi_use: string | null
  status: CfdiStatus
  sello_cfdi: string | null
  sello_sat: string | null
  certificate_number: string | null
  timbre_date: string | null
  xml_path: string | null
  pdf_path: string | null
  sat_cancellation_motive: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  replaces_cfdi_id: number | null
  replaced_by_cfdi_id: number | null
  order_id: number | null
  customer_id: number
  issuer_config_id: number | null
  created_at: string
  updated_at: string
  items: CfdiItemOut[]
}

// ── Stamp / Cancel responses ─────────────────────────────────────────────────

export interface CfdiStampResponse {
  cfdi_id: number
  uuid: string
  status: string
  timbre_date: string
  certificate_number: string
}

export interface CfdiCancelResponse {
  cfdi_id: number
  status: string
  sat_status: string | null
}

// ── PPD Pendientes ───────────────────────────────────────────────────────────

export interface CfdiPpdPending {
  cfdi_id: number
  uuid: string | null
  cfdi_number: string
  series_code: string | null
  folio: number | null
  issue_date: string
  customer_name: string | null
  customer_rfc: string | null
  total: number
  paid_amount: number
  remaining_balance: number
  days_since_issue: number
  status: string
}

// ── PAC Log ──────────────────────────────────────────────────────────────────

export interface CfdiPacLogOut {
  log_id: number
  cfdi_id: number
  operation: string
  success: boolean
  uuid_received: string | null
  error_code: string | null
  error_message: string | null
  pac_provider: string | null
  requested_at: string
}

// ── Input types ──────────────────────────────────────────────────────────────

export interface CfdiItemIn {
  order_item_id?: number | null
  product_id?: string | null
  description: string
  quantity: number
  unit_price: number
  discount_amount?: number
  iva_pct?: number
  sort_order?: number
}

export interface CfdiCreateIn {
  cfdi_number: string
  cfdi_type?: CfdiType
  series: string
  order_id?: number | null
  customer_id: number
  issue_date: string
  currency?: string
  exchange_rate?: number
  payment_method?: PaymentMethod | null
  payment_form?: string | null
  cfdi_use?: string | null
  items: CfdiItemIn[]
}

export interface CfdiCancelIn {
  reason: CfdiCancelReason
  substitute_cfdi_number?: string | null
  notes?: string | null
}

export type PacProvider = "DIVERZA" | "EDICOM" | "FACTURAMA" | "STUB"
export type PacEnvironment = "SANDBOX" | "PRODUCTION"

export interface CfdiIssuerConfigIn {
  rfc: string
  legal_name: string
  tax_regime_id?: number | null
  zip_code: string
  csd_serial_number?: string | null
  csd_valid_from?: string | null
  csd_valid_to?: string | null
  pac_provider?: PacProvider | null
  pac_username?: string | null
  pac_endpoint_url?: string | null
  pac_environment?: PacEnvironment
  valid_from?: string | null
  valid_to?: string | null
}
