import { requestBlob, requestJson } from "@/lib/http"
import type { InventarioKpi, InventarioProducto } from "@/types/inventario"

function withQuery(path: string, params?: Record<string, string | number | null | undefined>) {
  if (!params) return path
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue
    usp.set(key, String(value))
  }
  const qs = usp.toString()
  return qs ? `${path}?${qs}` : path
}

export const inventarioService = {
  getKpis(token: string, signal?: AbortSignal) {
    return requestJson<InventarioKpi>("/api/inventario/kpis", { token, signal })
  },

  getProductos(
    token: string,
    params?: { limit?: number; offset?: number; solo_con_stock?: boolean },
    signal?: AbortSignal
  ) {
    return requestJson<InventarioProducto[]>(
      withQuery("/api/inventario/productos", {
        limit: params?.limit,
        offset: params?.offset,
        solo_con_stock: params?.solo_con_stock != null ? String(params.solo_con_stock) : undefined,
      }),
      { token, signal }
    )
  },


  downloadAlmacenReport(
    token: string,
    params: {
      startDate?: string | null
      endDate?: string | null
      sections: string[]
    },
    signal?: AbortSignal
  ) {
    return requestBlob(
      withQuery("/api/reportes/almacen", {
        start_date: params.startDate,
        end_date: params.endDate,
        sections: params.sections.join(","),
      }),
      { token, signal }
    )
  },

  downloadAlmacenCsv(
    token: string,
    params: {
      startDate?: string | null
      endDate?: string | null
      sections: string[]
    },
    signal?: AbortSignal
  ) {
    return requestBlob(
      withQuery("/api/reportes/almacen/csv", {
        start_date: params.startDate,
        end_date: params.endDate,
        sections: params.sections.join(","),
      }),
      { token, signal }
    )
  },

  sendAlmacenReportByEmail(
    token: string,
    body: {
      to_email: string
      start_date?: string | null
      end_date?: string | null
      sections: string[]
    }
  ) {
    return requestJson<{ message: string }>("/api/reportes/almacen/enviar-correo", {
      method: "POST",
      body: {
        to_email: body.to_email,
        start_date: body.start_date ?? null,
        end_date: body.end_date ?? null,
        sections: body.sections,
      },
      token,
    })
  },

  rebuildFromProducts(token: string) {
    return requestJson<{ created: number }>("/api/inventario/rebuild-from-products", {
      method: "POST",
      token,
    })
  },
}

