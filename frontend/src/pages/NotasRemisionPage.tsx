import { useCallback, useEffect, useRef, useState } from "react"
import {
  Eye,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  ChevronUp,
  Save,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/useApi"
import { usePermission } from "@/hooks/usePermission"
import {
  createDeliveryNote,
  getDeliveryNotes,
  updateDeliveryNote,
} from "@/services/ventasLogisticaService"
import { clientesProveedoresService } from "@/services/clientesProveedoresService"
import type {
  DeliveryNote,
  DeliveryNoteCreate,
  DeliveryNoteStatus,
  DeliveryNoteUpdate,
} from "@/types/ventasLogistica"
import type { CustomerRead } from "@/types/clientesProveedores"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/authStore"

const STATUS_COLORS: Record<DeliveryNoteStatus, string> = {
  DRAFT: "border-slate-500/30 bg-slate-500/10 text-slate-400",
  ISSUED: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  DELIVERED: "border-teal-500/30 bg-teal-500/10 text-teal-400",
  TRANSFORMED: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  PARTIALLY_INVOICED: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  INVOICED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  CANCELLED: "border-red-900/30 bg-red-900/10 text-red-600",
}

const STATUS_LABELS: Record<DeliveryNoteStatus, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitida",
  DELIVERED: "Entregada",
  TRANSFORMED: "Transformada",
  PARTIALLY_INVOICED: "Parcialmente facturada",
  INVOICED: "Facturada",
  CANCELLED: "Cancelada",
}

const fmt = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
})

// ─── Types ──────────────────────────────────────────────────────────────────

type ModalMode = { type: "create" } | { type: "edit"; note: DeliveryNote }

interface FormItem {
  key: string
  product_id?: string
  sku?: string
  description: string
  quantity: number
  unit_price: number
  discount_amount: number
  tax_rate: number
  notes?: string
}

interface FormState {
  customer_id: number | null
  shipping_address_id: number | null
  issue_date: string
  delivery_date: string
  customer_po_number: string
  customer_po_date: string
  notes: string
  items: FormItem[]
}

const EMPTY_FORM: FormState = {
  customer_id: null,
  shipping_address_id: null,
  issue_date: new Date().toISOString().split("T")[0],
  delivery_date: "",
  customer_po_number: "",
  customer_po_date: "",
  notes: "",
  items: [],
}

function noteToForm(note: DeliveryNote): FormState {
  return {
    customer_id: note.customer_id,
    shipping_address_id: note.shipping_address_id,
    issue_date: String(note.issue_date),
    delivery_date: note.delivery_date ?? "",
    customer_po_number: note.customer_po_number ?? "",
    customer_po_date: note.customer_po_date ?? "",
    notes: note.notes ?? "",
    items: note.items.map((it) => ({
      key: `item-${it.item_id}`,
      product_id: it.product_id ?? undefined,
      sku: it.sku ?? undefined,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount_amount: it.discount_amount,
      tax_rate: it.tax_rate,
      notes: it.notes ?? undefined,
    })),
  }
}

