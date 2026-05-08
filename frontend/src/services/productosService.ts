import { requestJson } from "@/lib/http"
import { cacheInvalidate, cacheInvalidatePrefix, CACHE_KEYS } from "@/lib/queryCache"
import type {
  AribaPriceCreate,
  AribaPricePage,
  AribaPriceRead,
  AribaPriceUpdate,
  BrandCostCreate,
  BrandCostPage,
  BrandCostRead,
  BrandCostUpdate,
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
  SkuCostLookup,
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

  async createProduct(token: string | null, data: ProductCreate) {
    const result = await requestJson<ProductRead>("/api/productos", { method: "POST", body: data, token })
    cacheInvalidatePrefix(CACHE_KEYS.PRODUCTOS)
    return result
  },

  async updateProduct(token: string | null, id: string, data: ProductUpdate) {
    const result = await requestJson<ProductRead>(`/api/productos/${id}`, { method: "PATCH", body: data, token })
    cacheInvalidatePrefix(CACHE_KEYS.PRODUCTOS)
    return result
  },

  async deleteProduct(token: string | null, id: string) {
    const result = await requestJson<void>(`/api/productos/${id}`, { method: "DELETE", token })
    cacheInvalidatePrefix(CACHE_KEYS.PRODUCTOS)
    return result
  },

  listCategories(token: string | null, signal?: AbortSignal) {
    return requestJson<CategoryRead[]>("/api/categorias", { token, signal })
  },

  listCategoriesAll(token: string | null, signal?: AbortSignal) {
    return requestJson<CategoryRead[]>("/api/categorias?include_inactive=true", { token, signal })
  },

  async createCategory(token: string | null, data: CategoryCreate) {
    const result = await requestJson<CategoryRead>("/api/categorias", { method: "POST", body: data, token })
    cacheInvalidate(CACHE_KEYS.CATEGORIAS)
    return result
  },

  async updateCategory(token: string | null, id: string, data: CategoryUpdate) {
    const result = await requestJson<CategoryRead>(`/api/categorias/${id}`, { method: "PATCH", body: data, token })
    cacheInvalidate(CACHE_KEYS.CATEGORIAS)
    return result
  },

  listBrands(token: string | null, signal?: AbortSignal) {
    return requestJson<BrandRead[]>("/api/marcas", { token, signal })
  },

  listBrandsAll(token: string | null, signal?: AbortSignal) {
    return requestJson<BrandRead[]>("/api/marcas?include_inactive=true", { token, signal })
  },

  async createBrand(token: string | null, data: BrandCreate) {
    const result = await requestJson<BrandRead>("/api/marcas", { method: "POST", body: data, token })
    cacheInvalidate(CACHE_KEYS.MARCAS)
    return result
  },

  async updateBrand(token: string | null, id: string, data: BrandUpdate) {
    const result = await requestJson<BrandRead>(`/api/marcas/${id}`, { method: "PATCH", body: data, token })
    cacheInvalidate(CACHE_KEYS.MARCAS)
    return result
  },

  lookupSkuCosts(token: string | null, sku: string, signal?: AbortSignal) {
    return requestJson<SkuCostLookup | null>(
      `/api/productos/sku-costs?sku=${encodeURIComponent(sku)}`,
      { token, signal },
    )
  },

  listAribaPrices(
    token: string | null,
    params: { search?: string; limit?: number; offset?: number; solo_activos?: boolean } = {},
    signal?: AbortSignal,
  ) {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.limit != null) qs.set("limit", String(params.limit))
    if (params.offset != null) qs.set("offset", String(params.offset))
    if (params.solo_activos != null) qs.set("solo_activos", String(params.solo_activos))
    const q = qs.toString()
    return requestJson<AribaPricePage>(
      `/api/productos/costos/ariba${q ? `?${q}` : ""}`,
      { token, signal },
    )
  },

  createAribaPrice(token: string | null, data: AribaPriceCreate) {
    return requestJson<AribaPriceRead>("/api/productos/costos/ariba", { method: "POST", body: data, token })
  },

  updateAribaPrice(token: string | null, id: string, data: AribaPriceUpdate) {
    return requestJson<AribaPriceRead>(`/api/productos/costos/ariba/${id}`, { method: "PATCH", body: data, token })
  },

  deleteAribaPrice(token: string | null, id: string) {
    return requestJson<void>(`/api/productos/costos/ariba/${id}`, { method: "DELETE", token })
  },

  listBrandCosts(
    token: string | null,
    params: { search?: string; limit?: number; offset?: number; solo_activos?: boolean } = {},
    signal?: AbortSignal,
  ) {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.limit != null) qs.set("limit", String(params.limit))
    if (params.offset != null) qs.set("offset", String(params.offset))
    if (params.solo_activos != null) qs.set("solo_activos", String(params.solo_activos))
    const q = qs.toString()
    return requestJson<BrandCostPage>(
      `/api/productos/costos/refacciones${q ? `?${q}` : ""}`,
      { token, signal },
    )
  },

  createBrandCost(token: string | null, data: BrandCostCreate) {
    return requestJson<BrandCostRead>("/api/productos/costos/refacciones", { method: "POST", body: data, token })
  },

  updateBrandCost(token: string | null, id: string, data: BrandCostUpdate) {
    return requestJson<BrandCostRead>(`/api/productos/costos/refacciones/${id}`, { method: "PATCH", body: data, token })
  },

  deleteBrandCost(token: string | null, id: string) {
    return requestJson<void>(`/api/productos/costos/refacciones/${id}`, { method: "DELETE", token })
  },
}
