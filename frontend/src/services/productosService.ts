import { requestJson } from "@/lib/http"
import type {
  BrandCreate,
  BrandRead,
  BrandUpdate,
  CategoryCreate,
  CategoryRead,
  CategoryUpdate,
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
  is_saleable?: boolean
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
    if (params.is_saleable != null) qs.set("is_saleable", String(params.is_saleable))
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

  listCategoriesAll(token: string | null, signal?: AbortSignal) {
    return requestJson<CategoryRead[]>("/api/categorias?include_inactive=true", { token, signal })
  },

  createCategory(token: string | null, data: CategoryCreate) {
    return requestJson<CategoryRead>("/api/categorias", { method: "POST", body: data, token })
  },

  updateCategory(token: string | null, id: string, data: CategoryUpdate) {
    return requestJson<CategoryRead>(`/api/categorias/${id}`, { method: "PATCH", body: data, token })
  },

  listBrands(token: string | null, signal?: AbortSignal) {
    return requestJson<BrandRead[]>("/api/marcas", { token, signal })
  },

  listBrandsAll(token: string | null, signal?: AbortSignal) {
    return requestJson<BrandRead[]>("/api/marcas?include_inactive=true", { token, signal })
  },

  createBrand(token: string | null, data: BrandCreate) {
    return requestJson<BrandRead>("/api/marcas", { method: "POST", body: data, token })
  },

  updateBrand(token: string | null, id: string, data: BrandUpdate) {
    return requestJson<BrandRead>(`/api/marcas/${id}`, { method: "PATCH", body: data, token })
  },
}
