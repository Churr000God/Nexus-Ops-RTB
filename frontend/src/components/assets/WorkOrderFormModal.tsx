import { useEffect, useState } from "react"
import { Wrench, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { assetsService } from "@/services/assetsService"
import { useAuthStore } from "@/stores/authStore"
import type { WorkOrderRead } from "@/types/assets"

const WORK_TYPES = [
  { value: "CORRECTIVE", label: "Correctivo" },
  { value: "PREVENTIVE", label: "Preventivo" },
  { value: "INSPECTION", label: "Inspección" },
  { value: "UPGRADE", label: "Mejora" },
]

const PRIORITIES = [
  { value: "LOW", label: "Baja" },
  { value: "MEDIUM", label: "Media" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
]

const STATUSES = [
  { value: "OPEN", label: "Abierta" },
  { value: "IN_PROGRESS", label: "En Proceso" },
  { value: "DONE", label: "Completada" },
  { value: "CANCELLED", label: "Cancelada" },
]

interface WorkOrderFormModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (wo: WorkOrderRead) => void
  assetId: string
  workOrder?: WorkOrderRead
}

type FormState = {
  title: string
  description: string
  work_type: string
  priority: string
  status: string
  scheduled_date: string
  cost: string
  notes: string
}

const EMPTY: FormState = {
  title: "",
  description: "",
  work_type: "CORRECTIVE",
  priority: "MEDIUM",
  status: "OPEN",
  scheduled_date: "",
  cost: "",
  notes: "",
}

function woToForm(wo: WorkOrderRead): FormState {
  return {
    title: wo.title,
    description: wo.description ?? "",
    work_type: wo.work_type,
    priority: wo.priority,
    status: wo.status,
    scheduled_date: wo.scheduled_date ?? "",
    cost: wo.cost != null ? String(wo.cost) : "",
    notes: wo.notes ?? "",
  }
}

export function WorkOrderFormModal({
  open,
  onClose,
  onSuccess,
  assetId,
  workOrder,
}: WorkOrderFormModalProps) {
  const token = useAuthStore((s) => s.accessToken)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const isEdit = !!workOrder

  useEffect(() => {
    if (open) setForm(workOrder ? woToForm(workOrder) : EMPTY)
  }, [open, workOrder])

  if (!open) return null

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error("El título es obligatorio"); return }
    setSaving(true)
    try {
      const costNum = form.cost ? parseFloat(form.cost) : null
      let result: WorkOrderRead
      if (isEdit && workOrder) {
        result = await assetsService.updateWorkOrder(token, assetId, workOrder.id, {
          title: form.title.trim(),
          description: form.description.trim() || null,
          work_type: form.work_type,
          priority: form.priority,
          status: form.status,
          scheduled_date: form.scheduled_date || null,
          cost: costNum,
          notes: form.notes.trim() || null,
        })
      } else {
        result = await assetsService.createWorkOrder(token, assetId, {
          title: form.title.trim(),
          description: form.description.trim() || null,
          work_type: form.work_type,
          priority: form.priority,
          scheduled_date: form.scheduled_date || null,
          cost: costNum,
          notes: form.notes.trim() || null,
        })
      }
      toast.success(isEdit ? "Orden actualizada" : "Orden de trabajo creada")
      onSuccess(result)
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="surface-card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-[hsl(var(--primary))]" />
            <h2 className="text-base font-semibold text-foreground">
              {isEdit ? "Editar Orden" : "Nueva Orden de Mantenimiento"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Título */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Título *</label>
            <input
              autoFocus
              required
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Revisión anual, cambio de aceite, reparación de falla…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.work_type}
                onChange={(e) => set("work_type", e.target.value)}
              >
                {WORK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Prioridad</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
              >
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            {isEdit && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Estado</label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Fecha programada</label>
              <input
                type="date"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.scheduled_date}
                onChange={(e) => set("scheduled_date", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Costo (MXN)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.cost}
                onChange={(e) => set("cost", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Descripción</label>
            <textarea
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Detalle del trabajo a realizar…"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Notas / Resultados</label>
            <textarea
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Observaciones, materiales usados, hallazgos…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : isEdit ? "Guardar Cambios" : "Crear Orden"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
