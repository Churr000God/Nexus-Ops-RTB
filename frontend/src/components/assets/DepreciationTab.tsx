import { useCallback, useEffect, useState } from "react"
import { useAuthStore } from "@/stores/authStore"
import { assetsService } from "@/services/assetsService"
import type { DepreciationConfigCreate, DepreciationScheduleRead } from "@/types/assets"

interface Props {
  assetId: string
  purchaseCost: number | null
  purchaseDate: string | null
}

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })
const fmtPct = (n: number) => `${n.toFixed(1)}%`

export default function DepreciationTab({ assetId, purchaseCost, purchaseDate }: Props) {
  const token = useAuthStore((s: { accessToken: string | null }) => s.accessToken)
  const [schedule, setSchedule] = useState<DepreciationScheduleRead | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<DepreciationConfigCreate>({
    method: "STRAIGHT_LINE",
    useful_life_years: 5,
    residual_value: 0,
    start_date: purchaseDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  })

  const load = useCallback(
    (signal?: AbortSignal) =>
      assetsService
        .getDepreciation(token, assetId, signal)
        .then(setSchedule)
        .catch(() => {})
        .finally(() => setLoading(false)),
    [token, assetId],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  useEffect(() => {
    if (schedule?.config) {
      setForm({
        method: "STRAIGHT_LINE",
        useful_life_years: schedule.config.useful_life_years,
        residual_value: schedule.config.residual_value,
        start_date: schedule.config.start_date,
      })
    }
  }, [schedule?.config])

  async function handleSave() {
    setSaving(true)
    try {
      const result = await assetsService.upsertDepreciation(token, assetId, form)
      setSchedule(result)
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-neutral-400 p-4">Cargando…</p>

  const hasConfig = !!schedule?.config

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* KPI strip */}
      {hasConfig && schedule && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Costo original" value={fmt.format(schedule.asset_cost ?? 0)} />
          <Kpi label="Valor en libros" value={fmt.format(schedule.current_book_value ?? 0)} />
          <Kpi label="Depreciado acum." value={fmt.format(schedule.accumulated_depreciation ?? 0)} />
          <Kpi label="% Depreciado" value={fmtPct(schedule.percent_depreciated ?? 0)} />
        </div>
      )}

      {/* no config yet */}
      {!hasConfig && (
        <p className="text-sm text-neutral-400">
          Este activo no tiene configuración de depreciación.{" "}
          {purchaseCost == null && (
            <span className="text-amber-400">Agrega el costo de compra al activo primero.</span>
          )}
        </p>
      )}

      {/* config button / form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="self-start text-sm rounded-md border border-neutral-600 px-3 py-1.5 hover:border-blue-400 hover:text-blue-300 transition-colors"
        >
          {hasConfig ? "Editar configuración" : "Configurar depreciación"}
        </button>
      ) : (
        <div className="rounded-lg border border-neutral-700 bg-neutral-800 p-4 flex flex-col gap-3 max-w-sm">
          <p className="text-sm font-medium text-neutral-200">Configuración (Línea Recta)</p>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400">Vida útil (años)</span>
            <input
              type="number"
              min={1}
              max={50}
              value={form.useful_life_years}
              onChange={(e) => setForm((f) => ({ ...f, useful_life_years: Number(e.target.value) }))}
              className="rounded-md border border-neutral-600 bg-neutral-900 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400">Valor residual (MXN)</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.residual_value ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, residual_value: Number(e.target.value) }))}
              className="rounded-md border border-neutral-600 bg-neutral-900 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400">Fecha de inicio</span>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              className="rounded-md border border-neutral-600 bg-neutral-900 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </label>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || purchaseCost == null}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md border border-neutral-600 px-4 py-1.5 text-sm hover:border-neutral-400 transition-colors"
            >
              Cancelar
            </button>
          </div>
          {purchaseCost == null && (
            <p className="text-xs text-amber-400">El activo necesita un costo de compra registrado.</p>
          )}
        </div>
      )}

      {/* schedule table */}
      {hasConfig && schedule && schedule.periods.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-neutral-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-700 bg-neutral-800">
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-400">Año</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-400">Período</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-neutral-400">Dep. anual</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-neutral-400">Dep. acum.</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-neutral-400">Valor libros</th>
              </tr>
            </thead>
            <tbody>
              {schedule.periods.map((p) => (
                <tr
                  key={p.year}
                  className={[
                    "border-b border-neutral-700/50 last:border-0",
                    p.is_current ? "bg-blue-500/10" : "hover:bg-neutral-800/50",
                  ].join(" ")}
                >
                  <td className="px-3 py-2 font-medium">
                    {p.year}
                    {p.is_current && (
                      <span className="ml-1.5 rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-300">
                        actual
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-neutral-400 text-xs">
                    {p.period_start} → {p.period_end}
                  </td>
                  <td className="px-3 py-2 text-right">{fmt.format(p.annual_depreciation)}</td>
                  <td className="px-3 py-2 text-right">{fmt.format(p.accumulated_depreciation)}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmt.format(p.book_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2">
      <p className="text-[10px] text-neutral-400 uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  )
}
