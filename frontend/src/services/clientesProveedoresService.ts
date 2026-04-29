import { requestJson } from "@/lib/http"
import type {
  CustomerContact,
  CustomerCreate,
  CustomerDetail,
  CustomerListResponse,
  CustomerRead,
  CustomerTaxData,
  CustomerTaxDataCreate,
  CustomerUpdate,
  SATCfdiUse,
  SATProductKey,
  SATTaxRegime,
  SATUnitKey,
  SupplierContact,
  SupplierCreate,
  SupplierDetail,
  SupplierListResponse,
  SupplierProduct,
  SupplierProductCreate,
  SupplierProductPriceUpdate,
  SupplierRead,
  SupplierTaxData,
  SupplierTaxDataCreate,
  SupplierUpdate,
} from "@/types/clientesProveedores"

export type CustomerListParams = {
  limit?: number
  offset?: number
  search?: string
  solo_activos?: boolean
}

export type SupplierListParams = {
  limit?: number
  offset?: number
  search?: string
  solo_activos?: boolean
  supplier_type?: string
  locality?: string
  is_occasional?: boolean
}

export const clientesProveedoresService = {
  listRegimenesFiscales(token: string | null, signal?: AbortSignal) {
    return requestJson<SATTaxRegime[]>("/api/sat/regimenes-fiscales", { token, signal })
  },

  listUsosCfdi(token: string | null, signal?: AbortSignal) {
    return requestJson<SATCfdiUse[]>("/api/sat/usos-cfdi", { token, signal })
  },

  searchSatProductKeys(token: string | null, q: string, limit = 100, signal?: AbortSignal) {
    const qs = new URLSearchParams({ q, limit: String(limit) })
    return requestJson<SATProductKey[]>(`/api/sat/claves-producto?${qs}`, { token, signal })
  },

  searchSatUnitKeys(token: string | null, q: string, limit = 100, signal?: AbortSignal) {
    const qs = new URLSearchParams({ q, limit: String(limit) })
    return requestJson<SATUnitKey[]>(`/api/sat/claves-unidad?${qs}`, { token, signal })
  },

  // ─── Clientes ──────────────────────────────────────────────────────────

  listCustomers(token: string | null, params: CustomerListParams = {}, signal?: AbortSignal) {
    const qs = new URLSearchParams()
    if (params.limit != null) qs.set("limit", String(params.limit))
    if (params.offset != null) qs.set("offset", String(params.offset))
    if (params.search) qs.set("search", params.search)
    if (params.solo_activos != null) qs.set("solo_activos", String(params.solo_activos))
    const query = qs.toString()
    return requestJson<CustomerListResponse>(
      `/api/clientes${query ? `?${query}` : ""}`,
      { token, signal }
    )
  },

  getCustomer(token: string | null, customerId: number, signal?: AbortSignal) {
    return requestJson<CustomerDetail>(`/api/clientes/${customerId}`, { token, signal })
  },

  createCustomer(token: string | null, data: CustomerCreate) {
    return requestJson<CustomerRead>("/api/clientes", { method: "POST", body: data, token })
  },

  updateCustomer(token: string | null, customerId: number, data: CustomerUpdate) {
    return requestJson<CustomerRead>(`/api/clientes/${customerId}`, {
      method: "PATCH",
      body: data,
      token,
    })
  },

  addCustomerTaxData(token: string | null, customerId: number, data: CustomerTaxDataCreate) {
    return requestJson<CustomerTaxData>(`/api/clientes/${customerId}/tax-data`, {
      method: "POST",
      body: data,
      token,
    })
  },

  updateCustomerTaxData(
    token: string | null,
    customerId: number,
    taxDataId: number,
    data: CustomerTaxDataCreate
  ) {
    return requestJson<CustomerTaxData>(`/api/clientes/${customerId}/tax-data/${taxDataId}`, {
      method: "PUT",
      body: data,
      token,
    })
  },

  addCustomerContact(
    token: string | null,
    customerId: number,
    data: {
      full_name: string
      role_title?: string | null
      email?: string | null
      phone?: string | null
      is_primary?: boolean
    }
  ) {
    return requestJson<CustomerContact>(`/api/clientes/${customerId}/contacts`, {
      method: "POST",
      body: data,
      token,
    })
  },

  deleteCustomerContact(token: string | null, customerId: number, contactId: number) {
    return requestJson<void>(`/api/clientes/${customerId}/contacts/${contactId}`, {
      method: "DELETE",
      token,
    })
  },

  // ─── Proveedores ────────────────────────────────────────────────────────

  listSuppliers(token: string | null, params: SupplierListParams = {}, signal?: AbortSignal) {
    const qs = new URLSearchParams()
    if (params.limit != null) qs.set("limit", String(params.limit))
    if (params.offset != null) qs.set("offset", String(params.offset))
    if (params.search) qs.set("search", params.search)
    if (params.solo_activos != null) qs.set("solo_activos", String(params.solo_activos))
    if (params.supplier_type) qs.set("supplier_type", params.supplier_type)
    if (params.locality) qs.set("locality", params.locality)
    if (params.is_occasional != null) qs.set("is_occasional", String(params.is_occasional))
    const query = qs.toString()
    return requestJson<SupplierListResponse>(
      `/api/proveedores${query ? `?${query}` : ""}`,
      { token, signal }
    )
  },

  getSupplier(token: string | null, supplierId: number, signal?: AbortSignal) {
    return requestJson<SupplierDetail>(`/api/proveedores/${supplierId}`, { token, signal })
  },

  createSupplier(token: string | null, data: SupplierCreate) {
    return requestJson<SupplierRead>("/api/proveedores", { method: "POST", body: data, token })
  },

  updateSupplier(token: string | null, supplierId: number, data: SupplierUpdate) {
    return requestJson<SupplierRead>(`/api/proveedores/${supplierId}`, {
      method: "PATCH",
      body: data,
      token,
    })
  },

  addSupplierTaxData(token: string | null, supplierId: number, data: SupplierTaxDataCreate) {
    return requestJson<SupplierTaxData>(`/api/proveedores/${supplierId}/tax-data`, {
      method: "POST",
      body: data,
      token,
    })
  },

  addSupplierContact(
    token: string | null,
    supplierId: number,
    data: {
      full_name: string
      role_title?: string | null
      email?: string | null
      phone?: string | null
      is_primary?: boolean
    }
  ) {
    return requestJson<SupplierContact>(`/api/proveedores/${supplierId}/contacts`, {
      method: "POST",
      body: data,
      token,
    })
  },

  addSupplierProduct(token: string | null, supplierId: number, data: SupplierProductCreate) {
    return requestJson<SupplierProduct>(`/api/proveedores/${supplierId}/products`, {
      method: "POST",
      body: data,
      token,
    })
  },

  updateSupplierProductPrice(
    token: string | null,
    supplierId: number,
    supplierProductId: number,
    data: SupplierProductPriceUpdate
  ) {
    return requestJson<SupplierProduct>(
      `/api/proveedores/${supplierId}/products/${supplierProductId}/price`,
      { method: "PUT", body: data, token }
    )
  },
}
