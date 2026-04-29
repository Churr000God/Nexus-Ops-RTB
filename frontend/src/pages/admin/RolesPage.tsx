import { useCallback, useMemo, useState } from "react"
import { ChevronDown, Plus, Search, ShieldCheck, X } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useApi } from "@/hooks/useApi"
import { usePermission } from "@/hooks/usePermission"
import { adminService } from "@/services/adminService"
import type { CreateRolePayload } from "@/services/adminService"
import { useAuthStore } from "@/stores/authStore"
import type { Permission, Role } from "@/types/admin"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ─── Colores por rol ──────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "border-purple-500/30 bg-purple-500/15 text-purple-400",
  SALES: "border-blue-500/30 bg-blue-500/15 text-blue-400",
  PURCHASING: "border-orange-500/30 bg-orange-500/15 text-orange-400",
  WAREHOUSE: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
  ACCOUNTING: "border-cyan-500/30 bg-cyan-500/15 text-cyan-400",
  READ_ONLY: "border-border bg-muted/60 text-muted-foreground",
}

function roleBadgeClass(code: string) {
  return ROLE_COLORS[code] ?? "border-primary/30 bg-primary/10 text-primary"
}

// ─── Agrupación de permisos por módulo ───────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  user: "Usuarios",
  role: "Roles",
  customer: "Clientes",
  supplier: "Proveedores",
  product: "Productos",
  customer_contract_price: "Precios especiales",
  quote: "Cotizaciones",
  order: "Pedidos",
  delivery_note: "Notas de remisión",
  shipment: "Envíos",
  route: "Rutas",
  purchase_request: "Solicitudes de compra",
  purchase_order: "Órdenes de compra",
  goods_receipt: "Recepciones de mercancía",
  supplier_invoice: "Facturas de proveedor",
  compras: "Compras",
  gastos: "Gastos",
  non_conformity: "No conformidades",
  inventory: "Inventario",
  cfdi: "Facturación CFDI",
  payment: "Cobros y pagos",
  expense: "Gastos operativos",
  report: "Reportes",
  audit: "Auditoría",
}

function moduleOf(code: string): string {
  const prefix = code.split(".")[0]
  return MODULE_LABELS[prefix] ?? prefix
}

function groupPermissions(perms: Permission[]): Map<string, Permission[]> {
  const map = new Map<string, Permission[]>()
  for (const p of perms) {
    const mod = moduleOf(p.code)
    if (!map.has(mod)) map.set(mod, [])
    map.get(mod)!.push(p)
  }
  return map
}

// ─── Modal de nuevo rol ───────────────────────────────────────────────────────

type CreateRoleModalProps = {
  allPermissions: Permission[]
  token: string | null
  onClose: () => void
  onCreated: () => void
}

