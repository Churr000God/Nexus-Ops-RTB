import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  Eye,
  FileText,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  ChevronUp,
  Save,
  Loader2,
  Calculator,
  User,
  CalendarDays,
  Hash,
  StickyNote,
  CheckCircle2,
  Filter,
  Banknote,
  Layers,
  AlertCircle,
  Download,
  Mail,
  Send,
} from "lucide-react"
import { toast } from "sonner"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { KpiCard } from "@/components/common/KpiCard"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useApi } from "@/hooks/useApi"
import { usePermission } from "@/hooks/usePermission"
import { CACHE_KEYS, STALE } from "@/lib/queryCache"
import {
  createDeliveryNote,
  downloadDeliveryNotePdf,
  getDeliveryNotes,
  sendDeliveryNoteEmail,
  updateDeliveryNote,
} from "@/services/ventasLogisticaService"
import { clientesProveedoresService } from "@/services/clientesProveedoresService"
import { productosService } from "@/services/productosService"
import type {
  DeliveryNote,
  DeliveryNoteCreate,
  DeliveryNoteStatus,
  DeliveryNoteUpdate,
} from "@/types/ventasLogistica"
import type { CustomerDetail, CustomerRead } from "@/types/clientesProveedores"
import type { ProductRead } from "@/types/productos"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/authStore"

const STATUS_META: Record<
  DeliveryNoteStatus,
  { label: string; badge: "warning" | "success" | "error" | "info" | "neutral" }
> = {
  EDICION:  { label: "En edición", badge: "warning" },
  APROBADA: { label: "Aprobada", badge: "success" },
  CANCELADA: { label: "Cancelada", badge: "error" },
}

const fmt = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
})

// ─── Price options helper ────────────────────────────────────────────────────

interface PriceOption {
  label: string
  value: number
  colorClass: string
}

function r2(v: number) {
  return Math.round(v * 100) / 100
}

