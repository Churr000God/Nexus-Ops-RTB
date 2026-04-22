import JSZip from "jszip"

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return ""
  const str = String(val).replace(/"/g, '""')
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str}"`
  }
  return str
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ""
  const keys = Object.keys(rows[0])
  const lines = rows.map((row) =>
    keys.map((k) => escapeCsvCell(row[k])).join(",")
  )
  return [keys.join(","), ...lines].join("\n")
}

function safeRows(
  rows: object[] | undefined | null
): Record<string, unknown>[] {
  return (rows ?? []).map((r) => ({ ...r } as Record<string, unknown>))
}

export async function exportVentasDashboardToZip(payload: {
  summary?: object | null
  salesVsProjection?: object[] | null
  topCustomers?: object[] | null
  salesByCustomerType?: object[] | null
  productDistribution?: object[] | null
  grossMarginByProduct?: object[] | null
  quoteStatusByMonth?: object[] | null
  missingDemand?: object[] | null
  productForecast?: object[] | null
  atRiskCustomers?: object[] | null
  paymentTrend?: object[] | null
  recentQuotes?: object[] | null
  pendingPayments?: object[] | null
  productsByCustomerType?: object[] | null
  avgSalesByCustomerType?: object[] | null
  quarterlyGrowth?: object[] | null
  monthlyGrowthYoY?: object[] | null
}) {
  const zip = new JSZip()
  const dateStr = new Date().toISOString().split("T")[0]

  if (payload.summary) {
    zip.file("01-resumen.csv", rowsToCsv([{ ...payload.summary } as Record<string, unknown>]))
  }
  if (payload.salesVsProjection?.length) {
    zip.file("02-ventas-vs-proyeccion.csv", rowsToCsv(safeRows(payload.salesVsProjection)))
  }
  if (payload.topCustomers?.length) {
    zip.file("03-top-clientes.csv", rowsToCsv(safeRows(payload.topCustomers)))
  }
  if (payload.salesByCustomerType?.length) {
    zip.file(
      "04-ventas-por-tipo-cliente.csv",
      rowsToCsv(safeRows(payload.salesByCustomerType))
    )
  }
  if (payload.productDistribution?.length) {
    zip.file(
      "05-distribucion-productos.csv",
      rowsToCsv(safeRows(payload.productDistribution))
    )
  }
  if (payload.grossMarginByProduct?.length) {
    zip.file(
      "06-margen-productos.csv",
      rowsToCsv(safeRows(payload.grossMarginByProduct))
    )
  }
  if (payload.quoteStatusByMonth?.length) {
    zip.file(
      "07-estado-cotizaciones-mes.csv",
      rowsToCsv(safeRows(payload.quoteStatusByMonth))
    )
  }
  if (payload.missingDemand?.length) {
    zip.file(
      "08-demanda-faltante.csv",
      rowsToCsv(safeRows(payload.missingDemand))
    )
  }
  if (payload.productForecast?.length) {
    zip.file(
      "09-prediccion-ventas.csv",
      rowsToCsv(safeRows(payload.productForecast))
    )
  }
  if (payload.atRiskCustomers?.length) {
    zip.file(
      "10-clientes-riesgo.csv",
      rowsToCsv(safeRows(payload.atRiskCustomers))
    )
  }
  if (payload.paymentTrend?.length) {
    zip.file(
      "11-tendencia-pagos.csv",
      rowsToCsv(safeRows(payload.paymentTrend))
    )
  }
  if (payload.recentQuotes?.length) {
    zip.file(
      "12-cotizaciones-recientes.csv",
      rowsToCsv(safeRows(payload.recentQuotes))
    )
  }
  if (payload.pendingPayments?.length) {
    zip.file(
      "13-pagos-pendientes.csv",
      rowsToCsv(safeRows(payload.pendingPayments))
    )
  }
  if (payload.productsByCustomerType?.length) {
    zip.file(
      "14-productos-por-tipo-cliente.csv",
      rowsToCsv(safeRows(payload.productsByCustomerType))
    )
  }
  if (payload.avgSalesByCustomerType?.length) {
    zip.file(
      "15-venta-promedio-por-tipo-cliente.csv",
      rowsToCsv(safeRows(payload.avgSalesByCustomerType))
    )
  }
  if (payload.quarterlyGrowth?.length) {
    zip.file(
      "16-crecimiento-trimestral.csv",
      rowsToCsv(safeRows(payload.quarterlyGrowth))
    )
  }
  if (payload.monthlyGrowthYoY?.length) {
    zip.file(
      "17-crecimiento-mensual-yoy.csv",
      rowsToCsv(safeRows(payload.monthlyGrowthYoY))
    )
  }

  const blob = await zip.generateAsync({ type: "blob" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `dashboard-ventas-${dateStr}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
