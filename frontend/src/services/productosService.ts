import { requestJson } from "@/lib/http"
import type {
  BrandRead,
  CategoryRead,
  ProductCreate,
  ProductListResponse,
  ProductRead,
  ProductUpdate,
} from "@/types/productos"

export interface ProductListParams {
  limit?: number
  offset?: number
  search?: string
  solo_activos?: boolean
  category_id?: string
  brand_id?: string
}

export const productosService = {
  listProducts(token: string | null, params: ProductListParams = {}, signal?: AbortSignal) {
    const qs = new URLSearchParams()
    if (params.limit != null) qs.set("limit", String(params.limit))
    if (params.offset != null) qs.set("offset", String(params.offset))
    if (params.search) qs.set("search", params.search)
    if (params.solo_activos != null) qs.set("solo_activos", String(params.solo_activos))
    if (params.category_id) qs.set("category_id", params.category_id)
    if (params.brand_id) qs.set("brand_id", params.brand_id)
    const query = qs.toString()
    return requestJson<ProductListResponse>(
      `/api/productos${query ? `?${query}` : ""}`,
      { token, signal },
    )
  },

  getProduct(token: string | null, id: string, signal?: AbortSignal) {
    return requestJson<ProductRead>(`/api/productos/${id}`, { token, signal })
  },

  createProduct(token: string | null, data: ProductCreate) {
    return requestJson<ProductRead>("/api/productos", { method: "POST", body: data, token })
  },

  updateProduct(token: string | null, id: string, data: ProductUpdate) {
    return requestJson<ProductRead>(`/api/productos/${id}`, { method: "PATCH", body: data, token })
  },

  deleteProduct(token: string | null, id: string) {
    return requestJson<void>(`/api/productos/${id}`, { method: "DELETE", token })
  },

  listCategories(token: string | null, signal?: AbortSignal) {
    return requestJson<CategoryRead[]>("/api/categorias", { token, signal })
  },

  listBrands(token: string | null, signal?: AbortSignal) {
    return requestJson<BrandRead[]>("/api/marcas", { token, signal })
  },
}
