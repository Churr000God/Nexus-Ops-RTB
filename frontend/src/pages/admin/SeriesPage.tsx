import { useCallback, useState } from "react"
import { Hash, Plus, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useApi } from "@/hooks/useApi"
import { usePermission } from "@/hooks/usePermission"
import { createSeries, getSeries, updateSeries } from "@/services/cfdiService"
import { useAuthStore } from "@/stores/authStore"
import type { CfdiSeriesIn, CfdiSeriesOut, CfdiType } from "@/types/cfdi"
import { cn } from "@/lib/utils"

// ── Constantes ────────────────────────────────────────────────────────────────

const CFDI_TYPES: { value: CfdiType; label: string; color: string }[] = [
  { value: "I", label: "Ingreso",  color: "border-blue-500/40 bg-blue-50 text-blue-700" },
  { value: "E", label: "Egreso",   color: "border-red-500/40 bg-red-50 text-red-700" },
  { value: "P", label: "Pago",     color: "border-violet-500/40 bg-violet-50 text-violet-700" },
  { value: "T", label: "Traslado", color: "border-amber-500/40 bg-amber-50 text-amber-700" },
]

function typeColor(cfdi_type: string) {
  return (
    CFDI_TYPES.find((t) => t.value === cfdi_type)?.color ??
    "border-border bg-muted text-muted-foreground"
  )
}

function typeLabel(cfdi_type: string) {
  return CFDI_TYPES.find((t) => t.value === cfdi_type)?.label ?? cfdi_type
}

// ── Modal nueva serie ─────────────────────────────────────────────────────────

type CreateModalProps = {
  token: string | null
  onClose: () => void
  onCreated: () => void
}

