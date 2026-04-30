import React, { useCallback, useState } from "react"
import {
  CheckCircle2,
  DollarSign,
  MapPin,
  Package,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Truck,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/useApi"
import { usePermission } from "@/hooks/usePermission"
import { clientesProveedoresService } from "@/services/clientesProveedoresService"
import { useAuthStore } from "@/stores/authStore"
import type {
  SupplierAddress,
  SupplierAddressCreate,
  SupplierContactCreate,
  SupplierDetail,
  SupplierProduct,
  SupplierRead,
  SupplierTaxDataCreate,
} from "@/types/clientesProveedores"
import { cn } from "@/lib/utils"

// ─── Shared badge components ──────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        active
          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
          : "border-red-500/30 bg-red-500/15 text-red-400"
      )}
    >
      {active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {active ? "Activo" : "Inactivo"}
    </span>
  )
}

function SupplierTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    GOODS: { label: "Bienes", cls: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
    SERVICES: {
      label: "Servicios",
      cls: "border-violet-500/30 bg-violet-500/10 text-violet-400",
    },
    BOTH: { label: "Mixto", cls: "border-teal-500/30 bg-teal-500/10 text-teal-400" },
  }
  const { label, cls } = map[type] ?? { label: type, cls: "border-border bg-muted/60" }
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", cls)}>
      {label}
    </span>
  )
}

function LocalityBadge({ locality }: { locality: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        locality === "LOCAL"
          ? "border-violet-500/30 bg-violet-500/10 text-violet-400"
          : "border-amber-500/30 bg-amber-500/10 text-amber-400"
      )}
    >
      {locality === "LOCAL" ? "Nacional" : "Extranjero"}
    </span>
  )
}

const inputCls =
  "w-full rounded-[var(--radius-md)] border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"

// ─── Price update modal ────────────────────────────────────────────────────

type PriceModalProps = {
  product: SupplierProduct
  supplierId: number
  token: string | null
  onClose: () => void
  onUpdated: () => void
}

