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

  getKpisV2(signal?: AbortSignal): Promise<InventoryKpiV2> {
    return requestJson("/api/inventario/kpis-v2", { signal })
  },

  getVendible(
    params: { stock_status?: string; limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ): Promise<InventoryCurrentItem[]> {
    return requestJson(withQuery("/api/inventario/vendible", params), { signal })
  },

  getInterno(
    params: { stock_status?: string; limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ): Promise<InventoryCurrentItem[]> {
    return requestJson(withQuery("/api/inventario/interno", params), { signal })
  },

  // ── Assets ───────────────────────────────────────────────────────────────

  listAssets(
    params: {
      status?: string
      asset_type?: string
      location?: string
      limit?: number
      offset?: number
    } = {},
    signal?: AbortSignal,
  ): Promise<AssetRead[]> {
    return requestJson(withQuery("/api/assets", params), { signal })
  },

  getAsset(id: string, signal?: AbortSignal): Promise<AssetRead> {
    return requestJson(`/api/assets/${id}`, { signal })
  },

  getComponents(assetId: string, signal?: AbortSignal): Promise<AssetComponentDetail[]> {
    return requestJson(`/api/assets/${assetId}/components`, { signal })
  },

  getHistory(
    assetId: string,
    params: { limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ): Promise<AssetComponentHistoryItem[]> {
    return requestJson(withQuery(`/api/assets/${assetId}/history`, params), { signal })
  },
}