function CreateModal({ token, onClose, onCreated }: CreateModalProps) {
  const [form, setForm] = useState<CfdiSeriesIn>({
    series: "",
    cfdi_type: "I",
    description: "",
  })
  const [submitting, setSubmitting] = useState(false)

  function set<K extends keyof CfdiSeriesIn>(key: K, value: CfdiSeriesIn[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const series = form.series.trim().toUpperCase()
    if (!series) {
      toast.error("El código de serie es obligatorio")
      return
    }
    setSubmitting(true)
    try {
      await createSeries(token, { ...form, series })
      toast.success(`Serie "${series}" creada`)
      onCreated()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al crear serie")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-soft-md">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Nueva Serie CFDI</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Código de Serie *
            </span>
            <Input
              value={form.series}
              onChange={(e) => set("series", e.target.value.toUpperCase().slice(0, 10))}
              placeholder="Ej. A, NC, CP, EXP…"
              maxLength={10}
              autoFocus
              className="font-mono uppercase"
            />
            <p className="text-[11px] text-muted-foreground">
              Máx. 10 caracteres · se guarda en mayúsculas
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tipo de CFDI *
            </span>
            <div className="grid grid-cols-4 gap-2">
              {CFDI_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set("cfdi_type", t.value)}
                  className={cn(
                    "rounded-md border py-2 text-xs font-semibold transition-colors",
                    form.cfdi_type === t.value
                      ? t.color
                      : "border-border bg-muted/50 text-muted-foreground hover:border-primary/30",
                  )}
                >
                  {t.value} — {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Descripción
            </span>
            <Input
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value || null)}
              placeholder="Facturas de venta, Notas de crédito…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creando…" : "Crear Serie"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Fila de serie ─────────────────────────────────────────────────────────────

type SeriesRowProps = {
  serie: CfdiSeriesOut
  canManage: boolean
  token: string | null
  onUpdated: () => void
}

function SeriesRow({ serie, canManage, token, onUpdated }: SeriesRowProps) {
  const [toggling, setToggling] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [desc, setDesc] = useState(serie.description ?? "")
  const [savingDesc, setSavingDesc] = useState(false)

  async function toggleActive() {
    setToggling(true)
    try {
      await updateSeries(token, serie.series_id, { is_active: !serie.is_active })
      toast.success(
        serie.is_active
          ? `Serie "${serie.series}" desactivada`
          : `Serie "${serie.series}" activada`,
      )
      onUpdated()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar serie")
    } finally {
      setToggling(false)
    }
  }

  async function saveDesc() {
    setSavingDesc(true)
    try {
      await updateSeries(token, serie.series_id, { description: desc || null })
      toast.success("Descripción actualizada")
      setEditingDesc(false)
      onUpdated()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setSavingDesc(false)
    }
  }

  return (
    <tr className={cn("border-b border-border transition-colors hover:bg-muted/30", !serie.is_active && "opacity-60")}>
      {/* Serie */}
      <td className="px-4 py-3">
        <span className="font-mono text-sm font-semibold text-foreground">{serie.series}</span>
      </td>

      {/* Tipo */}
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            typeColor(serie.cfdi_type),
          )}
        >
          {serie.cfdi_type} — {typeLabel(serie.cfdi_type)}
        </span>
      </td>

      {/* Descripción */}
      <td className="px-4 py-3">
        {editingDesc ? (
          <div className="flex items-center gap-2">
            <Input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="h-7 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveDesc()
                if (e.key === "Escape") { setEditingDesc(false); setDesc(serie.description ?? "") }
              }}
            />
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={saveDesc}
              disabled={savingDesc}
            >
              {savingDesc ? "…" : "OK"}
            </Button>
            <button
              type="button"
              onClick={() => { setEditingDesc(false); setDesc(serie.description ?? "") }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => canManage && setEditingDesc(true)}
            className={cn(
              "text-left text-sm text-muted-foreground",
              canManage && "hover:text-foreground hover:underline cursor-pointer",
              !canManage && "cursor-default",
            )}
            title={canManage ? "Clic para editar" : undefined}
          >
            {serie.description || <span className="italic text-muted-foreground/60">Sin descripción</span>}
          </button>
        )}
      </td>

      {/* Próximo folio */}
      <td className="px-4 py-3 text-right">
        <span className="font-mono text-sm font-semibold text-foreground">
          {serie.next_folio.toLocaleString("es-MX")}
        </span>
      </td>

      {/* Estado */}
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            serie.is_active
              ? "border-emerald-500/40 bg-emerald-50 text-emerald-700"
              : "border-border bg-muted text-muted-foreground",
          )}
        >
          {serie.is_active ? "Activa" : "Inactiva"}
        </span>
      </td>

      {/* Acciones */}
      <td className="px-4 py-3 text-right">
        {canManage && (
          <button
            type="button"
            onClick={toggleActive}
            disabled={toggling}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              serie.is_active
                ? "border-red-300 text-red-600 hover:bg-red-50"
                : "border-emerald-400 text-emerald-700 hover:bg-emerald-50",
              toggling && "opacity-50 cursor-not-allowed",
            )}
          >
            {toggling ? "…" : serie.is_active ? "Desactivar" : "Activar"}
          </button>
        )}
      </td>
    </tr>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export function SeriesPage() {
  const token = useAuthStore((s) => s.accessToken)
  const canManage = usePermission("cfdi.config.manage")
  const [showAll, setShowAll] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const fetcher = useCallback(
    (signal: AbortSignal) => getSeries(token, !showAll, signal),
    [token, showAll],
  )
  const { data: series, status, refetch } = useApi(fetcher)

  const isLoading = status === "loading"
  const rows = series ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Series y Folios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Series CFDI activas e inactivas · próximo folio asignado por la DB
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowModal(true)} className="flex-shrink-0 gap-1.5">
            <Plus className="h-4 w-4" />
            Nueva Serie
          </Button>
        )}
      </div>

      {/* Filtro activas/todas */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Mostrar:</span>
        {[
          { label: "Todas", value: true },
          { label: "Solo activas", value: false },
        ].map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => setShowAll(opt.value)}
            className={cn(
              "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
              showAll === opt.value
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/20 hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="rounded-lg border border-border bg-card shadow-soft-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-muted/50" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Hash className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No hay series registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Serie
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Tipo CFDI
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Descripción
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Próximo Folio
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {canManage ? "Acción" : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((serie) => (
                  <SeriesRow
                    key={serie.series_id}
                    serie={serie}
                    canManage={canManage}
                    token={token}
                    onUpdated={refetch}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nota informativa */}
      <p className="text-xs text-muted-foreground">
        El folio se asigna automáticamente vía{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
          fn_assign_cfdi_folio
        </code>{" "}
        — no es editable manualmente para preservar la consecutividad.
      </p>

      {/* Modal */}
      {showModal && (
        <CreateModal
          token={token}
          onClose={() => setShowModal(false)}
          onCreated={refetch}
        />
      )}
    </div>
  )
}