function generateKey() {
  return `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function emptyItem(): FormItem {
  return {
    key: generateKey(),
    description: "",
    quantity: 1,
    unit_price: 0,
    discount_amount: 0,
    tax_rate: 0.16,
  }
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function NotasRemisionPage() {
  const token = useAuthStore((s) => s.accessToken)
  const canCreate = usePermission("delivery_note.create")
  const canManage = usePermission("delivery_note.manage")

  const [filterStatus, setFilterStatus] = useState("")
  const [filterCustomerSearch, setFilterCustomerSearch] = useState("")
  const [expandedNoteId, setExpandedNoteId] = useState<number | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const api = useApi(
    useCallback(
      (_signal: AbortSignal) =>
        getDeliveryNotes({
          status: filterStatus || undefined,
          limit: 100,
        }),
      [filterStatus]
    )
  )

  const notes = (api.data ?? []) as DeliveryNote[]

  // Filter by customer search locally (we fetch all and filter)
  const filteredNotes = notes.filter((n) => {
    if (!filterCustomerSearch.trim()) return true
    const q = filterCustomerSearch.toLowerCase()
    return (
      String(n.customer_id).includes(q) ||
      n.note_number.toLowerCase().includes(q) ||
      (n.customer_po_number ?? "").toLowerCase().includes(q)
    )
  })

  const handleCancel = async (note: DeliveryNote) => {
    if (!canManage) {
      toast.error("No tienes permiso para cancelar notas de remision")
      return
    }
    const reason = window.prompt("Motivo de cancelacion:")
    if (!reason) return
    setActionLoading(note.delivery_note_id)
    try {
      await updateDeliveryNote(note.delivery_note_id, {
        status: "CANCELLED",
        cancellation_reason: reason,
      })
      toast.success("Nota de remision cancelada")
      api.refetch()
    } catch {
      toast.error("No se pudo cancelar la nota de remision")
    } finally {
      setActionLoading(null)
    }
  }

  const columns: DataTableColumn<DeliveryNote>[] = [
    {
      key: "note_number",
      header: "NR",
      className: "font-mono text-xs",
      cell: (r) => r.note_number,
    },
    {
      key: "customer_id",
      header: "Cliente ID",
      className: "text-xs",
      cell: (r) => String(r.customer_id),
    },
    {
      key: "issue_date",
      header: "Emision",
      className: "text-xs",
      cell: (r) => String(r.issue_date),
    },
    {
      key: "delivery_date",
      header: "Entrega",
      className: "text-xs",
      cell: (r) => r.delivery_date ?? "—",
    },
    {
      key: "status",
      header: "Estado",
      cell: (r) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
            STATUS_COLORS[r.status] ??
              "border-slate-500/30 bg-slate-500/10 text-slate-400"
          )}
        >
          {STATUS_LABELS[r.status] ?? r.status}
        </span>
      ),
    },
    {
      key: "customer_po_number",
      header: "OC Cliente",
      className: "text-xs",
      cell: (r) => r.customer_po_number ?? "—",
    },
    {
      key: "total",
      header: "Total",
      cell: (r) => (
        <span className="font-mono text-xs font-semibold text-emerald-400">
          {fmt.format(r.total)}
        </span>
      ),
    },
    {
      key: "items",
      header: "Partidas",
      cell: (r) => (
        <span className="text-xs text-slate-400">{r.items.length}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() =>
              setExpandedNoteId(
                expandedNoteId === r.delivery_note_id
                  ? null
                  : r.delivery_note_id
              )
            }
            title="Ver detalle"
          >
            {expandedNoteId === r.delivery_note_id ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
          {canManage && ["DRAFT", "ISSUED"].includes(r.status) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-amber-400 hover:text-amber-300"
              onClick={() => setModalMode({ type: "edit", note: r })}
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {canManage && ["DRAFT", "ISSUED"].includes(r.status) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
              disabled={actionLoading === r.delivery_note_id}
              onClick={() => handleCancel(r)}
              title="Cancelar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-base font-semibold text-slate-200">
          <FileText className="h-5 w-5 text-amber-400" />
          Notas de Remision
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={filterCustomerSearch}
              onChange={(e) => setFilterCustomerSearch(e.target.value)}
              placeholder="Buscar NR, cliente, OC…"
              className="h-8 w-48 rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-xs text-slate-300 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-8 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-slate-300 focus:outline-none"
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          {canCreate && (
            <Button
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setModalMode({ type: "create" })}
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva NR
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filteredNotes}
        rowKey={(r) => String(r.delivery_note_id)}
        emptyLabel="Sin notas de remision"
      />

      {expandedNoteId && (
        <DetailPanel
          note={notes.find((n) => n.delivery_note_id === expandedNoteId)!}
          onClose={() => setExpandedNoteId(null)}
        />
      )}

      {modalMode && (
        <DeliveryNoteFormModal
          mode={modalMode}
          token={token}
          onClose={() => setModalMode(null)}
          onSaved={() => {
            api.refetch()
            setModalMode(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Detail Panel ───────────────────────────────────────────────────────────

function DetailPanel({
  note,
  onClose,
}: {
  note: DeliveryNote
  onClose: () => void
}) {
  return (
    <div className="surface-card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{note.note_number}</p>
          <p className="text-xs text-muted-foreground">
            Cliente ID: {note.customer_id} · Emision: {note.issue_date}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-accent/20 p-3">
          <p className="text-muted-foreground">Subtotal</p>
          <p className="mt-0.5 font-mono font-semibold">{fmt.format(note.subtotal)}</p>
        </div>
        <div className="rounded-lg border border-border bg-accent/20 p-3">
          <p className="text-muted-foreground">Impuesto</p>
          <p className="mt-0.5 font-mono font-semibold">{fmt.format(note.tax_amount)}</p>
        </div>
        <div className="rounded-lg border border-border bg-accent/20 p-3">
          <p className="text-muted-foreground">Total</p>
          <p className="mt-0.5 font-mono font-semibold text-emerald-400">
            {fmt.format(note.total)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-accent/20 p-3">
          <p className="text-muted-foreground">Partidas</p>
          <p className="mt-0.5 font-mono font-semibold">{note.items.length}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="pb-2 pr-3">#</th>
              <th className="pb-2 pr-3">Descripcion</th>
              <th className="pb-2 pr-3 text-right">Cantidad</th>
              <th className="pb-2 pr-3 text-right">Precio</th>
              <th className="pb-2 pr-3 text-right">Desc.</th>
              <th className="pb-2 pr-3 text-right">Subtotal</th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {note.items.map((it, idx) => (
              <tr key={it.item_id} className="border-b border-border/50">
                <td className="py-2 pr-3 text-muted-foreground">{idx + 1}</td>
                <td className="py-2 pr-3">
                  {it.description}
                  {it.sku && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      (SKU: {it.sku})
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right font-mono">
                  {it.quantity.toLocaleString("es-MX")}
                </td>
                <td className="py-2 pr-3 text-right font-mono">
                  {fmt.format(it.unit_price)}
                </td>
                <td className="py-2 pr-3 text-right font-mono">
                  {fmt.format(it.discount_amount)}
                </td>
                <td className="py-2 pr-3 text-right font-mono">
                  {fmt.format(it.subtotal)}
                </td>
                <td className="py-2 text-right font-mono">
                  {fmt.format(it.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {note.notes && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Notas:</span> {note.notes}
        </p>
      )}
    </div>
  )
}

// ─── Form Modal ─────────────────────────────────────────────────────────────

function DeliveryNoteFormModal({
  mode,
  token,
  onClose,
  onSaved,
}: {
  mode: ModalMode
  token: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = mode.type === "edit"
  const existing = isEdit ? mode.note : null

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Customer search
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerResults, setCustomerResults] = useState<CustomerRead[]>([])
  const [customerSelected, setCustomerSelected] = useState<CustomerRead | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (mode) {
      setForm(existing ? noteToForm(existing) : EMPTY_FORM)
      setError(null)
      setCustomerSearch("")
      setCustomerResults([])
      if (existing) {
        setCustomerSelected({
          customer_id: existing.customer_id,
          business_name: `Cliente #${existing.customer_id}`,
        } as CustomerRead)
      } else {
        setCustomerSelected(null)
      }
    }
  }, [mode, existing])

  function handleCustomerSearch(q: string) {
    setCustomerSearch(q)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!q.trim()) {
      setCustomerResults([])
      return
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await clientesProveedoresService.listCustomers(token, {
          search: q,
          limit: 10,
          solo_activos: true,
        })
        setCustomerResults(res.items)
      } catch {
        setCustomerResults([])
      }
    }, 300)
  }

  function selectCustomer(c: CustomerRead) {
    setCustomerSelected(c)
    setForm((prev) => ({ ...prev, customer_id: c.customer_id }))
    setCustomerSearch("")
    setCustomerResults([])
  }

  function clearCustomer() {
    setCustomerSelected(null)
    setForm((prev) => ({ ...prev, customer_id: null }))
    setCustomerSearch("")
    setCustomerResults([])
  }

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function updateItem(key: string, patch: Partial<FormItem>) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.key === key ? { ...it, ...patch } : it
      ),
    }))
  }

  function removeItem(key: string) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.key !== key),
    }))
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, emptyItem()],
    }))
  }

  function calcTotals() {
    const subtotal = form.items.reduce((sum, it) => {
      return sum + it.quantity * it.unit_price - it.discount_amount
    }, 0)
    const tax = form.items.reduce((sum, it) => {
      const base = it.quantity * it.unit_price - it.discount_amount
      return sum + base * it.tax_rate
    }, 0)
    return { subtotal, tax, total: subtotal + tax }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.customer_id) {
      setError("Selecciona un cliente")
      return
    }
    if (!form.issue_date) {
      setError("La fecha de emision es obligatoria")
      return
    }
    if (form.items.length === 0) {
      setError("Agrega al menos una partida")
      return
    }
    for (const it of form.items) {
      if (!it.description.trim()) {
        setError("Todas las partidas deben tener descripcion")
        return
      }
      if (it.quantity <= 0) {
        setError("La cantidad debe ser mayor a 0")
        return
      }
      if (it.unit_price < 0) {
        setError("El precio unitario no puede ser negativo")
        return
      }
    }

    setSaving(true)
    try {
      if (isEdit && existing) {
        const payload: DeliveryNoteUpdate = {
          shipping_address_id: form.shipping_address_id ?? undefined,
          delivery_date: form.delivery_date || undefined,
          customer_po_number: form.customer_po_number || undefined,
          customer_po_date: form.customer_po_date || undefined,
          notes: form.notes || undefined,
        }
        await updateDeliveryNote(existing.delivery_note_id, payload)
        toast.success("Nota de remision actualizada")
      } else {
        const payload: DeliveryNoteCreate = {
          customer_id: form.customer_id!,
          shipping_address_id: form.shipping_address_id ?? undefined,
          issue_date: form.issue_date,
          delivery_date: form.delivery_date || undefined,
          customer_po_number: form.customer_po_number || undefined,
          customer_po_date: form.customer_po_date || undefined,
          notes: form.notes || undefined,
          items: form.items.map((it) => ({
            product_id: it.product_id,
            sku: it.sku,
            description: it.description,
            quantity: it.quantity,
            unit_price: it.unit_price,
            discount_amount: it.discount_amount || undefined,
            tax_rate: it.tax_rate,
            notes: it.notes,
          })),
        }
        await createDeliveryNote(payload)
        toast.success("Nota de remision creada")
      }
      onSaved()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar"
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const { subtotal, tax, total } = calcTotals()

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 h-full overflow-y-auto flex items-start justify-center p-4 pt-6">
        <div className="relative z-10 surface-card w-full max-w-4xl space-y-5 p-6 mb-10">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold">
                {isEdit ? "Editar Nota de Remision" : "Nueva Nota de Remision"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isEdit
                  ? existing?.note_number
                  : "Documento informal de entrega"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* General data */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Datos generales
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Cliente */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Cliente <span className="text-red-400">*</span>
                  </label>
                  {isEdit ? (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-accent/20 px-3 py-2">
                      <span className="text-sm text-foreground">
                        Cliente #{existing?.customer_id}
                      </span>
                    </div>
                  ) : customerSelected ? (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-accent/20 px-3 py-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        #{customerSelected.customer_id}
                      </span>
                      <span className="flex-1 text-sm text-foreground">
                        {customerSelected.business_name}
                      </span>
                      <button
                        type="button"
                        onClick={clearCustomer}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        value={customerSearch}
                        onChange={(e) => handleCustomerSearch(e.target.value)}
                        placeholder="Buscar cliente por nombre…"
                      />
                      {customerResults.length > 0 && (
                        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-background shadow-lg">
                          {customerResults.map((c) => (
                            <li key={c.customer_id}>
                              <button
                                type="button"
                                onClick={() => selectCustomer(c)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
                              >
                                <span className="font-mono text-xs text-muted-foreground">
                                  #{c.customer_id}
                                </span>
                                <span className="text-sm text-foreground">
                                  {c.business_name}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Fecha de emision <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    disabled={isEdit}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                    value={form.issue_date}
                    onChange={(e) => set("issue_date", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Fecha de entrega estimada
                  </label>
                  <input
                    type="date"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form.delivery_date}
                    onChange={(e) => set("delivery_date", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    OC Cliente
                  </label>
                  <input
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form.customer_po_number}
                    onChange={(e) =>
                      set("customer_po_number", e.target.value)
                    }
                    placeholder="Numero de orden de compra"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Fecha OC
                  </label>
                  <input
                    type="date"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form.customer_po_date}
                    onChange={(e) => set("customer_po_date", e.target.value)}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Notas
                  </label>
                  <textarea
                    className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder="Observaciones generales…"
                  />
                </div>
              </div>
            </fieldset>

            {/* Items */}
            <fieldset className="space-y-3">
              <div className="flex items-center justify-between">
                <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Partidas
                </legend>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={addItem}
                >
                  <Plus className="h-3 w-3" />
                  Agregar partida
                </Button>
              </div>

              {form.items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-accent/10 p-6 text-center text-sm text-muted-foreground">
                  No hay partidas. Presiona "Agregar partida" para comenzar.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="pb-2 pr-2 w-8">#</th>
                        <th className="pb-2 pr-2 min-w-[180px]">Descripcion *</th>
                        <th className="pb-2 pr-2 w-24">Cantidad *</th>
                        <th className="pb-2 pr-2 w-28">Precio *</th>
                        <th className="pb-2 pr-2 w-24">Descuento</th>
                        <th className="pb-2 pr-2 w-20">IVA %</th>
                        <th className="pb-2 pr-2 w-20 text-right">Subtotal</th>
                        <th className="pb-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((it, idx) => {
                        const lineSub =
                          it.quantity * it.unit_price - it.discount_amount
                        return (
                          <tr
                            key={it.key}
                            className="border-b border-border/50"
                          >
                            <td className="py-2 pr-2 text-muted-foreground align-top">
                              {idx + 1}
                            </td>
                            <td className="py-2 pr-2 align-top">
                              <input
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                value={it.description}
                                onChange={(e) =>
                                  updateItem(it.key, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="Descripcion del producto / servicio"
                              />
                              <div className="mt-1 flex gap-1">
                                <input
                                  className="h-6 w-20 rounded-md border border-input bg-background px-2 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                  value={it.sku ?? ""}
                                  onChange={(e) =>
                                    updateItem(it.key, {
                                      sku: e.target.value || undefined,
                                    })
                                  }
                                  placeholder="SKU"
                                />
                                <input
                                  className="h-6 flex-1 rounded-md border border-input bg-background px-2 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                  value={it.notes ?? ""}
                                  onChange={(e) =>
                                    updateItem(it.key, {
                                      notes: e.target.value || undefined,
                                    })
                                  }
                                  placeholder="Notas de partida"
                                />
                              </div>
                            </td>
                            <td className="py-2 pr-2 align-top">
                              <input
                                type="number"
                                min={0.0001}
                                step="any"
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                value={it.quantity}
                                onChange={(e) =>
                                  updateItem(it.key, {
                                    quantity:
                                      parseFloat(e.target.value) || 0,
                                  })
                                }
                              />
                            </td>
                            <td className="py-2 pr-2 align-top">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                value={it.unit_price}
                                onChange={(e) =>
                                  updateItem(it.key, {
                                    unit_price:
                                      parseFloat(e.target.value) || 0,
                                  })
                                }
                              />
                            </td>
                            <td className="py-2 pr-2 align-top">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                value={it.discount_amount}
                                onChange={(e) =>
                                  updateItem(it.key, {
                                    discount_amount:
                                      parseFloat(e.target.value) || 0,
                                  })
                                }
                              />
                            </td>
                            <td className="py-2 pr-2 align-top">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                value={it.tax_rate}
                                onChange={(e) =>
                                  updateItem(it.key, {
                                    tax_rate:
                                      parseFloat(e.target.value) || 0,
                                  })
                                }
                              />
                            </td>
                            <td className="py-2 pr-2 align-top text-right font-mono">
                              {fmt.format(lineSub)}
                            </td>
                            <td className="py-2 align-top">
                              <button
                                type="button"
                                onClick={() => removeItem(it.key)}
                                className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                                title="Eliminar partida"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono">{fmt.format(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Impuesto</span>
                    <span className="font-mono">{fmt.format(tax)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1">
                    <span className="font-medium">Total estimado</span>
                    <span className="font-mono font-semibold text-emerald-400">
                      {fmt.format(total)}
                    </span>
                  </div>
                </div>
              </div>
            </fieldset>

            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {isEdit ? "Guardar cambios" : "Crear Nota de Remision"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
