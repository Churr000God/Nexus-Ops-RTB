import { requestJson } from "@/lib/http"
import type {
  AssetComponentDetail,
  AssetComponentHistoryItem,
  AssetRead,
  InventoryCurrentItem,
  InventoryKpiV2,
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
      limit?: number
      offset?: number
    } = {},
    signal?: AbortSignal,
  ): Promise<AssetRead[]> {
    return requestJson(withQuery("/api/assets", params), { token, signal })
  },

  getAsset(token: string | null, id: string, signal?: AbortSignal): Promise<AssetRead> {
    return requestJson(`/api/assets/${id}`, { token, signal })
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
}
