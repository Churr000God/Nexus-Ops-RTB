import { requestJson } from "@/lib/http"
import type {
  AdjustmentCreate,
  AssetAssignment,
  AssetComponentDetail,
  AssetComponentHistoryItem,
  AssetCreate,
  AssetRead,
  AssetUpdate,
  AssignAssetPayload,
  DepreciationConfigCreate,
  DepreciationScheduleRead,
  InstallComponentPayload,
  InventoryCurrentItem,
  InventoryKpiV2,
  InventoryMovementRead,
  PhysicalCountCreate,
  PhysicalCountLineRead,
  PhysicalCountLineUpdate,
  PhysicalCountRead,
  ProductCountLineRead,
  ProductCountLineUpdate,
  RemoveComponentPayload,
  RetireAssetPayload,
  WorkOrderCreate,
  WorkOrderRead,
  WorkOrderUpdate,
} from "@/types/assets"

function withQuery(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
): string {
  if (!params) return path
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue
    usp.set(key, String(value))
  }
  const qs = usp.toString()
  return qs ? `${path}?${qs}` : path
}

export const assetsService = {
  // ── Inventario v2 ────────────────────────────────────────────────────────

  getKpisV2(token: string | null, signal?: AbortSignal): Promise<InventoryKpiV2> {
    return requestJson("/api/inventario/kpis-v2", { token, signal })
  },

  getVendible(
    token: string | null,
    params: {
      stock_status?: string
      search?: string
      category?: string
      sort_by?: string
      sort_order?: string
      limit?: number
      offset?: number
    } = {},
    signal?: AbortSignal,
  ): Promise<InventoryCurrentItem[]> {
    return requestJson(withQuery("/api/inventario/vendible", params), { token, signal })
  },

  getInterno(
    token: string | null,
    params: {
      stock_status?: string
      search?: string
      category?: string
      sort_by?: string
      sort_order?: string
      limit?: number
      offset?: number
    } = {},
    signal?: AbortSignal,
  ): Promise<InventoryCurrentItem[]> {
    return requestJson(withQuery("/api/inventario/interno", params), { token, signal })
  },

  // ── Assets ───────────────────────────────────────────────────────────────

  listAssets(
    token: string | null,
    params: {
      status?: string
      asset_type?: string
      location?: string
      search?: string
      limit?: number
      offset?: number
    } = {},
    signal?: AbortSignal,
  ): Promise<AssetRead[]> {
    return requestJson(withQuery("/api/assets", params), { token, signal })
  },

  getChildren(token: string | null, assetId: string, signal?: AbortSignal): Promise<AssetRead[]> {
    return requestJson(`/api/assets/${assetId}/children`, { token, signal })
  },

  getAsset(token: string | null, id: string, signal?: AbortSignal): Promise<AssetRead> {
    return requestJson(`/api/assets/${id}`, { token, signal })
  },

  createAsset(token: string | null, data: AssetCreate): Promise<AssetRead> {
    return requestJson("/api/assets", { method: "POST", body: data as never, token })
  },

  updateAsset(token: string | null, id: string, data: AssetUpdate): Promise<AssetRead> {
    return requestJson(`/api/assets/${id}`, { method: "PATCH", body: data as never, token })
  },

  installComponent(
    token: string | null,
    assetId: string,
    data: InstallComponentPayload,
  ): Promise<AssetComponentDetail> {
    return requestJson(`/api/assets/${assetId}/components`, {
      method: "POST",
      body: data as never,
      token,
    })
  },

  removeComponent(
    token: string | null,
    assetId: string,
    componentId: string,
    data: RemoveComponentPayload,
  ): Promise<void> {
    return requestJson(`/api/assets/${assetId}/components/${componentId}/remove`, {
      method: "POST",
      body: data as never,
      token,
    })
  },

  getComponents(token: string | null, assetId: string, signal?: AbortSignal): Promise<AssetComponentDetail[]> {
    return requestJson(`/api/assets/${assetId}/components`, { token, signal })
  },

  getHistory(
    token: string | null,
    assetId: string,
    params: { limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ): Promise<AssetComponentHistoryItem[]> {
    return requestJson(withQuery(`/api/assets/${assetId}/history`, params), { token, signal })
  },

  getAssignments(
    token: string | null,
    assetId: string,
    params: { limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ): Promise<AssetAssignment[]> {
    return requestJson(withQuery(`/api/assets/${assetId}/assignments`, params), { token, signal })
  },

  assignAsset(
    token: string | null,
    assetId: string,
    data: AssignAssetPayload,
  ): Promise<AssetAssignment> {
    return requestJson(`/api/assets/${assetId}/assign`, {
      method: "POST",
      body: data as never,
      token,
    })
  },

  retireAsset(
    token: string | null,
    assetId: string,
    data: RetireAssetPayload,
  ): Promise<AssetRead> {
    return requestJson(`/api/assets/${assetId}/retire`, {
      method: "POST",
      body: data as never,
      token,
    })
  },

  // ── Conteos Físicos ──────────────────────────────────────────────────────

  createCount(token: string | null, data: PhysicalCountCreate): Promise<PhysicalCountRead> {
    return requestJson("/api/assets/counts", { method: "POST", body: data as never, token })
  },

  listCounts(
    token: string | null,
    params: { status?: string; limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ): Promise<PhysicalCountRead[]> {
    return requestJson(withQuery("/api/assets/counts", params), { token, signal })
  },

  getCountLines(
    token: string | null,
    countId: string,
    signal?: AbortSignal,
  ): Promise<PhysicalCountLineRead[]> {
    return requestJson(`/api/assets/counts/${countId}/lines`, { token, signal })
  },

  updateCountLine(
    token: string | null,
    countId: string,
    lineId: string,
    data: PhysicalCountLineUpdate,
  ): Promise<PhysicalCountLineRead> {
    return requestJson(`/api/assets/counts/${countId}/lines/${lineId}`, {
      method: "PATCH",
      body: data as never,
      token,
    })
  },

  confirmCount(token: string | null, countId: string): Promise<PhysicalCountRead> {
    return requestJson(`/api/assets/counts/${countId}/confirm`, { method: "POST", token })
  },

  getProductCountLines(
    token: string | null,
    countId: string,
    params: { search?: string; is_saleable?: boolean } = {},
    signal?: AbortSignal,
  ): Promise<ProductCountLineRead[]> {
    return requestJson(withQuery(`/api/assets/counts/${countId}/product-lines`, params), { token, signal })
  },

  updateProductCountLine(
    token: string | null,
    countId: string,
    lineId: string,
    data: ProductCountLineUpdate,
  ): Promise<ProductCountLineRead> {
    return requestJson(`/api/assets/counts/${countId}/product-lines/${lineId}`, {
      method: "PATCH",
      body: data as never,
      token,
    })
  },

  // ── Órdenes de Mantenimiento ─────────────────────────────────────────────

  createWorkOrder(token: string | null, assetId: string, data: WorkOrderCreate): Promise<WorkOrderRead> {
    return requestJson(`/api/assets/${assetId}/work-orders`, {
      method: "POST",
      body: data as never,
      token,
    })
  },

  listWorkOrders(
    token: string | null,
    assetId: string,
    params: { status?: string; limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ): Promise<WorkOrderRead[]> {
    return requestJson(withQuery(`/api/assets/${assetId}/work-orders`, params), { token, signal })
  },

  updateWorkOrder(
    token: string | null,
    assetId: string,
    woId: string,
    data: WorkOrderUpdate,
  ): Promise<WorkOrderRead> {
    return requestJson(`/api/assets/${assetId}/work-orders/${woId}`, {
      method: "PATCH",
      body: data as never,
      token,
    })
  },

  // ── Depreciación ─────────────────────────────────────────────────────────

  getDepreciation(
    token: string | null,
    assetId: string,
    signal?: AbortSignal,
  ): Promise<DepreciationScheduleRead> {
    return requestJson(`/api/assets/${assetId}/depreciation`, { token, signal })
  },

  upsertDepreciation(
    token: string | null,
    assetId: string,
    data: DepreciationConfigCreate,
  ): Promise<DepreciationScheduleRead> {
    return requestJson(`/api/assets/${assetId}/depreciation`, {
      method: "POST",
      body: data as never,
      token,
    })
  },

  // ── Movimientos de inventario ─────────────────────────────────────────────

  listMovements(
    token: string | null,
    params: {
      product_id?: string
      movement_type?: string
      search?: string
      date_from?: string
      date_to?: string
      limit?: number
      offset?: number
    } = {},
    signal?: AbortSignal,
  ): Promise<InventoryMovementRead[]> {
    return requestJson(withQuery("/api/inventario/movimientos", params), { token, signal })
  },

  createAdjustment(
    token: string | null,
    data: AdjustmentCreate,
  ): Promise<InventoryMovementRead> {
    return requestJson("/api/inventario/ajustes", { method: "POST", body: data as never, token })
  },
}
