export type InventarioKpi = {
  total_productos: number
  con_stock_positivo: number
  sin_stock: number
  stock_negativo: number
  monto_total_real: number
  monto_total_teorico: number
}

export type InventarioProducto = {
  internal_code: string | null
  sku: string | null
  name: string
  costo_unitario: number | null
  stock_real: number
  stock_teorico: number
  monto_real: number
  monto_teorico: number
  abc_classification: string | null
}
