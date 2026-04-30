import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { assetsService } from "@/services/assetsService"
import { useAuthStore } from "@/stores/authStore"
import type { AssetCreate, AssetRead, AssetUpdate } from "@/types/assets"

const ASSET_TYPES = [
  { value: "COMPUTER", label: "Computadora" },
  { value: "LAPTOP", label: "Laptop" },
  { value: "PRINTER", label: "Impresora" },
  { value: "MACHINE", label: "Máquina" },
  { value: "VEHICLE", label: "Vehículo" },
  { value: "TOOL", label: "Herramienta" },
  { value: "OTHER", label: "Otro" },
]

const ASSET_STATUSES = [
  { value: "ACTIVE", label: "Activo" },
  { value: "IDLE", label: "Inactivo" },
  { value: "IN_REPAIR", label: "En Reparación" },
  { value: "RETIRED", label: "Retirado" },
  { value: "DISMANTLED", label: "Desmantelado" },
]

interface AssetFormModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (asset: AssetRead) => void
  asset?: AssetRead
}

type FormState = {
  asset_code: string
  asset_type: string
  name: string
  serial_number: string
  manufacturer: string
  model: string
  location: string
  status: string
  purchase_date: string
  purchase_cost: string
  warranty_until: string
  notes: string
}

const EMPTY: FormState = {
  asset_code: "",
  asset_type: "COMPUTER",
  name: "",
  serial_number: "",
  manufacturer: "",
  model: "",
  location: "",
  status: "ACTIVE",
  purchase_date: "",
  purchase_cost: "",
  warranty_until: "",
  notes: "",
}

function assetToForm(a: AssetRead): FormState {
  return {
    asset_code: a.asset_code,
    asset_type: a.asset_type,
    name: a.name,
    serial_number: a.serial_number ?? "",
    manufacturer: a.manufacturer ?? "",
    model: a.model ?? "",
    location: a.location ?? "",
    status: a.status,
    purchase_date: a.purchase_date ?? "",
    purchase_cost: a.purchase_cost != null ? String(a.purchase_cost) : "",
    warranty_until: a.warranty_until ?? "",
    notes: a.notes ?? "",
  }
}

export function AssetFormModal({ open, onClose, onSuccess, asset }: AssetFormModalProps) {
  const token = useAuthStore((s) => s.accessToken)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const firstRef = useRef<HTMLInputElement>(null)

  const isEdit = !!asset

  useEffect(() => {
    if (open) {
      setForm(asset ? assetToForm(asset) : EMPTY)
      setTimeout(() => firstRef.current?.focus(), 50)
    }
  }, [open, asset])

  if (!open) return null

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.asset_code.trim() || !form.name.trim()) {
      toast.error("Código y nombre son obligatorios")
      return
    }
    setSaving(true)
    try {
      const costNum = form.purchase_cost ? parseFloat(form.purchase_cost) : null
      let result: AssetRead
      if (isEdit && asset) {
        const payload: AssetUpdate = {
          asset_type: form.asset_type || null,
          name: form.name.trim() || null,
          serial_number: form.serial_number.trim() || null,
          manufacturer: form.manufacturer.trim() || null,
          model: form.model.trim() || null,
          location: form.location.trim() || null,
          status: form.status || null,
          purchase_date: form.purchase_date || null,
          purchase_cost: costNum,
          warranty_until: form.warranty_until || null,
          notes: form.notes.trim() || null,
        }
        result = await assetsService.updateAsset(token, asset.id, payload)
      } else {
        const payload: AssetCreate = {
          asset_code: form.asset_code.trim(),
          asset_type: form.asset_type,
          name: form.name.trim(),
          serial_number: form.serial_number.trim() || null,
          manufacturer: form.manufacturer.trim() || null,
          model: form.model.trim() || null,
          location: form.location.trim() || null,
          status: form.status,
          purchase_date: form.purchase_date || null,
          purchase_cost: costNum,
          warranty_until: form.warranty_until || null,
          notes: form.notes.trim() || null,
        }
        result = await assetsService.createAsset(token, payload)
      }
      toast.success(isEdit ? "Activo actualizado" : "Activo creado")
      onSuccess(result)
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="surface-card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? "Editar Activo" : "Nuevo Activo"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Código *</label>
              <input
                ref={firstRef}
                disabled={isEdit}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                value={form.asset_code}
                onChange={(e) => set("asset_code", e.target.value)}
                placeholder="EQ-001"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo *</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.asset_type}
                onChange={(e) => set("asset_type", e.target.value)}
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
            <input
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Laptop Dell Latitude 5540"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Fabricante</label>
              <input
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.manufacturer}
                onChange={(e) => set("manufacturer", e.target.value)}
                placeholder="Dell, HP, Lenovo…"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Modelo</label>
              <input
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.model}
                onChange={(e) => set("model", e.target.value)}
                placeholder="Latitude 5540"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Número de Serie</label>
              <input
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.serial_number}
                onChange={(e) => set("serial_number", e.target.value)}
                placeholder="SN-XXXXXXXX"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Ubicación</label>
              <input
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Oficina, Almacén…"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Estado</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {ASSET_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Costo de Compra</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.purchase_cost}
                onChange={(e) => set("purchase_cost", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Fecha de Compra</label>
              <input
                type="date"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.purchase_date}
                onChange={(e) => set("purchase_date", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Garantía hasta</label>
              <input
                type="date"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.warranty_until}
                onChange={(e) => set("warranty_until", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Notas</label>
            <textarea
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Información adicional…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : isEdit ? "Guardar Cambios" : "Crear Activo"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
