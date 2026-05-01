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
  status: string
  purchase_date: string | null
  purchase_cost: number | null
  warranty_until: string | null
  notes: string | null
  created_at: string
  updated_at: string
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
