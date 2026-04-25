import { useEffect, useState } from "react"
import { AlertTriangle, ArrowLeftRight, BoxesIcon, Download, FileText, Mail, Package, TrendingUp } from "lucide-react"
import { toast } from "sonner"

import { AlmacenEmailReportModal } from "@/components/common/AlmacenEmailReportModal"
import { AlmacenReportModal } from "@/components/common/AlmacenReportModal"
import { DateRangePicker } from "@/components/common/DateRangePicker"
import { KpiCard } from "@/components/common/KpiCard"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import { useFilters } from "@/hooks/useFilters"
import { inventarioService } from "@/services/inventarioService"
import { useAuthStore } from "@/stores/authStore"
import { formatCurrencyMXN, formatNumber } from "@/lib/utils"
import type { InventarioKpi } from "@/types/inventario"

export function AlmacenDashboard() {
  const token = useAuthStore((s) => s.accessToken)
  const { datePreset, startDate, endDate, setDatePreset, setDateRange, reset } = useFilters()
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [kpis, setKpis] = useState<InventarioKpi | null>(null)
  const [loadingKpis, setLoadingKpis] = useState(true)

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    setLoadingKpis(true)
    inventarioService
      .getKpis(token, controller.signal)
      .then(setKpis)
      .catch((e) => { if (e?.name !== "AbortError") toast.error("Error al cargar KPIs de inventario") })
      .finally(() => setLoadingKpis(false))
    return () => controller.abort()
  }, [token])

  const difMonto = kpis ? kpis.monto_total_teorico - kpis.monto_total_real : 0
  const difDirection = difMonto > 0 ? "up" : difMonto < 0 ? "down" : "flat"

  return (
    <div className="space-y-6">
      <section className="surface-card border-white/70 bg-white p-5 md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge variant="success">En vivo</StatusBadge>
              <StatusBadge variant="info">Reportería conectada</StatusBadge>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-[30px]">
              Control de Inventarios y Almacén
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Monto total calculado en tiempo real: entradas de mercancía − salidas aprobadas ± ajustes de no conformes.
            </p>
          </div>

          <div className="grid gap-2 xl:min-w-[200px]">
            <Button type="button" variant="outline" onClick={() => setReportModalOpen(true)}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Reporte
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                toast.info("Generando CSV, espera un momento…")
                try {
                  const result = await inventarioService.downloadAlmacenCsv(token ?? "", {
                    startDate,
                    endDate,
                    sections: ["kpis", "valor", "alertas", "dormidos"],
                  })
                  const url = URL.createObjectURL(result.blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = result.filename
                  a.click()
                  URL.revokeObjectURL(url)
                  toast.success("CSV descargado correctamente")
                } catch {
                  toast.error("Error al descargar el CSV")
                }
              }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => setEmailModalOpen(true)}>
              <Mail className="h-4 w-4" aria-hidden="true" />
              Email
            </Button>
          </div>
        </div>
      </section>

      <DateRangePicker
        preset={datePreset}
        startDate={startDate}
        endDate={endDate}
        onPresetChange={setDatePreset}
        onRangeChange={setDateRange}
        onReset={reset}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          title="Valor Total en Stock (Real)"
          value={loadingKpis ? "—" : formatCurrencyMXN(kpis?.monto_total_real ?? 0)}
          description="Entradas − salidas aprobadas ± ajustes NC"
          icon={TrendingUp}
          tone="green"
        />
        <KpiCard
          title="Valor Total en Stock (Teórico)"
          value={loadingKpis ? "—" : formatCurrencyMXN(kpis?.monto_total_teorico ?? 0)}
          description="Cantidad solicitada − salidas teóricas ± NC"
          icon={Package}
          tone="blue"
        />
        <KpiCard
          title="Diferencia Real vs Teórico"
          value={loadingKpis ? "—" : formatCurrencyMXN(Math.abs(difMonto))}
          description={difMonto > 0 ? "Stock teórico por encima del real" : difMonto < 0 ? "Stock real por encima del teórico" : "Sin diferencia"}
          icon={ArrowLeftRight}
          tone={difDirection === "up" ? "orange" : difDirection === "down" ? "purple" : "neutral"}
          trend={
            kpis
              ? {
                  direction: difDirection,
                  label: difMonto > 0 ? "Teórico > Real" : difMonto < 0 ? "Real > Teórico" : "En equilibrio",
                }
              : undefined
          }
        />
        <KpiCard
          title="Productos con Stock"
          value={loadingKpis ? "—" : formatNumber(kpis?.con_stock_positivo ?? 0)}
          description="Con stock_real > 0 y costo unitario"
          icon={BoxesIcon}
          tone="green"
          badge={kpis ? { label: `${formatNumber(kpis.total_productos)} total`, variant: "info" } : undefined}
        />
        <KpiCard
          title="Productos sin Stock"
          value={loadingKpis ? "—" : formatNumber(kpis?.sin_stock ?? 0)}
          description="stock_real = 0"
          icon={BoxesIcon}
          tone="neutral"
        />
        <KpiCard
          title="Productos con Stock Negativo"
          value={loadingKpis ? "—" : formatNumber(kpis?.stock_negativo ?? 0)}
          description="Salidas sin entrada registrada"
          icon={AlertTriangle}
          tone="red"
          badge={kpis && kpis.stock_negativo > 0 ? { label: "Revisar", variant: "warning" } : undefined}
        />
      </div>

      <AlmacenReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        startDate={startDate}
        endDate={endDate}
      />
      <AlmacenEmailReportModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  )
}
