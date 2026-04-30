import React, { useCallback, useMemo, useState } from "react"
import {
  Building2,
  CheckCircle2,
  LayoutGrid,
  List,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { EmptyState } from "@/components/common/EmptyState"
import { KpiCard } from "@/components/common/KpiCard"
import { ViewToggle } from "@/components/common/ViewToggle"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/useApi"
import { usePermission } from "@/hooks/usePermission"
import { clientesProveedoresService } from "@/services/clientesProveedoresService"
import { ApiError } from "@/lib/http"
import { useAuthStore } from "@/stores/authStore"
import type {
  CustomerAddress,
  CustomerAddressCreate,
  CustomerContactCreate,
  CustomerDetail,
  CustomerRead,
  CustomerTaxDataCreate,
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

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400">
      {type === "COMPANY" ? "Empresa" : "Persona"}
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

// ─── Shared address inline form ──────────────────────────────────────────

function AddressInlineForm({
  title,
  form,
  setForm,
  typeOptions,
  submitting,
  onSave,
  onCancel,
}: {
  title: string
  form: CustomerAddressCreate
  setForm: React.Dispatch<React.SetStateAction<CustomerAddressCreate>>
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
            onChange={(e) => setForm((p) => ({ ...p, address_type: e.target.value as "DELIVERY" | "OTHER" }))}
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
            placeholder="Ej. Bodega Norte"
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

// ─── Customer detail panel ────────────────────────────────────────────────

type Tab = "fiscal" | "direcciones" | "contactos"

type DetailPanelProps = {
  detail: CustomerDetail
  canManage: boolean
  token: string | null
  onClose: () => void
  onUpdated: () => void
  onEdit: () => void
}

function CustomerDetailPanel({ detail, canManage, token, onClose, onUpdated, onEdit }: DetailPanelProps) {
  const [tab, setTab] = useState<Tab>("fiscal")
  const [showTaxForm, setShowTaxForm] = useState(false)
  const [showContactForm, setShowContactForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingTaxId, setEditingTaxId] = useState<number | null>(null)
  const [editTaxForm, setEditTaxForm] = useState<CustomerTaxDataCreate>({
    rfc: "",
    legal_name: "",
    zip_code: "",
    is_default: true,
  })

  const [taxForm, setTaxForm] = useState<CustomerTaxDataCreate>({
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

  function startEditTax(td: { tax_data_id: number; rfc: string; legal_name: string; zip_code: string; is_default: boolean }) {
    setEditingTaxId(td.tax_data_id)
    setEditTaxForm({ rfc: td.rfc, legal_name: td.legal_name, zip_code: td.zip_code, is_default: td.is_default })
    setShowTaxForm(false)
  }

  async function handleUpdateTaxData() {
    if (editingTaxId == null) return
    setSubmitting(true)
    try {
      await clientesProveedoresService.updateCustomerTaxData(token, detail.customer_id, editingTaxId, editTaxForm)
      toast.success("Datos fiscales actualizados")
      setEditingTaxId(null)
      onUpdated()
    } catch {
      toast.error("Error al actualizar datos fiscales")
    } finally {
      setSubmitting(false)
    }
  }

  const [showAddressForm, setShowAddressForm] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null)
  const emptyAddress: CustomerAddressCreate = {
    address_type: "DELIVERY",
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
  const [addressForm, setAddressForm] = useState<CustomerAddressCreate>(emptyAddress)
  const [editAddressForm, setEditAddressForm] = useState<CustomerAddressCreate>(emptyAddress)

  const [editingContactId, setEditingContactId] = useState<number | null>(null)
  const [editContactForm, setEditContactForm] = useState<CustomerContactCreate>({
    full_name: "",
    role_title: "",
    email: "",
    phone: "",
    is_primary: false,
  })

  function startEditAddress(addr: CustomerAddress) {
    setEditingAddressId(addr.address_id)
    setEditAddressForm({
      address_type: addr.address_type as "DELIVERY" | "OTHER",
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
      await clientesProveedoresService.updateCustomerAddress(token, detail.customer_id, editingAddressId, {
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
      await clientesProveedoresService.updateCustomerContact(token, detail.customer_id, editingContactId, {
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
      await clientesProveedoresService.addCustomerAddress(token, detail.customer_id, {
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
      await clientesProveedoresService.deleteCustomerAddress(token, detail.customer_id, addressId)
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
      await clientesProveedoresService.addCustomerTaxData(token, detail.customer_id, taxForm)
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
      await clientesProveedoresService.addCustomerContact(token, detail.customer_id, {
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

  async function handleDeleteContact(contactId: number) {
    setSubmitting(true)
    try {
      await clientesProveedoresService.deleteCustomerContact(token, detail.customer_id, contactId)
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
      await clientesProveedoresService.updateCustomer(token, detail.customer_id, {
        is_active: !detail.is_active,
      })
      toast.success(detail.is_active ? "Cliente desactivado" : "Cliente activado")
      onUpdated()
    } catch {
      toast.error("Error al actualizar estado")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{detail.code}</span>
            <TypeBadge type={detail.customer_type} />
            <LocalityBadge locality={detail.locality} />
          </div>
          <h2 className="mt-1 truncate text-base font-semibold">{detail.business_name}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge active={detail.is_active} />
            <span>{detail.currency}</span>
            {detail.payment_terms_days > 0 && <span>{detail.payment_terms_days}d plazo</span>}
            {detail.credit_limit && (
              <span>Crédito ${Number(detail.credit_limit).toLocaleString()}</span>
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
                disabled={submitting}
                className="h-7 gap-1.5 text-xs"
              >
                <Pencil className="h-3 w-3" /> Editar
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
        {(
          [
            ["fiscal", "Datos Fiscales"],
            ["direcciones", "Direcciones"],
            ["contactos", "Contactos"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
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
            {detail.tax_data.map((td) =>
              editingTaxId === td.tax_data_id ? (
                <div
                  key={td.tax_data_id}
                  className="space-y-3 rounded-[var(--radius-md)] border border-dashed p-4"
                >
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
                    onChange={(e) => setEditTaxForm((p) => ({ ...p, legal_name: e.target.value }))}
                  />
                  <input
                    className={inputCls}
                    placeholder="Código Postal"
                    maxLength={10}
                    value={editTaxForm.zip_code}
                    onChange={(e) => setEditTaxForm((p) => ({ ...p, zip_code: e.target.value }))}
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
                    <Button variant="outline" size="sm" onClick={() => setEditingTaxId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={td.tax_data_id}
                  className="space-y-1 rounded-[var(--radius-md)] border bg-accent/20 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{td.rfc}</span>
                      {td.is_default && (
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Principal
                        </span>
                      )}
                    </div>
                    {canManage && (
                      <button
                        onClick={() => startEditTax(td)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm">{td.legal_name}</p>
                  <p className="text-xs text-muted-foreground">CP: {td.zip_code}</p>
                </div>
              )
            )}
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
            {detail.addresses.map((addr: CustomerAddress) =>
              editingAddressId === addr.address_id ? (
                <AddressInlineForm
                  key={addr.address_id}
                  title="Editar dirección"
                  form={editAddressForm}
                  setForm={setEditAddressForm}
                  typeOptions={[
                    { value: "DELIVERY", label: "Entrega" },
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
                          {addr.address_type === "DELIVERY" ? "Entrega" : "Otra"}
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
              <AddressInlineForm
                title="Agregar dirección"
                form={addressForm}
                setForm={setAddressForm}
                typeOptions={[
                  { value: "DELIVERY", label: "Entrega" },
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
                      onChange={(e) => setEditContactForm((p) => ({ ...p, [key]: e.target.value }))}
                    />
                  ))}
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editContactForm.is_primary ?? false}
                      onChange={(e) => setEditContactForm((p) => ({ ...p, is_primary: e.target.checked }))}
                      className="h-4 w-4"
                    />
                    Contacto principal
                  </label>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleUpdateContact} disabled={submitting || !editContactForm.full_name}>
                      Guardar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingContactId(null)}>
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
                      {c.role_title && <p className="text-xs text-muted-foreground">{c.role_title}</p>}
                      {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                      {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
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
                    onChange={(e) => setContactForm((p) => ({ ...p, [key]: e.target.value }))}
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
      </div>
    </div>
  )
}

// ─── Edit customer modal ───────────────────────────────────────────────────

type EditCustomerModalProps = {
  token: string | null
  customer: CustomerDetail
  onClose: () => void
  onUpdated: () => void
}

function EditCustomerModal({ token, customer, onClose, onUpdated }: EditCustomerModalProps) {
  const [form, setForm] = useState({
    business_name: customer.business_name,
    customer_type: customer.customer_type,
    locality: customer.locality,
    payment_terms_days: customer.payment_terms_days,
    credit_limit: customer.credit_limit != null ? String(customer.credit_limit) : "",
    currency: customer.currency,
    notes: customer.notes ?? "",
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await clientesProveedoresService.updateCustomer(token, customer.customer_id, {
        business_name: form.business_name,
        customer_type: form.customer_type,
        locality: form.locality,
        payment_terms_days: Number(form.payment_terms_days),
        credit_limit: form.credit_limit !== "" ? Number(form.credit_limit) : null,
        currency: form.currency,
        notes: form.notes || null,
      })
      toast.success("Cliente actualizado")
      onUpdated()
      onClose()
    } catch {
      toast.error("Error al actualizar cliente")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="surface-card relative z-10 w-full max-w-md space-y-5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Editar Cliente</h2>
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
              value={form.business_name}
              onChange={(e) => setForm((p) => ({ ...p, business_name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
              <select
                className={inputCls}
                value={form.customer_type}
                onChange={(e) => setForm((p) => ({ ...p, customer_type: e.target.value }))}
              >
                <option value="COMPANY">Empresa</option>
                <option value="PERSON">Persona</option>
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
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Límite de crédito
            </label>
            <input
              className={inputCls}
              type="number"
              min={0}
              placeholder="Sin límite"
              value={form.credit_limit}
              onChange={(e) => setForm((p) => ({ ...p, credit_limit: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Notas</label>
            <textarea
              className={inputCls}
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
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

// ─── New customer modal ────────────────────────────────────────────────────

type NewCustomerModalProps = {
  token: string | null
  onClose: () => void
  onCreated: () => void
}

function NewCustomerModal({ token, onClose, onCreated }: NewCustomerModalProps) {
  const [form, setForm] = useState({
    code: "",
    business_name: "",
    customer_type: "COMPANY",
    locality: "LOCAL",
    payment_terms_days: 0,
    currency: "MXN",
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await clientesProveedoresService.createCustomer(token, {
        ...form,
        payment_terms_days: Number(form.payment_terms_days),
      })
      toast.success("Cliente creado")
      onCreated()
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(err.message)
      } else {
        toast.error("Error al crear cliente")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="surface-card relative z-10 w-full max-w-md space-y-5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Nuevo Cliente</h2>
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
              placeholder="Ej. FEMSA"
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
                value={form.customer_type}
                onChange={(e) => setForm((p) => ({ ...p, customer_type: e.target.value }))}
              >
                <option value="COMPANY">Empresa</option>
                <option value="PERSON">Persona</option>
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
            Crear cliente
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export function ClientesPage() {
  const token = useAuthStore((s) => s.accessToken)
  const canView = usePermission("customer.view")
  const canManage = usePermission("customer.manage")

  const [search, setSearch] = useState("")
  const [soloActivos, setSoloActivos] = useState(true)
  const [customerTypeFilter, setCustomerTypeFilter] = useState("")
  const [localityFilter, setLocalityFilter] = useState("")
  const [viewMode, setViewMode] = useState<"table" | "grid">("table")
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const fetchCustomers = useCallback(
    (signal: AbortSignal) =>
      clientesProveedoresService.listCustomers(
        token,
        {
          search: search || undefined,
          solo_activos: soloActivos,
          customer_type: customerTypeFilter || undefined,
          locality: localityFilter || undefined,
          limit: 200,
        },
        signal
      ),
    [token, search, soloActivos, customerTypeFilter, localityFilter]
  )

  const { data, status, error, refetch } = useApi(fetchCustomers, { enabled: canView })

  const kpi = useMemo(() => {
    const items = data?.items ?? []
    const total = items.length
    const activos = items.filter((c) => c.is_active).length
    const inactivos = total - activos
    const empresas = items.filter((c) => c.customer_type === "COMPANY").length
    const locales = items.filter((c) => c.locality === "LOCAL").length
    return { total, activos, inactivos, empresas, locales }
  }, [data])

  async function loadDetail(id: number) {
    setSelectedId(id)
    setDetailLoading(true)
    try {
      const d = await clientesProveedoresService.getCustomer(token, id)
      setDetail(d)
    } catch {
      toast.error("Error al cargar detalle del cliente")
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  function handleRowClick(customer: CustomerRead) {
    if (selectedId === customer.customer_id) {
      setSelectedId(null)
      setDetail(null)
    } else {
      void loadDetail(customer.customer_id)
    }
  }

  function handleDetailUpdated() {
    if (selectedId != null) {
      void loadDetail(selectedId)
      refetch()
    }
  }

  const columns: DataTableColumn<CustomerRead>[] = [
    {
      key: "code",
      header: "Código",
      cell: (c) => <span className="font-mono text-xs">{c.code}</span>,
    },
    {
      key: "business_name",
      header: "Nombre Comercial",
      cell: (c) => <span className="font-medium">{c.business_name}</span>,
    },
    {
      key: "customer_type",
      header: "Tipo",
      cell: (c) => <TypeBadge type={c.customer_type} />,
    },
    {
      key: "locality",
      header: "Localidad",
      cell: (c) => <LocalityBadge locality={c.locality} />,
    },
    {
      key: "payment_terms_days",
      header: "Plazo",
      cell: (c) => (
        <span className="text-muted-foreground">
          {c.payment_terms_days > 0 ? `${c.payment_terms_days}d` : "Contado"}
        </span>
      ),
    },
    {
      key: "currency",
      header: "Moneda",
      cell: (c) => <span className="text-muted-foreground">{c.currency}</span>,
    },
    {
      key: "is_active",
      header: "Estado",
      cell: (c) => <StatusBadge active={c.is_active} />,
    },
  ]

  if (!canView) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Sin acceso</AlertTitle>
          <AlertDescription>No tienes permiso para ver clientes.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const panelOpen = selectedId !== null
  const filteredItems = data?.items ?? []

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Clientes</h1>
            <p className="text-sm text-muted-foreground">Directorio maestro de clientes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle
            options={[
              { value: "table", label: "Tabla", icon: List },
              { value: "grid", label: "Tarjetas", icon: LayoutGrid },
            ]}
            active={viewMode}
            onChange={setViewMode}
          />
          {canManage && (
            <Button size="sm" onClick={() => setShowNewModal(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Nuevo cliente
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 border-b bg-muted/20 px-6 py-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Total clientes"
          value={String(kpi.total)}
          icon={Users}
          tone="blue"
        />
        <KpiCard
          label="Activos"
          value={String(kpi.activos)}
          icon={CheckCircle2}
          tone="green"
        />
        <KpiCard
          label="Inactivos"
          value={String(kpi.inactivos)}
          icon={XCircle}
          tone="red"
        />
        <KpiCard
          label="Empresas"
          value={String(kpi.empresas)}
          icon={Building2}
          tone="purple"
        />
        <KpiCard
          label="Nacionales"
          value={String(kpi.locales)}
          icon={MapPin}
          tone="orange"
        />
      </div>

      {/* Content area */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Main area */}
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-6 transition-all duration-200",
            panelOpen && "lg:max-w-[calc(100%-420px)]"
          )}
        >
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error al cargar clientes</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {/* Toolbar */}
          <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full rounded-[var(--radius-md)] border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Buscar cliente…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="rounded-[var(--radius-md)] border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={customerTypeFilter}
                onChange={(e) => setCustomerTypeFilter(e.target.value)}
              >
                <option value="">Todos los tipos</option>
                <option value="COMPANY">Empresa</option>
                <option value="PERSON">Persona</option>
              </select>
              <select
                className="rounded-[var(--radius-md)] border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={localityFilter}
                onChange={(e) => setLocalityFilter(e.target.value)}
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
                {data != null && `${data.total} cliente${data.total !== 1 ? "s" : ""}`}
              </span>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {viewMode === "table" ? (
              <DataTable
                columns={columns}
                rows={filteredItems}
                rowKey={(c) => String(c.customer_id)}
                onRowClick={handleRowClick}
                selectedRowKey={selectedId != null ? String(selectedId) : undefined}
                emptyLabel={
                  status === "loading" ? "Cargando clientes…" : "No hay clientes registrados"
                }
                fillHeight
              />
            ) : (
              <div className="h-full overflow-y-auto pr-1">
                {filteredItems.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title={status === "loading" ? "Cargando clientes…" : "No hay clientes registrados"}
                    description="Ajusta los filtros o crea un nuevo cliente."
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredItems.map((c) => (
                      <div
                        key={c.customer_id}
                        onClick={() => handleRowClick(c)}
                        className={cn(
                          "surface-card surface-card-hover cursor-pointer space-y-3 border-white/70 p-5 transition-all",
                          selectedId === c.customer_id && "ring-1 ring-primary/40"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{c.business_name}</p>
                            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{c.code}</p>
                          </div>
                          <StatusBadge active={c.is_active} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <TypeBadge type={c.customer_type} />
                          <LocalityBadge locality={c.locality} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{c.currency}</span>
                          <span>{c.payment_terms_days > 0 ? `${c.payment_terms_days}d plazo` : "Contado"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {panelOpen && (
          <div className="hidden w-[420px] shrink-0 h-full overflow-hidden border-l bg-background lg:flex lg:flex-col">
            <div className="h-full overflow-y-auto">
              {detailLoading || !detail ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  {detailLoading ? "Cargando detalle…" : "Sin datos"}
                </div>
              ) : (
                <CustomerDetailPanel
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
          </div>
        )}
      </div>

      {showNewModal && (
        <NewCustomerModal
          token={token}
          onClose={() => setShowNewModal(false)}
          onCreated={refetch}
        />
      )}
      {showEditModal && detail && (
        <EditCustomerModal
          token={token}
          customer={detail}
          onClose={() => setShowEditModal(false)}
          onUpdated={handleDetailUpdated}
        />
      )}
    </div>
  )
}
