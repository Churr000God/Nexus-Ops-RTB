import { requestJson } from "@/lib/http"
import type {
  CfdiCancelIn,
  CfdiCancelResponse,
  CfdiCreateIn,
  CfdiIssuerConfigIn,
  CfdiIssuerConfigOut,
  CfdiListItem,
  CfdiOut,
  CfdiPacLogOut,
  CfdiPpdPending,
  CfdiSeriesIn,
  CfdiSeriesOut,
  CfdiSeriesUpdate,
  CfdiStampResponse,
} from "@/types/cfdi"

const BASE = "/api/cfdi"

// ── Issuer Config ────────────────────────────────────────────────────────────

export function getIssuerConfig(token: string | null, signal?: AbortSignal): Promise<CfdiIssuerConfigOut | null> {
  return requestJson(`${BASE}/issuer-config`, { token, signal })
}

export function saveIssuerConfig(token: string | null, body: CfdiIssuerConfigIn): Promise<CfdiIssuerConfigOut> {
  return requestJson(`${BASE}/issuer-config`, { method: "POST", body: body as never, token })
}

// ── Series ───────────────────────────────────────────────────────────────────

export function getSeries(token: string | null, activeOnly = true, signal?: AbortSignal): Promise<CfdiSeriesOut[]> {
  const q = new URLSearchParams({ active_only: String(activeOnly) })
  return requestJson(`${BASE}/series?${q}`, { token, signal })
}

export function createSeries(token: string | null, body: CfdiSeriesIn): Promise<CfdiSeriesOut> {
  return requestJson(`${BASE}/series`, { method: "POST", body: body as never, token })
}

export function updateSeries(token: string | null, seriesId: number, body: CfdiSeriesUpdate): Promise<CfdiSeriesOut> {
  return requestJson(`${BASE}/series/${seriesId}`, { method: "PATCH", body: body as never, token })
}

// ── CFDIs ────────────────────────────────────────────────────────────────────

export function getCfdis(
  params: {
    cfdi_type?: string
    status?: string
    customer_id?: number
    limit?: number
    offset?: number
  } = {},
  signal?: AbortSignal,
): Promise<CfdiListItem[]> {
  const q = new URLSearchParams()
  if (params.cfdi_type) q.set("cfdi_type", params.cfdi_type)
  if (params.status) q.set("status", params.status)
  if (params.customer_id) q.set("customer_id", String(params.customer_id))
  if (params.limit) q.set("limit", String(params.limit))
  if (params.offset) q.set("offset", String(params.offset))
  return requestJson(`${BASE}?${q}`, { signal })
}

export function getCfdi(id: number, signal?: AbortSignal): Promise<CfdiOut> {
  return requestJson(`${BASE}/${id}`, { signal })
}

export function createCfdi(body: CfdiCreateIn): Promise<CfdiOut> {
  return requestJson(BASE, { method: "POST", body: JSON.stringify(body) })
}

// ── Timbrar / Cancelar ───────────────────────────────────────────────────────

export function stampCfdi(id: number): Promise<CfdiStampResponse> {
  return requestJson(`${BASE}/${id}/stamp`, { method: "POST" })
}

export function cancelCfdi(id: number, body: CfdiCancelIn): Promise<CfdiCancelResponse> {
  return requestJson(`${BASE}/${id}/cancel`, { method: "POST", body: JSON.stringify(body) })
}

// ── PPD Pendientes ───────────────────────────────────────────────────────────

export function getPpdPending(signal?: AbortSignal): Promise<CfdiPpdPending[]> {
  return requestJson(`${BASE}/ppd-pending`, { signal })
}

// ── PAC Log ──────────────────────────────────────────────────────────────────

export function getPacLog(
  cfdiId: number,
  limit = 50,
  signal?: AbortSignal,
): Promise<CfdiPacLogOut[]> {
  const q = new URLSearchParams({ limit: String(limit) })
  return requestJson(`${BASE}/${cfdiId}/pac-log?${q}`, { signal })
}