function buildPriceOptions(product: ProductRead): PriceOption[] {
  const opts: PriceOption[] = []
  // Catálogo = costo_promedio_compra × (1 + margen%) — campo suggested_price del backend
  if (product.suggested_price != null && product.suggested_price > 0)
    opts.push({
      label: "Catálogo",
      value: r2(product.suggested_price),
      colorClass:
        "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100",
    })
  if (product.purchase_cost_ariba != null && product.purchase_cost_ariba > 0)
    opts.push({
      label: "Ariba",
      value: r2(product.purchase_cost_ariba),
      colorClass:
        "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100",
    })
  if (product.purchase_cost_parts != null && product.purchase_cost_parts > 0)
    opts.push({
      label: "Refacciones",
      value: r2(product.purchase_cost_parts),
      colorClass:
        "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
    })
  if (product.unit_price_base != null && product.unit_price_base > 0)
    opts.push({
      label: "Base",
      value: r2(product.unit_price_base),
      colorClass:
        "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200",
    })
  return opts
}

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
  _product?: ProductRead
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
      unit_price: Math.round(it.unit_price * 100) / 100,
      discount_amount: Math.round(it.discount_amount * 100) / 100,
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
    ),
    { cacheKey: `${CACHE_KEYS.NOTAS_REMISION}-${filterStatus}`, staleTime: STALE.MEDIUM },
  )

  const notes = (api.data ?? []) as DeliveryNote[]

  const filteredNotes = notes.filter((n) => {
    if (!filterCustomerSearch.trim()) return true
    const q = filterCustomerSearch.toLowerCase()
    return (
      String(n.customer_id).includes(q) ||
      n.note_number.toLowerCase().includes(q) ||
      (n.customer_po_number ?? "").toLowerCase().includes(q)
    )
  })

  // KPIs
  const kpiTotal = notes.length
  const kpiEdicion = notes.filter((n) => n.status === "EDICION").length
  const kpiAprobadas = notes.filter((n) => n.status === "APROBADA").length
  const kpiMontoTotal = notes.reduce((s, n) => s + n.total, 0)

  const handleStatusChange = async (
    note: DeliveryNote,
    newStatus: "APROBADA" | "CANCELADA"
  ) => {
    setActionLoading(note.delivery_note_id)
    try {
      const payload: {
        status: typeof newStatus
        cancellation_reason?: string
      } = { status: newStatus }
      if (newStatus === "CANCELADA") {
        const reason = window.prompt("Motivo de cancelación:")
        if (!reason) {
          setActionLoading(null)
          return
        }
        payload.cancellation_reason = reason
      }
      await updateDeliveryNote(note.delivery_note_id, payload)
      const labels: Record<string, string> = {
        APROBADA: "Nota aprobada — pedido generado",
        CANCELADA: "Nota de remisión cancelada",
      }
      toast.success(labels[newStatus])
      api.refetch()
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al cambiar estado"
      toast.error(msg)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = (note: DeliveryNote) => {
    if (!canManage) {
      toast.error("No tienes permiso para cancelar notas de remisión")
      return
    }
    void handleStatusChange(note, "CANCELADA")
  }

  const columns: DataTableColumn<DeliveryNote>[] = [
    {
      key: "note_number",
      header: "NR",
      className: "font-mono text-xs font-semibold",
      cell: (r) => r.note_number,
    },
    {
      key: "customer_id",
      header: "Cliente",
      className: "text-xs",
      cell: (r) => `#${r.customer_id}`,
    },
    {
      key: "issue_date",
      header: "Emisión",
      className: "text-xs text-muted-foreground",
      cell: (r) => String(r.issue_date),
    },
    {
      key: "delivery_date",
      header: "Entrega",
      className: "text-xs text-muted-foreground",
      cell: (r) => r.delivery_date ?? "—",
    },
    {
      key: "status",
      header: "Estado",
      cell: (r) => {
        const meta = STATUS_META[r.status] ?? {
          label: r.status,
          badge: "neutral" as const,
        }
        return <StatusBadge variant={meta.badge}>{meta.label}</StatusBadge>
      },
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
      className: "text-right",
      cell: (r) => (
        <span className="font-mono text-xs font-semibold text-emerald-600">
          {fmt.format(r.total)}
        </span>
      ),
    },
    {
      key: "items",
      header: "Partidas",
      className: "text-right",
      cell: (r) => (
        <span className="text-xs text-muted-foreground">{r.items.length}</span>
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
          {canManage && r.status === "EDICION" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-amber-600 hover:text-amber-500"
              onClick={() => setModalMode({ type: "edit", note: r })}
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {canManage && r.status === "EDICION" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-500"
              disabled={actionLoading === r.delivery_note_id}
              onClick={() => void handleStatusChange(r, "APROBADA")}
              title="Aprobar (genera pedido)"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {canManage && ["EDICION", "APROBADA"].includes(r.status) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-red-500 hover:text-red-400"
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
    <div className="space-y-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <FileText className="h-5 w-5 text-amber-500" />
          Notas de Remisión
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={filterCustomerSearch}
              onChange={(e) => setFilterCustomerSearch(e.target.value)}
              placeholder="Buscar NR, cliente, OC…"
              className="h-8 w-full pl-8 text-xs sm:w-56"
            />
          </div>
          <div className="relative">
            <Filter className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background pl-8 pr-6 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
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

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total notas"
          value={String(kpiTotal)}
          icon={Layers}
          tone="blue"
        />
        <KpiCard
          label="En edición"
          value={String(kpiEdicion)}
          icon={AlertCircle}
          tone="orange"
        />
        <KpiCard
          label="Aprobadas"
          value={String(kpiAprobadas)}
          icon={CheckCircle2}
          tone="green"
        />
        <KpiCard
          label="Monto total"
          value={fmt.format(kpiMontoTotal)}
          icon={Banknote}
          tone="purple"
        />
      </div>

      <DataTable
        columns={columns}
        rows={filteredNotes}
        rowKey={(r) => String(r.delivery_note_id)}
        emptyLabel="Sin notas de remisión"
        selectedRowKey={
          expandedNoteId ? String(expandedNoteId) : undefined
        }
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
  const statusMeta = STATUS_META[note.status] ?? {
    label: note.status,
    badge: "neutral" as const,
  }

  const [pdfLoading, setPdfLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [emailTo, setEmailTo] = useState("")

  const handleDownloadPdf = async () => {
    setPdfLoading(true)
    try {
      const { blob, filename } = await downloadDeliveryNotePdf(note.delivery_note_id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("No se pudo generar el PDF")
    } finally {
      setPdfLoading(false)
    }
  }

  const handleSendEmail = async () => {
    if (!emailTo.trim()) return
    setEmailLoading(true)
    try {
      await sendDeliveryNoteEmail(note.delivery_note_id, emailTo.trim())
      toast.success(`NR enviada a ${emailTo.trim()}`)
      setShowEmailInput(false)
      setEmailTo("")
    } catch {
      toast.error("No se pudo enviar el correo")
    } finally {
      setEmailLoading(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-sm">{note.note_number}</CardTitle>
              <StatusBadge variant={statusMeta.badge}>
                {statusMeta.label}
              </StatusBadge>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Cliente #{note.customer_id}</span>
              <span>·</span>
              <span>Emisión: {note.issue_date}</span>
              {note.delivery_date && (
                <>
                  <span>·</span>
                  <span>Entrega: {note.delivery_date}</span>
                </>
              )}
              {note.customer_po_number && (
                <>
                  <span>·</span>
                  <span>OC: {note.customer_po_number}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* PDF download */}
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              disabled={pdfLoading}
              onClick={() => void handleDownloadPdf()}
              title="Descargar PDF"
            >
              {pdfLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">PDF</span>
            </Button>
            {/* Email */}
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setShowEmailInput((v) => !v)}
              title="Enviar por correo"
            >
              <Mail className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Correo</span>
            </Button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Email input row */}
        {showEmailInput && (
          <div className="mt-2 flex items-center gap-2">
            <Input
              type="email"
              placeholder="correo@ejemplo.com"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleSendEmail()}
              className="h-7 flex-1 text-xs"
              autoFocus
            />
            <Button
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={emailLoading || !emailTo.trim()}
              onClick={() => void handleSendEmail()}
            >
              {emailLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Enviar
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-accent/30 p-3">
            <p className="text-muted-foreground">Subtotal</p>
            <p className="mt-0.5 font-mono font-semibold text-foreground">
              {fmt.format(note.subtotal)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-accent/30 p-3">
            <p className="text-muted-foreground">Impuesto</p>
            <p className="mt-0.5 font-mono font-semibold text-foreground">
              {fmt.format(note.tax_amount)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-accent/30 p-3">
            <p className="text-muted-foreground">Total</p>
            <p className="mt-0.5 font-mono font-semibold text-emerald-600">
              {fmt.format(note.total)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-accent/30 p-3">
            <p className="text-muted-foreground">Partidas</p>
            <p className="mt-0.5 font-mono font-semibold text-foreground">
              {note.items.length}
            </p>
          </div>
        </div>

        {note.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-accent/20 p-6 text-center text-sm text-muted-foreground">
            <Package className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2">Sin partidas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">#</th>
                  <th className="pb-2 pr-3 font-medium">Descripción</th>
                  <th className="pb-2 pr-3 text-right font-medium">Cantidad</th>
                  <th className="pb-2 pr-3 text-right font-medium">Precio</th>
                  <th className="pb-2 pr-3 text-right font-medium">Desc.</th>
                  <th className="pb-2 pr-3 text-right font-medium">Subtotal</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {note.items.map((it, idx) => (
                  <tr
                    key={it.item_id}
                    className="border-b border-border/50 transition-colors hover:bg-accent/30"
                  >
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 pr-3">
                      <p className="max-w-[240px] truncate text-foreground">
                        {it.description}
                      </p>
                      {it.sku && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          SKU: {it.sku}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono">
                      {it.quantity.toLocaleString("es-MX")}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-muted-foreground">
                      {fmt.format(it.unit_price)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-muted-foreground">
                      {fmt.format(it.discount_amount)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-foreground">
                      {fmt.format(it.subtotal)}
                    </td>
                    <td className="py-2.5 text-right font-mono font-semibold text-emerald-600">
                      {fmt.format(it.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {note.notes && (
          <div className="flex items-start gap-2 rounded-xl border border-border bg-accent/20 p-3">
            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Notas:</span>{" "}
              {note.notes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Item Product Search Cell ────────────────────────────────────────────────

function ItemProductCell({
  item,
  token,
  onProductSelect,
  onProductClear,
  onDescriptionChange,
  onNotesChange,
  onPriceSelect,
}: {
  item: FormItem
  token: string | null
  onProductSelect: (product: ProductRead) => void
  onProductClear: () => void
  onDescriptionChange: (desc: string) => void
  onNotesChange: (notes: string) => void
  onPriceSelect: (price: number) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ProductRead[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useLayoutEffect(() => {
    function updatePos() {
      if (open && searchInputRef.current) {
        const rect = searchInputRef.current.getBoundingClientRect()
        setDropdownPos({
          top: rect.bottom + 4,
          left: rect.left,
          width: Math.max(rect.width, 320),
        })
      } else {
        setDropdownPos(null)
      }
    }
    updatePos()
    if (open) {
      window.addEventListener("scroll", updatePos, true)
      window.addEventListener("resize", updatePos)
      return () => {
        window.removeEventListener("scroll", updatePos, true)
        window.removeEventListener("resize", updatePos)
      }
    }
  }, [open, results])

  function handleQueryChange(q: string) {
    setQuery(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (q.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await productosService.listProducts(token, {
          search: q.trim(),
          limit: 10,
          solo_activos: true,
        })
        setResults(res.items)
        setOpen(res.items.length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  function selectProduct(p: ProductRead) {
    setQuery("")
    setResults([])
    setOpen(false)
    onProductSelect(p)
  }

  const priceOptions = item._product ? buildPriceOptions(item._product) : []

  if (item._product) {
    return (
      <div className="space-y-2">
        {/* Product chip */}
        <div className="flex items-start gap-2 rounded-md border border-violet-500/30 bg-violet-500/10 px-3 py-2">
          <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">
              {item._product.name}
            </p>
            {item._product.sku && (
              <p className="font-mono text-[10px] text-muted-foreground">
                {item._product.sku}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onProductClear}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Desvincular producto"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Description override */}
        <Input
          className="h-8 text-xs"
          value={item.description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Descripción en la partida"
        />

        {/* Price picker */}
        {priceOptions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Precio a cobrar
            </p>
            <div className="flex flex-wrap gap-1.5">
              {priceOptions.map((opt) => {
                const isActive = Math.abs(item.unit_price - opt.value) < 0.001
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => onPriceSelect(opt.value)}
                    className={cn(
                      "rounded border px-2 py-1 text-[10px] font-medium transition-all",
                      opt.colorClass,
                      isActive && "ring-1 ring-black/20 brightness-95"
                    )}
                    title={`Aplicar ${opt.label}`}
                  >
                    {opt.label}: {fmt.format(opt.value)}
                    {isActive && " ✓"}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        <Input
          className="h-7 text-[11px]"
          value={item.notes ?? ""}
          onChange={(e) => onNotesChange(e.target.value || "")}
          placeholder="Notas de partida"
        />
      </div>
    )
  }

  return (
    <div className="space-y-2" ref={wrapRef}>
      {/* Description (free text, doubles as search trigger) */}
      <Input
        className="h-9 text-xs"
        value={item.description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Descripción del producto / servicio"
      />

      {/* Product search field */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          className="h-8 pl-8 text-[11px]"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Buscar por SKU o nombre del catálogo…"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Fixed dropdown overlay */}
      {open && results.length > 0 && dropdownPos && (
        <ul
          className="fixed z-[100] max-h-60 overflow-auto rounded-lg border border-border bg-white shadow-2xl"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
          }}
        >
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectProduct(p)
                }}
                className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-slate-100"
              >
                <div className="flex items-center gap-2">
                  {p.sku && (
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">
                      {p.sku}
                    </span>
                  )}
                  <span className="truncate text-xs text-slate-900">
                    {p.name}
                  </span>
                </div>
                {(p.brand ?? p.category) && (
                  <span className="text-[10px] text-slate-500">
                    {[p.brand, p.category].filter(Boolean).join(" · ")}
                  </span>
                )}
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {p.unit_price != null && p.unit_price > 0 && (
                    <span className="rounded border border-violet-200 bg-violet-50 px-1 text-[9px] text-violet-700">
                      Catálogo: {fmt.format(p.unit_price)}
                    </span>
                  )}
                  {p.purchase_cost_ariba != null &&
                    p.purchase_cost_ariba > 0 && (
                      <span className="rounded border border-blue-200 bg-blue-50 px-1 text-[9px] text-blue-700">
                        Ariba: {fmt.format(p.purchase_cost_ariba)}
                      </span>
                    )}
                  {p.purchase_cost_parts != null &&
                    p.purchase_cost_parts > 0 && (
                      <span className="rounded border border-amber-200 bg-amber-50 px-1 text-[9px] text-amber-700">
                        Refacc: {fmt.format(p.purchase_cost_parts)}
                      </span>
                    )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Notes */}
      <Input
        className="h-7 text-[11px]"
        value={item.notes ?? ""}
        onChange={(e) => onNotesChange(e.target.value || "")}
        placeholder="Notas de partida"
      />
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

  const [customerSearch, setCustomerSearch] = useState("")
  const [customerResults, setCustomerResults] = useState<CustomerRead[]>([])
  const [customerSelected, setCustomerSelected] = useState<CustomerRead | null>(
    null
  )
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(
    null
  )
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (mode) {
      setForm(existing ? noteToForm(existing) : EMPTY_FORM)
      setError(null)
      setCustomerSearch("")
      setCustomerResults([])
      setCustomerDetail(null)
      if (existing) {
        setCustomerSelected({
          customer_id: existing.customer_id,
          business_name: `Cliente #${existing.customer_id}`,
        } as CustomerRead)
        // Cargar detalle del cliente en edición
        clientesProveedoresService
          .getCustomer(token, existing.customer_id)
          .then((d) => setCustomerDetail(d))
          .catch(() => setCustomerDetail(null))
      } else {
        setCustomerSelected(null)
      }
    }
  }, [mode, existing, token])

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
    // Cargar detalle completo del cliente
    clientesProveedoresService
      .getCustomer(token, c.customer_id)
      .then((d) => setCustomerDetail(d))
      .catch(() => setCustomerDetail(null))
  }

  function clearCustomer() {
    setCustomerSelected(null)
    setCustomerDetail(null)
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
      setError("La fecha de emisión es obligatoria")
      return
    }
    if (form.items.length === 0) {
      setError("Agrega al menos una partida")
      return
    }
    for (const it of form.items) {
      if (!it.description.trim()) {
        setError("Todas las partidas deben tener descripción")
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
        await updateDeliveryNote(existing.delivery_note_id, payload)
        toast.success("Nota de remisión actualizada")
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
        toast.success("Nota de remisión creada")
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
      <div className="relative z-10 flex h-full items-start justify-center overflow-y-auto p-2 sm:p-4 md:p-6">
        <div className="relative z-10 mb-4 w-full max-w-5xl space-y-5 rounded-2xl border bg-card p-4 shadow-soft-lg sm:p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold">
                  {isEdit
                    ? "Editar Nota de Remisión"
                    : "Nueva Nota de Remisión"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isEdit
                    ? existing?.note_number
                    : "Documento informal de entrega"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="mt-0.5 shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* General data */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  Datos generales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Cliente */}
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                    <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      Cliente <span className="text-red-400">*</span>
                    </label>
                    {isEdit ? (
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-accent/30 px-3 py-2.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm text-foreground">
                          Cliente #{existing?.customer_id}
                        </span>
                      </div>
                    ) : customerSelected ? (
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-accent/30 px-3 py-2.5">
                        {customerSelected.code && (
                          <span className="shrink-0 rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-violet-400">
                            {customerSelected.code}
                          </span>
                        )}
                        <span className="flex-1 text-sm text-foreground">
                          {customerSelected.business_name}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          #{customerSelected.customer_id}
                        </span>
                        <button
                          type="button"
                          onClick={clearCustomer}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          className="pl-9"
                          value={customerSearch}
                          onChange={(e) =>
                            handleCustomerSearch(e.target.value)
                          }
                          placeholder="Buscar cliente por nombre…"
                        />
                        {customerResults.length > 0 && (
                          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-white shadow-xl">
                            {customerResults.map((c) => (
                              <li key={c.customer_id}>
                                <button
                                  type="button"
                                  onClick={() => selectCustomer(c)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100"
                                >
                                  {c.code && (
                                    <span className="shrink-0 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-violet-700">
                                      {c.code}
                                    </span>
                                  )}
                                  <span className="flex-1 truncate text-sm text-slate-900">
                                    {c.business_name}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Customer detail card */}
                    {customerDetail && (
                      <div className="rounded-lg border border-border bg-accent/20 p-3 sm:col-span-2 lg:col-span-3">
                        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                          {customerDetail.contacts &&
                            customerDetail.contacts.length > 0 && (
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Contacto
                                </span>
                                <p className="text-foreground">
                                  {customerDetail.contacts.find(
                                    (c) => c.is_primary
                                  )?.full_name ??
                                    customerDetail.contacts[0].full_name}
                                </p>
                                {(() => {
                                  const primary =
                                    customerDetail.contacts!.find(
                                      (c) => c.is_primary
                                    ) ?? customerDetail.contacts![0]
                                  return (
                                    <>
                                      {primary.role_title && (
                                        <p className="text-muted-foreground">
                                          {primary.role_title}
                                        </p>
                                      )}
                                      {primary.phone && (
                                        <p className="text-muted-foreground">
                                          {primary.phone}
                                        </p>
                                      )}
                                      {primary.email && (
                                        <p className="text-muted-foreground">
                                          {primary.email}
                                        </p>
                                      )}
                                    </>
                                  )
                                })()}
                              </div>
                            )}
                          {customerDetail.addresses &&
                            customerDetail.addresses.length > 0 && (
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Dirección
                                </span>
                                <p className="text-foreground">
                                  {customerDetail.addresses.find(
                                    (a) => a.is_default
                                  )?.street ??
                                    customerDetail.addresses[0].street}
                                </p>
                                {(() => {
                                  const addr =
                                    customerDetail.addresses!.find(
                                      (a) => a.is_default
                                    ) ?? customerDetail.addresses![0]
                                  return (
                                    <>
                                      {[
                                        addr.neighborhood,
                                        addr.city,
                                        addr.state,
                                      ]
                                        .filter(Boolean)
                                        .join(", ") && (
                                        <p className="text-muted-foreground">
                                          {[
                                            addr.neighborhood,
                                            addr.city,
                                            addr.state,
                                          ]
                                            .filter(Boolean)
                                            .join(", ")}
                                        </p>
                                      )}
                                      {addr.zip_code && (
                                        <p className="text-muted-foreground">
                                          CP {addr.zip_code}
                                        </p>
                                      )}
                                      {addr.country && (
                                        <p className="text-muted-foreground">
                                          {addr.country}
                                        </p>
                                      )}
                                    </>
                                  )
                                })()}
                              </div>
                            )}
                          {customerDetail.tax_data &&
                            customerDetail.tax_data.length > 0 && (
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Datos fiscales
                                </span>
                                <p className="text-foreground">
                                  {customerDetail.tax_data[0].legal_name}
                                </p>
                                <p className="font-mono text-muted-foreground">
                                  {customerDetail.tax_data[0].rfc}
                                </p>
                              </div>
                            )}
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Info comercial
                            </span>
                            <p className="text-foreground">
                              Tipo: {customerDetail.customer_type}
                            </p>
                            <p className="text-muted-foreground">
                              Localidad: {customerDetail.locality}
                            </p>
                            <p className="text-muted-foreground">
                              Plazo: {customerDetail.payment_terms_days} días
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      Fecha de emisión <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="date"
                      required
                      disabled={isEdit}
                      value={form.issue_date}
                      onChange={(e) => set("issue_date", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <Hash className="h-3 w-3" />
                      OC Cliente
                    </label>
                    <Input
                      value={form.customer_po_number}
                      onChange={(e) =>
                        set("customer_po_number", e.target.value)
                      }
                      placeholder="Número de orden de compra"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      Fecha OC
                    </label>
                    <Input
                      type="date"
                      value={form.customer_po_date}
                      onChange={(e) =>
                        set("customer_po_date", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                    <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <StickyNote className="h-3 w-3" />
                      Notas
                    </label>
                    <textarea
                      className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-soft-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                      rows={2}
                      value={form.notes}
                      onChange={(e) => set("notes", e.target.value)}
                      placeholder="Observaciones generales…"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Package className="h-3.5 w-3.5" />
                    Partidas
                    <Badge variant="secondary" className="text-[10px]">
                      {form.items.length}
                    </Badge>
                  </CardTitle>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={addItem}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar partida
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {form.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-accent/20 p-8 text-center">
                    <Package className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No hay partidas.
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Presiona "Agregar partida" para comenzar.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden overflow-x-auto lg:block">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border text-left text-muted-foreground">
                            <th className="w-8 pb-2 pr-2">#</th>
                            <th className="min-w-[240px] pb-2 pr-2">
                              Producto / Descripción *
                            </th>
                            <th className="w-24 pb-2 pr-2">Cant. *</th>
                            <th className="w-28 pb-2 pr-2">Precio *</th>
                            <th className="w-24 pb-2 pr-2">Descuento</th>
                            <th className="w-20 pb-2 pr-2">IVA %</th>
                            <th className="w-24 pb-2 pr-2 text-right">
                              Subtotal
                            </th>
                            <th className="w-8 pb-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.items.map((it, idx) => {
                            const lineSub =
                              it.quantity * it.unit_price - it.discount_amount
                            return (
                              <tr
                                key={it.key}
                                className="border-b border-border/50 align-top transition-colors hover:bg-accent/20"
                              >
                                <td className="py-2.5 pr-2 text-muted-foreground">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 pr-2">
                                  <ItemProductCell
                                    item={it}
                                    token={token}
                                    onProductSelect={(p) =>
                                      updateItem(it.key, {
                                        _product: p,
                                        product_id: p.id,
                                        sku: p.sku ?? undefined,
                                        description: p.name,
                                        unit_price: r2(
                                          p.suggested_price ??
                                          p.unit_price ??
                                          p.purchase_cost_ariba ??
                                          p.purchase_cost_parts ??
                                          0
                                        ),
                                      })
                                    }
                                    onProductClear={() =>
                                      updateItem(it.key, {
                                        _product: undefined,
                                        product_id: undefined,
                                        sku: undefined,
                                      })
                                    }
                                    onDescriptionChange={(desc) =>
                                      updateItem(it.key, {
                                        description: desc,
                                      })
                                    }
                                    onNotesChange={(notes) =>
                                      updateItem(it.key, {
                                        notes: notes || undefined,
                                      })
                                    }
                                    onPriceSelect={(price) =>
                                      updateItem(it.key, {
                                        unit_price:
                                          Math.round(price * 100) / 100,
                                      })
                                    }
                                  />
                                </td>
                                <td className="py-2.5 pr-2">
                                  <Input
                                    type="number"
                                    min={0.0001}
                                    step="any"
                                    className="h-8 text-xs"
                                    value={it.quantity}
                                    onChange={(e) =>
                                      updateItem(it.key, {
                                        quantity:
                                          parseFloat(e.target.value) || 0,
                                      })
                                    }
                                  />
                                </td>
                                <td className="py-2.5 pr-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step="any"
                                    className="h-8 text-xs"
                                    value={it.unit_price}
                                    onChange={(e) =>
                                      updateItem(it.key, {
                                        unit_price:
                                          Math.round(
                                            (parseFloat(e.target.value) || 0) *
                                              100
                                          ) / 100,
                                      })
                                    }
                                  />
                                </td>
                                <td className="py-2.5 pr-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step="any"
                                    className="h-8 text-xs"
                                    value={it.discount_amount}
                                    onChange={(e) =>
                                      updateItem(it.key, {
                                        discount_amount:
                                          Math.round(
                                            (parseFloat(e.target.value) || 0) *
                                              100
                                          ) / 100,
                                      })
                                    }
                                  />
                                </td>
                                <td className="py-2.5 pr-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step="any"
                                    className="h-8 text-xs"
                                    value={it.tax_rate}
                                    onChange={(e) =>
                                      updateItem(it.key, {
                                        tax_rate:
                                          parseFloat(e.target.value) || 0,
                                      })
                                    }
                                  />
                                </td>
                                <td className="py-2.5 pr-2 text-right font-mono">
                                  {fmt.format(lineSub)}
                                </td>
                                <td className="py-2.5">
                                  <button
                                    type="button"
                                    onClick={() => removeItem(it.key)}
                                    className="rounded p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
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

                    {/* Mobile / tablet cards */}
                    <div className="space-y-3 lg:hidden">
                      {form.items.map((it, idx) => {
                        const lineSub =
                          it.quantity * it.unit_price - it.discount_amount
                        return (
                          <div
                            key={it.key}
                            className="rounded-xl border border-border bg-accent/20 p-3.5 sm:p-4"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <Badge
                                variant="outline"
                                className="h-5 text-[10px]"
                              >
                                Partida {idx + 1}
                              </Badge>
                              <button
                                type="button"
                                onClick={() => removeItem(it.key)}
                                className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                                title="Eliminar partida"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="mb-3">
                              <ItemProductCell
                                item={it}
                                token={token}
                                onProductSelect={(p) =>
                                  updateItem(it.key, {
                                    _product: p,
                                    product_id: p.id,
                                    sku: p.sku ?? undefined,
                                    description: p.name,
                                    unit_price:
                                      p.unit_price ??
                                      p.purchase_cost_ariba ??
                                      p.purchase_cost_parts ??
                                      0,
                                  })
                                }
                                onProductClear={() =>
                                  updateItem(it.key, {
                                    _product: undefined,
                                    product_id: undefined,
                                    sku: undefined,
                                  })
                                }
                                onDescriptionChange={(desc) =>
                                  updateItem(it.key, {
                                    description: desc,
                                  })
                                }
                                onNotesChange={(notes) =>
                                  updateItem(it.key, {
                                    notes: notes || undefined,
                                  })
                                }
                                onPriceSelect={(price) =>
                                  updateItem(it.key, {
                                    unit_price: price,
                                  })
                                }
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              <div className="space-y-1">
                                <label className="text-[10px] font-medium text-muted-foreground">
                                  Cantidad *
                                </label>
                                <Input
                                  type="number"
                                  min={0.0001}
                                  step="any"
                                  className="h-8 text-xs"
                                  value={it.quantity}
                                  onChange={(e) =>
                                    updateItem(it.key, {
                                      quantity:
                                        parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-medium text-muted-foreground">
                                  Precio *
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className="h-8 text-xs"
                                  value={it.unit_price}
                                  onChange={(e) =>
                                    updateItem(it.key, {
                                      unit_price:
                                        parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-medium text-muted-foreground">
                                  Descuento
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className="h-8 text-xs"
                                  value={it.discount_amount}
                                  onChange={(e) =>
                                    updateItem(it.key, {
                                      discount_amount:
                                        parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-medium text-muted-foreground">
                                  IVA %
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className="h-8 text-xs"
                                  value={it.tax_rate}
                                  onChange={(e) =>
                                    updateItem(it.key, {
                                      tax_rate:
                                        parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/50 pt-2.5">
                              <span className="text-[10px] text-muted-foreground">
                                Subtotal
                              </span>
                              <span className="font-mono text-sm font-semibold">
                                {fmt.format(lineSub)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {/* Totals */}
                <div className="flex flex-col items-stretch gap-3 pt-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calculator className="h-3.5 w-3.5" />
                    <span>
                      {form.items.length}{" "}
                      {form.items.length === 1 ? "partida" : "partidas"}
                    </span>
                  </div>

                  <div className="w-full sm:w-auto sm:min-w-[280px]">
                    <div className="rounded-xl border border-border bg-accent/20 p-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Subtotal
                          </span>
                          <span className="font-mono">
                            {fmt.format(subtotal)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Impuesto
                          </span>
                          <span className="font-mono">{fmt.format(tax)}</span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2">
                          <span className="font-medium">Total estimado</span>
                          <span className="font-mono font-semibold text-emerald-600">
                            {fmt.format(total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto"
              >
                {saving && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {isEdit ? "Guardar cambios" : "Crear Nota de Remisión"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
