import { useCallback, useState } from "react"
import { Building2, CheckCircle2, Pencil, Plus, Search, X, XCircle } from "lucide-react"
import { toast } from "sonner"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/useApi"
import { usePermission } from "@/hooks/usePermission"
import { clientesProveedoresService } from "@/services/clientesProveedoresService"
import { useAuthStore } from "@/stores/authStore"
import type {
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

// ─── Customer detail panel ────────────────────────────────────────────────

type Tab = "fiscal" | "contactos"

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

        {tab === "contactos" && (
          <>
            {detail.contacts.length === 0 && !showContactForm && (
              <p className="text-sm text-muted-foreground">Sin contactos registrados.</p>
            )}
            {detail.contacts.map((c) => (
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
                    {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                    {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleDeleteContact(c.contact_id)}
                      disabled={submitting}
                      className="rounded p-1 text-destructive/70 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
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
    } catch {
      toast.error("Error al crear cliente")
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
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const fetchCustomers = useCallback(
    (signal: AbortSignal) =>
      clientesProveedoresService.listCustomers(
        token,
        { search: search || undefined, solo_activos: soloActivos, limit: 200 },
        signal
      ),
    [token, search, soloActivos]
  )

  const { data, status, error, refetch } = useApi(fetchCustomers, { enabled: canView })

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
        {canManage && (
          <Button size="sm" onClick={() => setShowNewModal(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nuevo cliente
          </Button>
        )}
      </div>

      {/* Content area */}
      <div className="flex min-h-0 flex-1">
        {/* Table area */}
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-6 transition-all duration-200",
            panelOpen && "lg:max-w-[calc(100%-420px)]"
          )}
        >
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error al cargar clientes</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
          <DataTable
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(c) => String(c.customer_id)}
            onRowClick={handleRowClick}
            emptyLabel={
              status === "loading" ? "Cargando clientes…" : "No hay clientes registrados"
            }
            toolbar={
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
                <div className="flex items-center gap-4">
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
                      `${data.total} cliente${data.total !== 1 ? "s" : ""}`}
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
