export type InventoryCurrentItem = {
  product_id: string
  sku: string | null
  name: string
  is_saleable: boolean
  category: string | null
  quantity_on_hand: number
  theoretical_qty: number | null
  avg_unit_cost: number | null
  total_value: number | null
  theoretical_value: number | null
  min_stock: number | null
  stock_status: "OK" | "BELOW_MIN" | "OUT" | null
}

export type InventoryKpiV2 = {
  total_productos: number
  valor_total_real: number
  valor_total_vendible: number
  valor_total_interno: number
  productos_out_of_stock: number
  productos_below_min: number
  productos_out_of_stock_vendible: number
  productos_below_min_vendible: number
  productos_out_of_stock_interno: number
  productos_below_min_interno: number
  total_assets: number
  assets_en_reparacion: number
  total_vendible: number
  total_interno: number
  con_stock_vendible: number
  sin_stock_vendible: number
  stock_negativo_vendible: number
  con_stock_interno: number
  sin_stock_interno: number
  stock_negativo_interno: number
}

export type AssetCreate = {
  asset_code: string
  asset_type: string
  name: string
  base_product_id?: string | null
  serial_number?: string | null
  manufacturer?: string | null
  model?: string | null
  location?: string | null
  assigned_user_id?: string | null
  parent_asset_id?: string | null
  status?: string
  purchase_date?: string | null
  purchase_cost?: number | null
  warranty_until?: string | null
  notes?: string | null
}

export type AssetUpdate = {
  asset_type?: string | null
  name?: string | null
  serial_number?: string | null
  manufacturer?: string | null
  model?: string | null
  location?: string | null
  assigned_user_id?: string | null
  parent_asset_id?: string | null
  status?: string | null
  purchase_date?: string | null
  purchase_cost?: number | null
  warranty_until?: string | null
  notes?: string | null
}

export type InstallComponentPayload = {
  product_id?: string | null
  quantity?: number
  serial_number?: string | null
  notes?: string | null
}

export type RemoveComponentPayload = {
  is_reusable: boolean
  reason?: string | null
  notes?: string | null
}

export type AssetRead = {
  id: string
  asset_code: string
  asset_type: string
  name: string
  base_product_id: string | null
  serial_number: string | null
  manufacturer: string | null
  model: string | null
  location: string | null
  assigned_user_id: string | null
  parent_asset_id: string | null
  status: string
  purchase_date: string | null
  purchase_cost: number | null
  warranty_until: string | null
  notes: string | null
  retired_at: string | null
  retirement_reason: string | null
  salvage_value: number | null
  retired_by: string | null
  created_at: string
  updated_at: string
}

export type RetireAssetPayload = {
  retirement_reason?: string | null
  salvage_value?: number | null
}

export type AssetComponentDetail = {
  asset_component_id: string
  product_id: string | null
  component_sku: string | null
  component_name: string | null
  quantity: number
  serial_number: string | null
  installed_at: string
  installed_by_email: string | null
  notes: string | null
}

export type AssetAssignment = {
  id: string
  asset_id: string
  user_id: string | null
  user_email: string | null
  user_name: string | null
  location: string | null
  assigned_at: string
  assigned_by_email: string | null
  notes: string | null
}

export type AssignAssetPayload = {
  user_id?: string | null
  location?: string | null
  notes?: string | null
}

export type WorkOrderRead = {
  id: string
  asset_id: string
  title: string
  description: string | null
  work_type: "PREVENTIVE" | "CORRECTIVE" | "INSPECTION" | "UPGRADE"
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED"
  assigned_to: string | null
  assigned_to_email: string | null
  scheduled_date: string | null
  started_at: string | null
  completed_at: string | null
  cost: number | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type WorkOrderCreate = {
  title: string
  description?: string | null
  work_type?: string
  priority?: string
  scheduled_date?: string | null
  cost?: number | null
  notes?: string | null
}

export type WorkOrderUpdate = {
  title?: string | null
  description?: string | null
  work_type?: string | null
  priority?: string | null
  status?: string | null
  scheduled_date?: string | null
  started_at?: string | null
  completed_at?: string | null
  cost?: number | null
  notes?: string | null
}

export type PhysicalCountRead = {
  id: string
  count_date: string
  count_type: "ASSET" | "PRODUCT"
  location_filter: string | null
  status: "DRAFT" | "CONFIRMED" | "CANCELLED"
  notes: string | null
  created_by: string | null
  created_at: string
  confirmed_at: string | null
  confirmed_by: string | null
  total_lines: number
  // ASSET stats
  found_count: number
  not_found_count: number
  pending_count: number
  // PRODUCT stats
  counted_lines: number
  discrepancy_lines: number
  uncounted_lines: number
}

export type PhysicalCountCreate = {
  count_date: string
  count_type?: "ASSET" | "PRODUCT"
  location_filter?: string | null
  notes?: string | null
}

export type PhysicalCountLineRead = {
  id: string
  count_id: string
  asset_id: string
  asset_code: string
  asset_name: string
  expected_location: string | null
  scanned_location: string | null
  found: boolean | null
  notes: string | null
  updated_by: string | null
  updated_at: string | null
  updated_by_email: string | null
}

export type PhysicalCountLineUpdate = {
  found?: boolean | null
  scanned_location?: string | null
  notes?: string | null
}

export type ProductCountLineRead = {
  id: string
  count_id: string
  product_id: string | null
  sku: string | null
  product_name: string
  is_saleable: boolean
  category: string | null
  theoretical_qty: number | null
  real_qty: number
  counted_qty: number | null
  notes: string | null
  updated_by: string | null
  updated_at: string | null
  updated_by_email: string | null
}

export type ProductCountLineUpdate = {
  counted_qty?: number | null
  notes?: string | null
}

export type InventoryMovementRead = {
  id: string
  movement_number: string | null
  product_id: string | null
  product_sku: string | null
  product_name: string | null
  movement_type: string | null
  qty_in: number | null
  qty_out: number | null
  qty_nonconformity: number | null
  unit_cost: number | null
  moved_on: string | null
  origin: string | null
  destination: string | null
  observations: string | null
  created_by_email: string | null
  created_at: string
}

export type AdjustmentCreate = {
  product_id: string
  direction: "in" | "out"
  quantity: number
  unit_cost?: number | null
  observations: string
  moved_on?: string | null
}

export type AssetComponentHistoryItem = {
  history_id: string
  occurred_at: string
  operation: "INSTALL" | "REMOVE" | "REPLACE"
  component_sku: string | null
  component_name: string | null
  quantity: number | null
  serial_number: string | null
  performed_by: string | null
  reason: string | null
  notes: string | null
  inventory_movement_id: string | null
  nc_id: string | null
}

export type DepreciationConfigRead = {
  id: string
  asset_id: string
  method: "STRAIGHT_LINE"
  useful_life_years: number
  residual_value: number
  start_date: string
  created_at: string
  updated_at: string
}

export type DepreciationConfigCreate = {
  method?: "STRAIGHT_LINE"
  useful_life_years: number
  residual_value?: number
  start_date: string
}

export type DepreciationPeriodRead = {
  year: number
  period_start: string
  period_end: string
  annual_depreciation: number
  accumulated_depreciation: number
  book_value: number
  is_current: boolean
}

export type DepreciationScheduleRead = {
  config: DepreciationConfigRead | null
  asset_cost: number | null
  current_book_value: number | null
  accumulated_depreciation: number | null
  percent_depreciated: number | null
  periods: DepreciationPeriodRead[]
}
