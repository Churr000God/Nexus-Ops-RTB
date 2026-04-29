export interface ProductRead {
  id: string
  sku: string | null
  internal_code: string | null
  name: string
  description: string | null
  brand_id: string | null
  brand: string | null
  category_id: string | null
  category: string | null
  status: string | null
  sale_type: string | null
  package_size: number | null
  warehouse_location: string | null
  image_url: string | null
  datasheet_url: string | null
  unit_price: number | null
  unit_price_base: number | null
  purchase_cost_parts: number | null
  purchase_cost_ariba: number | null
  is_configurable: boolean
  is_assembled: boolean
  pricing_strategy: string
  moving_avg_months: number
  current_avg_cost: number | null
  current_avg_cost_currency: string
  current_avg_cost_updated_at: string | null
  suggested_price: number | null
  is_active: boolean | null
  min_stock: number | null
  theoretical_outflow: number | null
  real_outflow: number | null
  demand_90_days: number | null
  demand_180_days: number | null
  total_accumulated_sales: number | null
  last_outbound_date: string | null
  sat_product_key_id: string | null
  sat_unit_id: string | null
  created_at: string
  updated_at: string
}

export interface ProductListResponse {
  total: number
  items: ProductRead[]
}

export type ProductCreate = {
  sku: string
  internal_code?: string | null
  name: string
  description?: string | null
  brand_id?: string | null
  category_id?: string | null
  status?: string | null
  sale_type?: string | null
  package_size?: number | null
  warehouse_location?: string | null
  image_url?: string | null
  datasheet_url?: string | null
  unit_price?: number | null
  purchase_cost_parts?: number | null
  purchase_cost_ariba?: number | null
  is_configurable?: boolean
  is_assembled?: boolean
  pricing_strategy?: string
  moving_avg_months?: number
}

export type ProductUpdate = {
  name?: string | null
  description?: string | null
  brand_id?: string | null
  category_id?: string | null
  status?: string | null
  sale_type?: string | null
  package_size?: number | null
  warehouse_location?: string | null
  image_url?: string | null
  datasheet_url?: string | null
  unit_price?: number | null
  purchase_cost_parts?: number | null
  purchase_cost_ariba?: number | null
  is_configurable?: boolean | null
  is_assembled?: boolean | null
  pricing_strategy?: string | null
  moving_avg_months?: number | null
  is_active?: boolean | null
}

export interface CategoryRead {
  id: string
  parent_id: string | null
  name: string
  slug: string | null
  description: string | null
  profit_margin_percent: number | null
  is_active: boolean
  children: CategoryRead[]
}

export interface BrandRead {
  id: string
  name: string
  description: string | null
  is_active: boolean
}
