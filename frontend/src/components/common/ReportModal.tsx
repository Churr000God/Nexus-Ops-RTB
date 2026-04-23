import { useEffect, useRef, useState } from "react"
import { Download, FileText, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ventasService } from "@/services/ventasService"
import { useAuthStore } from "@/stores/authStore"

interface Section {
  key: string
  label: string
  description: string
}

const SECTIONS: Section[] = [
  {
    key: "kpis",
    label: "KPIs Resumen",
    description: "Ventas totales, conversión, margen y cotizaciones",
  },
  {
    key: "clientes",
    label: "Top Clientes",
    description: "Los 15 clientes con mayor volumen de ventas",
  },
  {
    key: "productos",
    label: "Distribución por Producto",
    description: "Participación en ventas por producto (SKU + unidades)",
  },
  {
    key: "margen",
    label: "Margen Bruto por Producto",
    description: "Ingresos vs. costo y porcentaje de margen",
  },
  {
    key: "pagos",
    label: "Pagos Pendientes",
    description: "Clientes con montos adeudados pendientes de cobro",
  },
  {
    key: "riesgo",
    label: "Clientes en Riesgo",
    description: "Clientes con caída en compras vs. periodo previo",
  },
]

interface ReportModalProps {
  open: boolean
  onClose: () => void
  startDate: string | null
  endDate: string | null
}

export function ReportModal({ open, onClose, startDate, endDate }: ReportModalProps) {
  const token = useAuthStore((s) => s.accessToken)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(SECTIONS.map((s) => s.key))
  )
  const [generating, setGenerating] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  if (!open) return null

  const toggleSection = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const selectAll = () => setSelected(new Set(SECTIONS.map((s) => s.key)))
  const clearAll = () => setSelected(new Set())

  const handleGenerate = async () => {
    if (selected.size === 0) {
      toast.warning("Selecciona al menos una sección para el reporte.")
      return
    }

    setGenerating(true)
    try {
      const result = await ventasService.downloadVentasReport(token ?? "", {
        startDate,
        endDate,
        sections: Array.from(selected),
      })
      const url = URL.createObjectURL(result.blob)
      const a = document.createElement("a")
      a.href = url
      a.download = result.filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Reporte generado correctamente.")
      onClose()
    } catch {
      toast.error("No se pudo generar el reporte. Intenta de nuevo.")
    } finally {
      setGenerating(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const periodLabel = startDate && endDate
    ? `${startDate} — ${endDate}`
    : startDate
      ? `Desde ${startDate}`
      : endDate
        ? `Hasta ${endDate}`
        : "Todos los datos históricos"

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-white/20 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h2 id="report-modal-title" className="text-base font-semibold text-gray-900">
              Generar Reporte de Ventas
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Period info */}
        <div className="border-b border-gray-100 bg-blue-50 px-6 py-2.5">
          <p className="text-xs text-blue-700">
            <span className="font-medium">Periodo:</span> {periodLabel}
          </p>
        </div>

        {/* Section selector */}
        <div className="px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Secciones a incluir</p>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                Todas
              </button>
              <span className="text-xs text-gray-300">|</span>
              <button
                onClick={clearAll}
                className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
              >
                Ninguna
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {SECTIONS.map((section) => (
              <label
                key={section.key}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(section.key)}
                  onChange={() => toggleSection(section.key)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-700 accent-blue-700"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{section.label}</p>
                  <p className="text-xs text-gray-500">{section.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <p className="text-xs text-gray-400">
            {selected.size} de {SECTIONS.length} secciones · Formato DOCX
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={generating}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={generating || selected.size === 0}
              className="gap-1.5"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              {generating ? "Generando…" : "Descargar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