function PriceUpdateModal({ product, supplierId, token, onClose, onUpdated }: PriceModalProps) {
  const [unitCost, setUnitCost] = useState(String(product.unit_cost))
  const [supplierSku, setSupplierSku] = useState(product.supplier_sku ?? "")
  const [leadTime, setLeadTime] = useState(String(product.lead_time_days ?? ""))
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    const cost = parseFloat(unitCost)
    if (isNaN(cost) || cost < 0) {
      toast.error("Costo inválido")
      return
    }
    setSubmitting(true)
    try {
      await clientesProveedoresService.updateSupplierProductPrice(
        token,
        supplierId,
        product.supplier_product_id,
        {
          unit_cost: cost,
          supplier_sku: supplierSku || null,
          lead_time_days: leadTime ? parseInt(leadTime) : null,
        }
      )
      toast.success("Precio actualizado")
      onUpdated()
      onClose()
    } catch {
      toast.error("Error al actualizar precio")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="surface-card relative z-10 w-full max-w-sm space-y-5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Actualizar precio</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="rounded-[var(--radius-md)] bg-accent/30 px-3 py-2 text-xs text-muted-foreground">
          Precio actual:{" "}
          <span className="font-semibold text-foreground">
            {product.currency} ${Number(product.unit_cost).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Nuevo costo unitario *
            </label>
            <input
              className={inputCls}
              type="number"
              min={0}
              step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              SKU proveedor
            </label>
            <input
              className={inputCls}
              placeholder="SKU del proveedor"
              value={supplierSku}
              onChange={(e) => setSupplierSku(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Tiempo de entrega (días)
            </label>
            <input
              className={inputCls}
              type="number"
              min={0}
              max={365}
              value={leadTime}
              onChange={(e) => setLeadTime(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !unitCost}>
            Guardar precio
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Supplier detail panel ─────────────────────────────────────────────────

// ─── Shared address inline form ──────────────────────────────────────────

function SupplierAddressInlineForm({
  title,
  form,
  setForm,
  typeOptions,
  submitting,
  onSave,
  onCancel,
}: {
  title: string
  form: SupplierAddressCreate
  setForm: React.Dispatch<React.SetStateAction<SupplierAddressCreate>>
  typeOptions: { value: string; label: string }[]
  submitting: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-dashed p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Tipo</label>
          <select
            className={inputCls}
            value={form.address_type}
            onChange={(e) => setForm((p) => ({ ...p, address_type: e.target.value as "PICKUP" | "OTHER" }))}
          >
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Etiqueta</label>
          <input
            className={inputCls}
            placeholder="Ej. Bodega Principal"
            value={form.label ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
          />
        </div>
      </div>
      <input
        className={inputCls}
        placeholder="Calle *"
        value={form.street}
        onChange={(e) => setForm((p) => ({ ...p, street: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <input className={inputCls} placeholder="No. exterior" value={form.exterior_number ?? ""} onChange={(e) => setForm((p) => ({ ...p, exterior_number: e.target.value }))} />
        <input className={inputCls} placeholder="No. interior" value={form.interior_number ?? ""} onChange={(e) => setForm((p) => ({ ...p, interior_number: e.target.value }))} />
      </div>
      <input className={inputCls} placeholder="Colonia" value={form.neighborhood ?? ""} onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))} />
      <div className="grid grid-cols-2 gap-2">
        <input className={inputCls} placeholder="Ciudad" value={form.city ?? ""} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
        <input className={inputCls} placeholder="Estado" value={form.state ?? ""} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className={inputCls} placeholder="CP" value={form.zip_code ?? ""} onChange={(e) => setForm((p) => ({ ...p, zip_code: e.target.value }))} />
        <input className={inputCls} placeholder="País" value={form.country ?? "México"} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.is_default ?? false}
          onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))}
          className="h-4 w-4"
        />
        Dirección principal
      </label>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={submitting || !form.street}>
          Guardar
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

type SupplierTab = "fiscal" | "direcciones" | "contactos" | "catalogo"

type DetailPanelProps = {
  detail: SupplierDetail
  canManage: boolean
  token: string | null
  onClose: () => void
  onUpdated: () => void
  onEdit: () => void
}

function SupplierDetailPanel({ detail, canManage, token, onClose, onUpdated, onEdit }: DetailPanelProps) {
  const [tab, setTab] = useState<SupplierTab>("fiscal")
  const [showTaxForm, setShowTaxForm] = useState(false)
  const [editingTaxId, setEditingTaxId] = useState<number | null>(null)
  const [showContactForm, setShowContactForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [priceProduct, setPriceProduct] = useState<SupplierProduct | null>(null)

  const [taxForm, setTaxForm] = useState<SupplierTaxDataCreate>({
    rfc: "",
    legal_name: "",
    zip_code: "",
    is_default: true,
  })
  const [editTaxForm, setEditTaxForm] = useState<SupplierTaxDataCreate>({
    rfc: "",
    legal_name: "",
    zip_code: "",
    is_default: true,
  })
  const [contactForm, setContactForm] = useState({
    full_name: "",
    role_title: "",
    email: "",
    phone: "",
    is_primary: false,
  })

  const [showAddressForm, setShowAddressForm] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null)
  const emptyAddress: SupplierAddressCreate = {
    address_type: "PICKUP",
    label: "",
    street: "",
    exterior_number: "",
    interior_number: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "México",
    zip_code: "",
    is_default: false,
  }
  const [addressForm, setAddressForm] = useState<SupplierAddressCreate>(emptyAddress)
  const [editAddressForm, setEditAddressForm] = useState<SupplierAddressCreate>(emptyAddress)

  const [editingContactId, setEditingContactId] = useState<number | null>(null)
  const [editContactForm, setEditContactForm] = useState<SupplierContactCreate>({
    full_name: "",
    role_title: "",
    email: "",
    phone: "",
    is_primary: false,
  })

  function startEditAddress(addr: SupplierAddress) {
    setEditingAddressId(addr.address_id)
    setEditAddressForm({
      address_type: addr.address_type as "PICKUP" | "OTHER",
      label: addr.label ?? "",
      street: addr.street,
      exterior_number: addr.exterior_number ?? "",
      interior_number: addr.interior_number ?? "",
      neighborhood: addr.neighborhood ?? "",
      city: addr.city ?? "",
      state: addr.state ?? "",
      country: addr.country,
      zip_code: addr.zip_code ?? "",
      is_default: addr.is_default,
    })
    setShowAddressForm(false)
  }

  async function handleUpdateAddress() {
    if (editingAddressId == null) return
    setSubmitting(true)
    try {
      await clientesProveedoresService.updateSupplierAddress(token, detail.supplier_id, editingAddressId, {
        ...editAddressForm,
        label: editAddressForm.label || null,
        exterior_number: editAddressForm.exterior_number || null,
        interior_number: editAddressForm.interior_number || null,
        neighborhood: editAddressForm.neighborhood || null,
        city: editAddressForm.city || null,
        state: editAddressForm.state || null,
        zip_code: editAddressForm.zip_code || null,
      })
      toast.success("Dirección actualizada")
      setEditingAddressId(null)
      onUpdated()
    } catch {
      toast.error("Error al actualizar dirección")
    } finally {
      setSubmitting(false)
    }
  }

  function startEditContact(c: { contact_id: number; full_name: string; role_title: string | null; email: string | null; phone: string | null; is_primary: boolean }) {
    setEditingContactId(c.contact_id)
    setEditContactForm({
      full_name: c.full_name,
      role_title: c.role_title ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      is_primary: c.is_primary,
    })
    setShowContactForm(false)
  }

  async function handleUpdateContact() {
    if (editingContactId == null) return
    setSubmitting(true)
    try {
      await clientesProveedoresService.updateSupplierContact(token, detail.supplier_id, editingContactId, {
        full_name: editContactForm.full_name,
        role_title: editContactForm.role_title || null,
        email: editContactForm.email || null,
        phone: editContactForm.phone || null,
        is_primary: editContactForm.is_primary,
      })
      toast.success("Contacto actualizado")
      setEditingContactId(null)
      onUpdated()
    } catch {
      toast.error("Error al actualizar contacto")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddAddress() {
    setSubmitting(true)
    try {
      await clientesProveedoresService.addSupplierAddress(token, detail.supplier_id, {
        ...addressForm,
        label: addressForm.label || null,
        exterior_number: addressForm.exterior_number || null,
        interior_number: addressForm.interior_number || null,
        neighborhood: addressForm.neighborhood || null,
        city: addressForm.city || null,
        state: addressForm.state || null,
        zip_code: addressForm.zip_code || null,
      })
      toast.success("Dirección agregada")
      setShowAddressForm(false)
      setAddressForm(emptyAddress)
      onUpdated()
    } catch {
      toast.error("Error al guardar dirección")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteAddress(addressId: number) {
    setSubmitting(true)
    try {
      await clientesProveedoresService.deleteSupplierAddress(token, detail.supplier_id, addressId)
      toast.success("Dirección eliminada")
      onUpdated()
    } catch {
      toast.error("Error al eliminar dirección")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddTaxData() {
    setSubmitting(true)
    try {
      await clientesProveedoresService.addSupplierTaxData(token, detail.supplier_id, taxForm)
      toast.success("Datos fiscales agregados")
      setShowTaxForm(false)
      setTaxForm({ rfc: "", legal_name: "", zip_code: "", is_default: true })
      onUpdated()
    } catch {
      toast.error("Error al guardar datos fiscales")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddContact() {
    setSubmitting(true)
    try {
      await clientesProveedoresService.addSupplierContact(token, detail.supplier_id, {
        full_name: contactForm.full_name,
        role_title: contactForm.role_title || null,
        email: contactForm.email || null,
        phone: contactForm.phone || null,
        is_primary: contactForm.is_primary,
      })
      toast.success("Contacto agregado")
      setShowContactForm(false)
      setContactForm({ full_name: "", role_title: "", email: "", phone: "", is_primary: false })
      onUpdated()
    } catch {
      toast.error("Error al guardar contacto")
    } finally {
      setSubmitting(false)
    }
  }

  function startEditTax(td: { tax_data_id: number; rfc: string; legal_name: string; zip_code: string; is_default: boolean }) {
    setEditTaxForm({
      rfc: td.rfc,
      legal_name: td.legal_name,
      zip_code: td.zip_code,
      is_default: td.is_default,
    })
    setEditingTaxId(td.tax_data_id)
  }

  async function handleUpdateTaxData() {
    if (editingTaxId == null) return
    setSubmitting(true)
    try {
      await clientesProveedoresService.updateSupplierTaxData(
        token,
        detail.supplier_id,
        editingTaxId,
        editTaxForm
      )
      toast.success("Datos fiscales actualizados")
      setEditingTaxId(null)
      onUpdated()
    } catch {
      toast.error("Error al actualizar datos fiscales")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteContact(contactId: number) {
    setSubmitting(true)
    try {
      await clientesProveedoresService.deleteSupplierContact(token, detail.supplier_id, contactId)
      toast.success("Contacto eliminado")
      onUpdated()
    } catch {
      toast.error("Error al eliminar contacto")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive() {
    setSubmitting(true)
    try {
      await clientesProveedoresService.updateSupplier(token, detail.supplier_id, {
        is_active: !detail.is_active,
      })
      toast.success(detail.is_active ? "Proveedor desactivado" : "Proveedor activado")
      onUpdated()
    } catch {
      toast.error("Error al actualizar estado")
    } finally {
      setSubmitting(false)
    }
  }

  const tabs: [SupplierTab, string][] = [
    ["fiscal", "Datos Fiscales"],
    ["direcciones", "Direcciones"],
    ["contactos", "Contactos"],
    ["catalogo", `Catálogo${detail.current_products.length > 0 ? ` (${detail.current_products.length})` : ""}`],
  ]

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{detail.code}</span>
              <SupplierTypeBadge type={detail.supplier_type} />
              <LocalityBadge locality={detail.locality} />
              {detail.is_occasional && (
                <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-400">
                  Ocasional
                </span>
              )}
            </div>
            <h2 className="mt-1 truncate text-base font-semibold">{detail.business_name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge active={detail.is_active} />
              <span>{detail.currency}</span>
              {detail.payment_terms_days > 0 && (
                <span>{detail.payment_terms_days}d plazo</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManage && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEdit}
                  className="h-7 gap-1 text-xs"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleActive}
                  disabled={submitting}
                  className="h-7 text-xs"
                >
                  {detail.is_active ? "Desactivar" : "Activar"}
                </Button>
              </>
            )}
            <button
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-5">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {tab === "fiscal" && (
            <>
              {detail.tax_data.length === 0 && !showTaxForm && (
                <p className="text-sm text-muted-foreground">Sin datos fiscales registrados.</p>
              )}
              {detail.tax_data.map((td) => (
                <div key={td.tax_data_id} className="rounded-[var(--radius-md)] border bg-accent/20 p-4">
                  {editingTaxId === td.tax_data_id ? (
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Editar RFC
                      </p>
                      <input
                        className={inputCls}
                        placeholder="RFC (12 o 13 caracteres)"
                        maxLength={13}
                        value={editTaxForm.rfc}
                        onChange={(e) =>
                          setEditTaxForm((p) => ({ ...p, rfc: e.target.value.toUpperCase() }))
                        }
                      />
                      <input
                        className={inputCls}
                        placeholder="Razón social fiscal"
                        value={editTaxForm.legal_name}
                        onChange={(e) =>
                          setEditTaxForm((p) => ({ ...p, legal_name: e.target.value }))
                        }
                      />
                      <input
                        className={inputCls}
                        placeholder="Código Postal"
                        maxLength={10}
                        value={editTaxForm.zip_code}
                        onChange={(e) =>
                          setEditTaxForm((p) => ({ ...p, zip_code: e.target.value }))
                        }
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleUpdateTaxData}
                          disabled={
                            submitting ||
                            editTaxForm.rfc.length < 12 ||
                            !editTaxForm.legal_name ||
                            !editTaxForm.zip_code
                          }
                        >
                          Guardar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingTaxId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{td.rfc}</span>
                          {td.is_default && (
                            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              Principal
                            </span>
                          )}
                        </div>
                        <p className="text-sm">{td.legal_name}</p>
                        <p className="text-xs text-muted-foreground">CP: {td.zip_code}</p>
                      </div>
                      {canManage && (
                        <button
                          onClick={() => startEditTax(td)}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Editar RFC"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {showTaxForm && (
                <div className="space-y-3 rounded-[var(--radius-md)] border border-dashed p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Agregar RFC
                  </p>
                  <input
                    className={inputCls}
                    placeholder="RFC (12 o 13 caracteres)"
                    maxLength={13}
                    value={taxForm.rfc}
                    onChange={(e) =>
                      setTaxForm((p) => ({ ...p, rfc: e.target.value.toUpperCase() }))
                    }
                  />
                  <input
                    className={inputCls}
                    placeholder="Razón social fiscal"
                    value={taxForm.legal_name}
                    onChange={(e) => setTaxForm((p) => ({ ...p, legal_name: e.target.value }))}
                  />
                  <input
                    className={inputCls}
                    placeholder="Código Postal"
                    maxLength={10}
                    value={taxForm.zip_code}
                    onChange={(e) => setTaxForm((p) => ({ ...p, zip_code: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleAddTaxData}
                      disabled={
                        submitting ||
                        taxForm.rfc.length < 12 ||
                        !taxForm.legal_name ||
                        !taxForm.zip_code
                      }
                    >
                      Guardar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowTaxForm(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
              {canManage && !showTaxForm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTaxForm(true)}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar RFC
                </Button>
              )}
            </>
          )}

          {tab === "direcciones" && (
            <>
              {detail.addresses.length === 0 && !showAddressForm && (
                <p className="text-sm text-muted-foreground">Sin direcciones registradas.</p>
              )}
              {detail.addresses.map((addr: SupplierAddress) =>
                editingAddressId === addr.address_id ? (
                  <SupplierAddressInlineForm
                    key={addr.address_id}
                    title="Editar dirección"
                    form={editAddressForm}
                    setForm={setEditAddressForm}
                    typeOptions={[
                      { value: "PICKUP", label: "Recolección" },
                      { value: "OTHER", label: "Otra" },
                    ]}
                    submitting={submitting}
                    onSave={handleUpdateAddress}
                    onCancel={() => setEditingAddressId(null)}
                  />
                ) : (
                  <div
                    key={addr.address_id}
                    className="space-y-1 rounded-[var(--radius-md)] border bg-accent/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-400">
                            <MapPin className="h-3 w-3" />
                            {addr.address_type === "PICKUP" ? "Recolección" : "Otra"}
                          </span>
                          {addr.is_default && (
                            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              Principal
                            </span>
                          )}
                          {addr.label && <span className="text-xs font-medium">{addr.label}</span>}
                        </div>
                        <p className="text-sm">
                          {addr.street}
                          {addr.exterior_number && ` #${addr.exterior_number}`}
                          {addr.interior_number && ` Int. ${addr.interior_number}`}
                        </p>
                        {(addr.neighborhood || addr.city || addr.state) && (
                          <p className="text-xs text-muted-foreground">
                            {[addr.neighborhood, addr.city, addr.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                        {addr.zip_code && (
                          <p className="text-xs text-muted-foreground">CP: {addr.zip_code} — {addr.country}</p>
                        )}
                      </div>
                      {canManage && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => startEditAddress(addr)}
                            disabled={submitting}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAddress(addr.address_id)}
                            disabled={submitting}
                            className="rounded p-1 text-destructive/70 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
              {showAddressForm && (
                <SupplierAddressInlineForm
                  title="Agregar dirección"
                  form={addressForm}
                  setForm={setAddressForm}
                  typeOptions={[
                    { value: "PICKUP", label: "Recolección" },
                    { value: "OTHER", label: "Otra" },
                  ]}
                  submitting={submitting}
                  onSave={handleAddAddress}
                  onCancel={() => setShowAddressForm(false)}
                />
              )}
              {canManage && !showAddressForm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddressForm(true)}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar dirección
                </Button>
              )}
            </>
          )}

          {tab === "contactos" && (
            <>
              {detail.contacts.length === 0 && !showContactForm && (
                <p className="text-sm text-muted-foreground">Sin contactos registrados.</p>
              )}
              {detail.contacts.map((c) =>
                editingContactId === c.contact_id ? (
                  <div
                    key={c.contact_id}
                    className="space-y-3 rounded-[var(--radius-md)] border border-dashed p-4"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Editar contacto
                    </p>
                    {(
                      [
                        ["full_name", "Nombre completo *"],
                        ["role_title", "Cargo / rol"],
                        ["email", "Email"],
                        ["phone", "Teléfono"],
                      ] as [keyof typeof editContactForm, string][]
                    ).map(([key, placeholder]) => (
                      <input
                        key={key}
                        className={inputCls}
                        placeholder={placeholder}
                        value={editContactForm[key] as string}
                        onChange={(e) =>
                          setEditContactForm((p) => ({ ...p, [key]: e.target.value }))
                        }
                      />
                    ))}
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editContactForm.is_primary ?? false}
                        onChange={(e) =>
                          setEditContactForm((p) => ({ ...p, is_primary: e.target.checked }))
                        }
                        className="h-4 w-4"
                      />
                      Contacto principal
                    </label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleUpdateContact}
                        disabled={submitting || !editContactForm.full_name}
                      >
                        Guardar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingContactId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={c.contact_id}
                    className="rounded-[var(--radius-md)] border bg-accent/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{c.full_name}</span>
                          {c.is_primary && (
                            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              Principal
                            </span>
                          )}
                        </div>
                        {c.role_title && (
                          <p className="text-xs text-muted-foreground">{c.role_title}</p>
                        )}
                        {c.email && (
                          <p className="text-xs text-muted-foreground">{c.email}</p>
                        )}
                        {c.phone && (
                          <p className="text-xs text-muted-foreground">{c.phone}</p>
                        )}
                      </div>
                      {canManage && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => startEditContact(c)}
                            disabled={submitting}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(c.contact_id)}
                            disabled={submitting}
                            className="rounded p-1 text-destructive/70 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
              {showContactForm && (
                <div className="space-y-3 rounded-[var(--radius-md)] border border-dashed p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Agregar contacto
                  </p>
                  {(
                    [
                      ["full_name", "Nombre completo *"],
                      ["role_title", "Cargo / rol"],
                      ["email", "Email"],
                      ["phone", "Teléfono"],
                    ] as [keyof typeof contactForm, string][]
                  ).map(([key, placeholder]) => (
                    <input
                      key={key}
                      className={inputCls}
                      placeholder={placeholder}
                      value={contactForm[key] as string}
                      onChange={(e) =>
                        setContactForm((p) => ({ ...p, [key]: e.target.value }))
                      }
                    />
                  ))}
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={contactForm.is_primary}
                      onChange={(e) =>
                        setContactForm((p) => ({ ...p, is_primary: e.target.checked }))
                      }
                      className="h-4 w-4"
                    />
                    Contacto principal
                  </label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleAddContact}
                      disabled={submitting || !contactForm.full_name}
                    >
                      Guardar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowContactForm(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
              {canManage && !showContactForm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowContactForm(true)}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar contacto
                </Button>
              )}
            </>
          )}

          {tab === "catalogo" && (
            <>
              {detail.current_products.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Sin productos en catálogo vigente.
                </p>
              )}
              {detail.current_products.map((p) => (
                <div
                  key={p.supplier_product_id}
                  className="rounded-[var(--radius-md)] border bg-accent/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium">
                          {p.supplier_sku ?? p.product_id ?? "—"}
                        </span>
                        {p.is_preferred && (
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-base font-semibold">
                        <span>{p.currency}</span>
                        <span>
                          $
                          {Number(p.unit_cost).toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Desde: {p.valid_from}</span>
                        {p.lead_time_days != null && (
                          <span>Entrega: {p.lead_time_days}d</span>
                        )}
                        {p.moq != null && <span>MOQ: {p.moq}</span>}
                      </div>
                    </div>
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPriceProduct(p)}
                        className="h-7 shrink-0 gap-1.5 text-xs"
                      >
                        <DollarSign className="h-3 w-3" />
                        Actualizar precio
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {priceProduct && (
        <PriceUpdateModal
          product={priceProduct}
          supplierId={detail.supplier_id}
          token={token}
          onClose={() => setPriceProduct(null)}
          onUpdated={() => {
            setPriceProduct(null)
            onUpdated()
          }}
        />
      )}
    </>
  )
}

// ─── Edit supplier modal ───────────────────────────────────────────────────

type EditSupplierModalProps = {
  supplier: SupplierDetail
  token: string | null
  onClose: () => void
  onUpdated: () => void
}

function EditSupplierModal({ supplier, token, onClose, onUpdated }: EditSupplierModalProps) {
  const [form, setForm] = useState({
    business_name: supplier.business_name,
    supplier_type: supplier.supplier_type,
    locality: supplier.locality,
    is_occasional: supplier.is_occasional,
    payment_terms_days: supplier.payment_terms_days,
    avg_payment_time_days: supplier.avg_payment_time_days ?? ("" as number | ""),
    currency: supplier.currency,
    notes: supplier.notes ?? "",
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await clientesProveedoresService.updateSupplier(token, supplier.supplier_id, {
        business_name: form.business_name || undefined,
        supplier_type: form.supplier_type,
        locality: form.locality,
        is_occasional: form.is_occasional,
        payment_terms_days: Number(form.payment_terms_days),
        avg_payment_time_days:
          form.avg_payment_time_days !== "" ? Number(form.avg_payment_time_days) : null,
        currency: form.currency,
        notes: form.notes || null,
      })
      toast.success("Proveedor actualizado")
      onUpdated()
      onClose()
    } catch {
      toast.error("Error al actualizar proveedor")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="surface-card relative z-10 w-full max-w-md space-y-5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Editar Proveedor</h2>
            <p className="text-xs text-muted-foreground font-mono">{supplier.code}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Nombre comercial *
            </label>
            <input
              className={inputCls}
              placeholder="Nombre comercial"
              value={form.business_name}
              onChange={(e) => setForm((p) => ({ ...p, business_name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Tipo
              </label>
              <select
                className={inputCls}
                value={form.supplier_type}
                onChange={(e) => setForm((p) => ({ ...p, supplier_type: e.target.value }))}
              >
                <option value="GOODS">Bienes</option>
                <option value="SERVICES">Servicios</option>
                <option value="BOTH">Mixto</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Localidad
              </label>
              <select
                className={inputCls}
                value={form.locality}
                onChange={(e) => setForm((p) => ({ ...p, locality: e.target.value }))}
              >
                <option value="LOCAL">Nacional</option>
                <option value="FOREIGN">Extranjero</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Plazo de pago (días)
              </label>
              <input
                className={inputCls}
                type="number"
                min={0}
                max={365}
                value={form.payment_terms_days}
                onChange={(e) =>
                  setForm((p) => ({ ...p, payment_terms_days: Number(e.target.value) }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                TPP promedio (días)
              </label>
              <input
                className={inputCls}
                type="number"
                min={0}
                max={365}
                placeholder="Opcional"
                value={form.avg_payment_time_days}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    avg_payment_time_days: e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Moneda
            </label>
            <select
              className={inputCls}
              value={form.currency}
              onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
            >
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Notas
            </label>
            <textarea
              className={cn(inputCls, "min-h-[72px] resize-y")}
              placeholder="Notas internas…"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_occasional}
              onChange={(e) => setForm((p) => ({ ...p, is_occasional: e.target.checked }))}
              className="h-4 w-4"
            />
            Proveedor ocasional
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !form.business_name}
          >
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── New supplier modal ────────────────────────────────────────────────────

type NewSupplierModalProps = {
  token: string | null
  onClose: () => void
  onCreated: () => void
}

function NewSupplierModal({ token, onClose, onCreated }: NewSupplierModalProps) {
  const [form, setForm] = useState({
    code: "",
    business_name: "",
    supplier_type: "GOODS",
    locality: "LOCAL",
    is_occasional: false,
    payment_terms_days: 0,
    currency: "MXN",
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await clientesProveedoresService.createSupplier(token, {
        ...form,
        payment_terms_days: Number(form.payment_terms_days),
      })
      toast.success("Proveedor creado")
      onCreated()
      onClose()
    } catch {
      toast.error("Error al crear proveedor")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="surface-card relative z-10 w-full max-w-md space-y-5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Nuevo Proveedor</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Código *
            </label>
            <input
              className={inputCls}
              placeholder="Ej. PROVTEX"
              maxLength={40}
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Nombre comercial *
            </label>
            <input
              className={inputCls}
              placeholder="Nombre comercial"
              value={form.business_name}
              onChange={(e) => setForm((p) => ({ ...p, business_name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
              <select
                className={inputCls}
                value={form.supplier_type}
                onChange={(e) => setForm((p) => ({ ...p, supplier_type: e.target.value }))}
              >
                <option value="GOODS">Bienes</option>
                <option value="SERVICES">Servicios</option>
                <option value="BOTH">Mixto</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Localidad
              </label>
              <select
                className={inputCls}
                value={form.locality}
                onChange={(e) => setForm((p) => ({ ...p, locality: e.target.value }))}
              >
                <option value="LOCAL">Nacional</option>
                <option value="FOREIGN">Extranjero</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Plazo (días)
              </label>
              <input
                className={inputCls}
                type="number"
                min={0}
                max={365}
                value={form.payment_terms_days}
                onChange={(e) =>
                  setForm((p) => ({ ...p, payment_terms_days: Number(e.target.value) }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Moneda
              </label>
              <select
                className={inputCls}
                value={form.currency}
                onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_occasional}
              onChange={(e) => setForm((p) => ({ ...p, is_occasional: e.target.checked }))}
              className="h-4 w-4"
            />
            Proveedor ocasional
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !form.code || !form.business_name}
          >
            Crear proveedor
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export function ProveedoresMaestroPage() {
  const token = useAuthStore((s) => s.accessToken)
  const canView = usePermission("supplier.view")
  const canManage = usePermission("supplier.manage")

  const [search, setSearch] = useState("")
  const [soloActivos, setSoloActivos] = useState(true)
  const [supplierType, setSupplierType] = useState("")
  const [locality, setLocality] = useState("")
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SupplierDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const fetchSuppliers = useCallback(
    (signal: AbortSignal) =>
      clientesProveedoresService.listSuppliers(
        token,
        {
          search: search || undefined,
          solo_activos: soloActivos,
          supplier_type: supplierType || undefined,
          locality: locality || undefined,
          limit: 200,
        },
        signal
      ),
    [token, search, soloActivos, supplierType, locality]
  )

  const { data, status, error, refetch } = useApi(fetchSuppliers, { enabled: canView })

  async function loadDetail(id: number) {
    setSelectedId(id)
    setDetailLoading(true)
    try {
      const d = await clientesProveedoresService.getSupplier(token, id)
      setDetail(d)
    } catch {
      toast.error("Error al cargar detalle del proveedor")
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  function handleRowClick(supplier: SupplierRead) {
    if (selectedId === supplier.supplier_id) {
      setSelectedId(null)
      setDetail(null)
    } else {
      void loadDetail(supplier.supplier_id)
    }
  }

  function handleDetailUpdated() {
    if (selectedId != null) {
      void loadDetail(selectedId)
      refetch()
    }
  }

  const columns: DataTableColumn<SupplierRead>[] = [
    {
      key: "code",
      header: "Código",
      cell: (s) => <span className="font-mono text-xs">{s.code}</span>,
    },
    {
      key: "business_name",
      header: "Nombre Comercial",
      cell: (s) => <span className="font-medium">{s.business_name}</span>,
    },
    {
      key: "supplier_type",
      header: "Tipo",
      cell: (s) => <SupplierTypeBadge type={s.supplier_type} />,
    },
    {
      key: "locality",
      header: "Localidad",
      cell: (s) => <LocalityBadge locality={s.locality} />,
    },
    {
      key: "payment_terms_days",
      header: "Plazo",
      cell: (s) => (
        <span className="text-muted-foreground">
          {s.payment_terms_days > 0 ? `${s.payment_terms_days}d` : "Inmediato"}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "Estado",
      cell: (s) => <StatusBadge active={s.is_active} />,
    },
  ]

  if (!canView) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Sin acceso</AlertTitle>
          <AlertDescription>No tienes permiso para ver proveedores.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const panelOpen = selectedId !== null

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-primary/10">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Proveedores</h1>
            <p className="text-sm text-muted-foreground">Directorio maestro de proveedores</p>
          </div>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowNewModal(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nuevo proveedor
          </Button>
        )}
      </div>

      {/* Content area */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Table area */}
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-6 transition-all duration-200",
            panelOpen && "lg:max-w-[calc(100%-420px)]"
          )}
        >
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error al cargar proveedores</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
          <DataTable
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(s) => String(s.supplier_id)}
            onRowClick={handleRowClick}
            emptyLabel={
              status === "loading"
                ? "Cargando proveedores…"
                : "No hay proveedores registrados"
            }
            toolbar={
              <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative max-w-xs flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="w-full rounded-[var(--radius-md)] border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Buscar proveedor…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    className="rounded-[var(--radius-md)] border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={supplierType}
                    onChange={(e) => setSupplierType(e.target.value)}
                  >
                    <option value="">Todos los tipos</option>
                    <option value="GOODS">Bienes</option>
                    <option value="SERVICES">Servicios</option>
                    <option value="BOTH">Mixto</option>
                  </select>
                  <select
                    className="rounded-[var(--radius-md)] border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                  >
                    <option value="">Todas las localidades</option>
                    <option value="LOCAL">Nacional</option>
                    <option value="FOREIGN">Extranjero</option>
                  </select>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={soloActivos}
                      onChange={(e) => setSoloActivos(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Solo activos
                  </label>
                  <span className="text-sm text-muted-foreground">
                    {data != null &&
                      `${data.total} proveedor${data.total !== 1 ? "es" : ""}`}
                  </span>
                </div>
              </div>
            }
          />
        </div>

        {/* Detail panel */}
        {panelOpen && (
          <div className="hidden w-[420px] shrink-0 border-l bg-background lg:flex lg:flex-col">
            {detailLoading || !detail ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                {detailLoading ? "Cargando detalle…" : "Sin datos"}
              </div>
            ) : (
              <SupplierDetailPanel
                detail={detail}
                canManage={canManage}
                token={token}
                onClose={() => {
                  setSelectedId(null)
                  setDetail(null)
                }}
                onUpdated={handleDetailUpdated}
                onEdit={() => setShowEditModal(true)}
              />
            )}
          </div>
        )}
      </div>

      {showNewModal && (
        <NewSupplierModal
          token={token}
          onClose={() => setShowNewModal(false)}
          onCreated={refetch}
        />
      )}

      {showEditModal && detail && (
        <EditSupplierModal
          supplier={detail}
          token={token}
          onClose={() => setShowEditModal(false)}
          onUpdated={() => {
            setShowEditModal(false)
            handleDetailUpdated()
            refetch()
          }}
        />
      )}
    </div>
  )
}
