export type SATProductKey = {
  id: string
  code: string
  description: string
  is_active: boolean
}

export type SATUnitKey = {
  id: string
  code: string
  description: string
  is_active: boolean
}

export type SATTaxRegime = {
  regime_id: number
  code: string
  description: string
  applies_to: string
}

export type SATCfdiUse = {
  use_id: string
  description: string
  applies_to: string
}

// ─── Clientes ──────────────────────────────────────────────────────────────

export type CustomerTaxData = {
  tax_data_id: number
  customer_id: number
  rfc: string
  legal_name: string
  tax_regime_id: number | null
  cfdi_use_id: string | null
  zip_code: string
  is_default: boolean
}

export type CustomerAddress = {
  address_id: number
  customer_id: number
  address_type: string
  tax_data_id: number | null
  label: string | null
  street: string
  exterior_number: string | null
  interior_number: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  country: string
  zip_code: string | null
  is_default: boolean
}

export type CustomerAddressCreate = {
  address_type: "DELIVERY" | "OTHER"
  label?: string | null
  street: string
  exterior_number?: string | null
  interior_number?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  country?: string
  zip_code?: string | null
  is_default?: boolean
}

export type CustomerContactCreate = {
  full_name: string
  role_title?: string | null
  email?: string | null
  phone?: string | null
  is_primary?: boolean
}

export type CustomerContact = {
  contact_id: number
  customer_id: number
  full_name: string
  role_title: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
}

export type CustomerRead = {
  customer_id: number
  code: string
  business_name: string
  customer_type: string
  locality: string
  payment_terms_days: number
  credit_limit: string | null
  currency: string
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type CustomerDetail = CustomerRead & {
  tax_data: CustomerTaxData[]
  addresses: CustomerAddress[]
  contacts: CustomerContact[]
}

export type CustomerListResponse = {
  total: number
  items: CustomerRead[]
}

export type CustomerCreate = {
  code: string
  business_name: string
  customer_type?: string
  locality?: string
  payment_terms_days?: number
  credit_limit?: number | null
  currency?: string
  notes?: string | null
}

export type CustomerUpdate = {
  business_name?: string
  customer_type?: string
  locality?: string
  payment_terms_days?: number
  credit_limit?: number | null
  currency?: string
  is_active?: boolean
  notes?: string | null
}

export type CustomerTaxDataCreate = {
  rfc: string
  legal_name: string
  tax_regime_id?: number | null
  cfdi_use_id?: string | null
  zip_code: string
  is_default?: boolean
}

// ─── Proveedores ───────────────────────────────────────────────────────────

export type SupplierTaxData = {
  tax_data_id: number
  supplier_id: number
  rfc: string
  legal_name: string
  tax_regime_id: number | null
  zip_code: string
  is_default: boolean
}

export type SupplierAddress = {
  address_id: number
  supplier_id: number
  address_type: string
  tax_data_id: number | null
  label: string | null
  street: string
  exterior_number: string | null
  interior_number: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  country: string
  zip_code: string | null
  is_default: boolean
}

export type SupplierAddressCreate = {
  address_type: "PICKUP" | "OTHER"
  label?: string | null
  street: string
  exterior_number?: string | null
  interior_number?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  country?: string
  zip_code?: string | null
  is_default?: boolean
}

export type SupplierContactCreate = {
  full_name: string
  role_title?: string | null
  email?: string | null
  phone?: string | null
  is_primary?: boolean
}

export type SupplierContact = {
  contact_id: number
  supplier_id: number
  full_name: string
  role_title: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
}

export type SupplierProduct = {
  supplier_product_id: number
  supplier_id: number
  product_id: string | null
  supplier_sku: string | null
  unit_cost: string
  currency: string
  lead_time_days: number | null
  moq: string | null
  is_available: boolean
  is_preferred: boolean
  valid_from: string
  valid_to: string | null
  is_current: boolean
  created_at: string
}

export type SupplierRead = {
  supplier_id: number
  code: string
  business_name: string
  supplier_type: string
  locality: string
  is_occasional: boolean
  payment_terms_days: number
  avg_payment_time_days: number | null
  currency: string
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type SupplierDetail = SupplierRead & {
  tax_data: SupplierTaxData[]
  addresses: SupplierAddress[]
  contacts: SupplierContact[]
  current_products: SupplierProduct[]
}

export type SupplierListResponse = {
  total: number
  items: SupplierRead[]
}

export type CatalogoItem = {
  supplier_product_id: number
  supplier_id: number
  supplier_code: string
  supplier_name: string
  supplier_sku: string | null
  product_id: string | null
  product_name: string | null
  product_sku: string | null
  unit_cost: string
  currency: string
  lead_time_days: number | null
  moq: string | null
  is_available: boolean
  is_preferred: boolean
  valid_from: string
}

export type CatalogoListResponse = {
  total: number
  items: CatalogoItem[]
}

export type SupplierCreate = {
  code: string
  business_name: string
  supplier_type?: string
  locality?: string
  is_occasional?: boolean
  payment_terms_days?: number
  avg_payment_time_days?: number | null
  currency?: string
  notes?: string | null
}

export type SupplierUpdate = {
  business_name?: string
  supplier_type?: string
  locality?: string
  is_occasional?: boolean
  payment_terms_days?: number
  avg_payment_time_days?: number | null
  currency?: string
  is_active?: boolean
  notes?: string | null
}

export type SupplierTaxDataCreate = {
  rfc: string
  legal_name: string
  tax_regime_id?: number | null
  zip_code: string
  is_default?: boolean
}

export type SupplierProductCreate = {
  product_id?: string | null
  supplier_sku?: string | null
  unit_cost: number
  currency?: string
  lead_time_days?: number | null
  moq?: number | null
  is_available?: boolean
  is_preferred?: boolean
  valid_from?: string | null
}

export type SupplierProductPriceUpdate = {
  unit_cost: number
  currency?: string | null
  supplier_sku?: string | null
  lead_time_days?: number | null
  moq?: number | null
  is_preferred?: boolean | null
}