function CreateRoleModal({ allPermissions, token, onClose, onCreated }: CreateRoleModalProps) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set())
  const [permSearch, setPermSearch] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const filteredPerms = useMemo(() => {
    const q = permSearch.toLowerCase()
    if (!q) return allPermissions
    return allPermissions.filter(
      (p) => p.code.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)
    )
  }, [allPermissions, permSearch])

  const groupedFiltered = useMemo(() => groupPermissions(filteredPerms), [filteredPerms])

  function togglePerm(code: string) {
    setSelectedPerms((prev) => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!code.trim()) next.code = "Requerido"
    else if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(code.trim())) next.code = "Solo letras, números y guiones bajos; debe comenzar con letra"
    if (!name.trim()) next.name = "Requerido"
    if (Object.keys(next).length > 0) { setErrors(next); return false }
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    const payload: CreateRolePayload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || undefined,
      permission_codes: Array.from(selectedPerms),
    }
    try {
      await adminService.createRole(token, payload)
      toast.success(`Rol ${payload.code} creado`)
      onCreated()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear rol"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 surface-card flex w-full max-w-lg flex-col gap-5 p-6" style={{ maxHeight: "90vh" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">Nuevo rol</p>
            <p className="text-sm text-muted-foreground">Define el código, nombre y permisos del rol</p>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-hidden">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Código * <span className="text-[10px] normal-case">(se guarda en mayúsculas)</span></label>
              <Input
                placeholder="VENTAS_SR"
                value={code}
                onChange={(e) => { setCode(e.target.value); setErrors((p) => { const n = {...p}; delete n.code; return n }) }}
                disabled={submitting}
                autoFocus
              />
              {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
              <Input
                placeholder="Ventas Senior"
                value={name}
                onChange={(e) => { setName(e.target.value); setErrors((p) => { const n = {...p}; delete n.name; return n }) }}
                disabled={submitting}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Descripción</label>
            <Input
              placeholder="Descripción breve del rol (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Permisos <span className="ml-1 text-primary">{selectedPerms.size > 0 ? `(${selectedPerms.size} seleccionados)` : ""}</span>
              </label>
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar permiso…"
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="h-7 pl-7 text-xs"
                />
              </div>
            </div>

            <div className="overflow-y-auto rounded-[var(--radius-md)] border bg-background/50 p-2" style={{ maxHeight: "280px" }}>
              {groupedFiltered.size === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Sin resultados</p>
              ) : (
                Array.from(groupedFiltered.entries()).map(([mod, perms]) => (
                  <div key={mod} className="mb-3 last:mb-0">
                    <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {mod}
                    </p>
                    <div className="space-y-0.5">
                      {perms.map((p) => (
                        <label
                          key={p.code}
                          className="flex cursor-pointer items-start gap-2.5 rounded px-2 py-1.5 hover:bg-accent/50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPerms.has(p.code)}
                            onChange={() => togglePerm(p.code)}
                            className="mt-0.5 accent-primary"
                          />
                          <div className="min-w-0">
                            <p className="font-mono text-xs text-foreground">{p.code}</p>
                            {p.description && (
                              <p className="text-[11px] text-muted-foreground">{p.description}</p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Creando…" : "Crear rol"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Tarjeta de rol ───────────────────────────────────────────────────────────

function RoleCard({ role }: { role: Role }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="surface-card overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent/30"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
              roleBadgeClass(role.code)
            )}
          >
            {role.code}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{role.name}</p>
            {role.description && (
              <p className="truncate text-xs text-muted-foreground">{role.description}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {role.permissions.length} {role.permissions.length === 1 ? "permiso" : "permisos"}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-3">
          {role.permissions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin permisos asignados</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {role.permissions.map((p) => (
                <span
                  key={p.code}
                  title={p.description ?? undefined}
                  className="inline-flex items-center rounded border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                >
                  {p.code}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sección de permisos ──────────────────────────────────────────────────────

function PermissionsSection({ permissions }: { permissions: Permission[] }) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return permissions
    return permissions.filter(
      (p) => p.code.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)
    )
  }, [permissions, search])

  const grouped = useMemo(() => groupPermissions(filtered), [filtered])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Permisos del sistema</h2>
          <p className="text-xs text-muted-foreground">
            {permissions.length} permisos registrados · solo se crean al implementar nueva funcionalidad
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o descripción…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sin resultados para "{search}"
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from(grouped.entries()).map(([mod, perms]) => (
            <div key={mod} className="surface-card p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {mod}
              </p>
              <div className="space-y-2.5">
                {perms.map((p) => (
                  <div key={p.code}>
                    <p className="font-mono text-xs text-foreground">{p.code}</p>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      {p.description ?? "Sin descripción"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function RolesPage() {
  const token = useAuthStore((s) => s.accessToken)
  const canManage = usePermission("role.manage")

  const [showCreateModal, setShowCreateModal] = useState(false)

  const fetchRoles = useCallback(
    (signal: AbortSignal) => adminService.listRoles(token, signal),
    [token]
  )
  const fetchPermissions = useCallback(
    (signal: AbortSignal) => adminService.listPermissions(token, signal),
    [token]
  )

  const { data: roles, status: rolesStatus, error: rolesError, refetch: refetchRoles } =
    useApi(fetchRoles, { enabled: canManage })

  const { data: permissions, error: permsError } =
    useApi(fetchPermissions, { enabled: canManage })

  if (!canManage) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Sin acceso</AlertTitle>
          <AlertDescription>Necesitas el permiso role.manage para ver esta sección.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-10 p-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Roles y Permisos</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de roles de acceso y catálogo de permisos del sistema
          </p>
        </div>
      </div>

      {(rolesError || permsError) && (
        <Alert variant="destructive">
          <AlertTitle>Error al cargar datos</AlertTitle>
          <AlertDescription>{(rolesError ?? permsError)?.message}</AlertDescription>
        </Alert>
      )}

      {/* ── Sección Roles ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Roles</h2>
            <p className="text-xs text-muted-foreground">
              {rolesStatus === "success"
                ? `${roles?.length ?? 0} roles configurados`
                : "Cargando…"}
            </p>
          </div>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-3.5 w-3.5" />
            Nuevo rol
          </Button>
        </div>

        {rolesStatus === "loading" && (
          <p className="text-sm text-muted-foreground">Cargando roles…</p>
        )}

        {rolesStatus === "success" && roles && roles.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">No hay roles configurados</p>
        )}

        {rolesStatus === "success" && roles && roles.length > 0 && (
          <div className="space-y-2">
            {roles.map((role) => (
              <RoleCard key={role.role_id} role={role} />
            ))}
          </div>
        )}
      </div>

      {/* ── Sección Permisos ── */}
      {permissions && permissions.length > 0 && (
        <PermissionsSection permissions={permissions} />
      )}

      {/* ── Modal ── */}
      {showCreateModal && permissions && (
        <CreateRoleModal
          allPermissions={permissions}
          token={token}
          onClose={() => setShowCreateModal(false)}
          onCreated={refetchRoles}
        />
      )}
    </div>
  )
}
