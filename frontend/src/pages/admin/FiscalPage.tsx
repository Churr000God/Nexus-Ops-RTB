import { useCallback, useEffect, useState } from "react"
import { Building2, CheckCircle2, FileKey2, Server } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useApi } from "@/hooks/useApi"
import { usePermission } from "@/hooks/usePermission"
import { clientesProveedoresService } from "@/services/clientesProveedoresService"
import { getIssuerConfig, saveIssuerConfig } from "@/services/cfdiService"
import { useAuthStore } from "@/stores/authStore"
import type { CfdiIssuerConfigIn, CfdiIssuerConfigOut, PacProvider } from "@/types/cfdi"
import type { SATTaxRegime } from "@/types/clientesProveedores"
import { cn } from "@/lib/utils"

// ── Constantes ────────────────────────────────────────────────────────────────

const PAC_PROVIDERS: { value: PacProvider; label: string }[] = [
  { value: "DIVERZA",   label: "Diverza" },
  { value: "EDICOM",    label: "Edicom" },
  { value: "FACTURAMA", label: "Facturama" },
  { value: "STUB",      label: "STUB (pruebas)" },
]

const EMPTY_FORM: CfdiIssuerConfigIn = {
  rfc: "",
  legal_name: "",
  tax_regime_id: null,
  zip_code: "",
  csd_serial_number: null,
  csd_valid_from: null,
  csd_valid_to: null,
  pac_provider: null,
  pac_username: null,
  pac_endpoint_url: null,
  pac_environment: "SANDBOX",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function configToForm(c: CfdiIssuerConfigOut): CfdiIssuerConfigIn {
  return {
    rfc: c.rfc,
    legal_name: c.legal_name,
    tax_regime_id: c.tax_regime_id ?? null,
    zip_code: c.zip_code,
    csd_serial_number: c.csd_serial_number ?? null,
    csd_valid_from: c.csd_valid_from ?? null,
    csd_valid_to: c.csd_valid_to ?? null,
    pac_provider: (c.pac_provider as PacProvider | null) ?? null,
    pac_username: null,
    pac_endpoint_url: null,
    pac_environment: (c.pac_environment as "SANDBOX" | "PRODUCTION") ?? "SANDBOX",
  }
}

function fmtDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("es-MX")
}

function fmtDateTime(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleString("es-MX")
}

// ── Label + Field wrapper ─────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}

// ── Status banner ─────────────────────────────────────────────────────────────

function StatusBanner({ config }: { config: CfdiIssuerConfigOut }) {
  const envColor =
    config.pac_environment === "PRODUCTION"
      ? "border-emerald-600/40 bg-emerald-50 text-emerald-700"
      : "border-amber-500/40 bg-amber-50 text-amber-700"

  return (
    <div className="flex items-start justify-between rounded-lg border border-border bg-card px-5 py-4 shadow-soft-sm">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {config.rfc} — {config.legal_name}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Última actualización: {fmtDateTime(config.updated_at)}
          </p>
        </div>
      </div>
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
          envColor,
        )}
      >
        {config.pac_environment}
      </span>
    </div>
  )
}

// ── Sección wrapper ───────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-soft-sm">
      <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  )
}

// ── Select nativo con estilos del tema ────────────────────────────────────────

function ThemedSelect({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground",
        "shadow-soft-sm transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      {children}
    </select>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export function FiscalPage() {
  const token = useAuthStore((s) => s.accessToken)
  const canManage = usePermission("cfdi.config.manage")

  const configFetcher = useCallback(
    (signal: AbortSignal) => getIssuerConfig(token, signal),
    [token],
  )
  const { data: config, status: configStatus, refetch } = useApi(configFetcher)

  const regimesFetcher = useCallback(
    (signal: AbortSignal) => clientesProveedoresService.listRegimenesFiscales(token, signal),
    [token],
  )
  const { data: regimes } = useApi<SATTaxRegime[]>(regimesFetcher)

  const [form, setForm] = useState<CfdiIssuerConfigIn>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (config) setForm(configToForm(config))
  }, [config])

  function set<K extends keyof CfdiIssuerConfigIn>(key: K, value: CfdiIssuerConfigIn[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return

    const rfcClean = form.rfc.trim().toUpperCase()
    if (rfcClean.length < 12 || rfcClean.length > 13) {
      toast.error("RFC debe tener 12 o 13 caracteres")
      return
    }
    if (!form.legal_name.trim()) {
      toast.error("Razón social requerida")
      return
    }
    if (form.zip_code.trim().length !== 5) {
      toast.error("Código postal debe ser de 5 dígitos")
      return
    }

    setSubmitting(true)
    try {
      await saveIssuerConfig(token, { ...form, rfc: rfcClean })
      toast.success("Configuración fiscal guardada")
      refetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar configuración")
    } finally {
      setSubmitting(false)
    }
  }

  const isLoading = configStatus === "loading"

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Configuración Fiscal (Emisor)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          RFC · razón social · régimen · CSD · PAC · entorno de timbrado
        </p>
      </div>

      {/* Banner de estado actual */}
      {isLoading && (
        <div className="h-16 animate-pulse rounded-lg border border-border bg-muted/40" />
      )}
      {!isLoading && config && <StatusBanner config={config} />}
      {!isLoading && !config && (
        <div className="rounded-lg border border-amber-400/50 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
          Sin configuración fiscal activa — completa el formulario para registrar los datos del
          emisor.
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* ── Datos del Emisor ── */}
        <Section icon={Building2} title="Datos del Emisor">
          <Field label="RFC *">
            <Input
              value={form.rfc}
              onChange={(e) => set("rfc", e.target.value.toUpperCase())}
              placeholder="XAXX010101000"
              maxLength={13}
              disabled={!canManage}
              className="font-mono uppercase"
            />
          </Field>

          <Field label="Razón Social *">
            <Input
              value={form.legal_name}
              onChange={(e) => set("legal_name", e.target.value)}
              placeholder="RTB S.A. de C.V."
              disabled={!canManage}
            />
          </Field>

          <Field label="Régimen Fiscal">
            <ThemedSelect
              value={String(form.tax_regime_id ?? "")}
              onChange={(v) => set("tax_regime_id", v ? Number(v) : null)}
              disabled={!canManage}
            >
              <option value="">Seleccionar régimen…</option>
              {(regimes ?? []).map((r) => (
                <option key={r.regime_id} value={r.regime_id}>
                  {r.code} — {r.description}
                </option>
              ))}
            </ThemedSelect>
          </Field>

          <Field label="Código Postal *">
            <Input
              value={form.zip_code}
              onChange={(e) => set("zip_code", e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="06600"
              maxLength={5}
              disabled={!canManage}
              className="font-mono"
            />
          </Field>
        </Section>

        {/* ── CSD ── */}
        <Section icon={FileKey2} title="Certificado de Sello Digital (CSD)">
          <Field label="Número de Serie">
            <Input
              value={form.csd_serial_number ?? ""}
              onChange={(e) => set("csd_serial_number", e.target.value || null)}
              placeholder="00001000000504465028"
              disabled={!canManage}
              className="font-mono"
            />
          </Field>

          <div />

          <Field label="Válido desde">
            <Input
              type="date"
              value={form.csd_valid_from ?? ""}
              onChange={(e) => set("csd_valid_from", e.target.value || null)}
              disabled={!canManage}
            />
          </Field>

          <Field label="Válido hasta">
            <Input
              type="date"
              value={form.csd_valid_to ?? ""}
              onChange={(e) => set("csd_valid_to", e.target.value || null)}
              disabled={!canManage}
            />
          </Field>

          {config?.csd_valid_to && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">
                Vigencia registrada: {fmtDate(config.csd_valid_from)} —{" "}
                {fmtDate(config.csd_valid_to)}
              </p>
            </div>
          )}
        </Section>

        {/* ── PAC ── */}
        <Section icon={Server} title="Proveedor de Autorización y Certificación (PAC)">
          <Field label="Proveedor PAC">
            <ThemedSelect
              value={form.pac_provider ?? ""}
              onChange={(v) => set("pac_provider", (v as PacProvider) || null)}
              disabled={!canManage}
            >
              <option value="">Sin proveedor</option>
              {PAC_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </ThemedSelect>
          </Field>

          <Field label="Entorno">
            <div className="flex h-10 gap-2">
              {(["SANDBOX", "PRODUCTION"] as const).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => canManage && set("pac_environment", env)}
                  className={cn(
                    "flex-1 rounded-md border text-xs font-semibold transition-colors",
                    form.pac_environment === env
                      ? env === "PRODUCTION"
                        ? "border-emerald-600/50 bg-emerald-50 text-emerald-700"
                        : "border-amber-500/50 bg-amber-50 text-amber-700"
                      : "border-border bg-muted/50 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                    !canManage && "cursor-not-allowed opacity-50",
                  )}
                >
                  {env === "SANDBOX" ? "Sandbox" : "Producción"}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Usuario / Cuenta PAC">
            <Input
              value={form.pac_username ?? ""}
              onChange={(e) => set("pac_username", e.target.value || null)}
              placeholder="usuario@empresa.com"
              disabled={!canManage}
            />
          </Field>

          <Field label="URL Endpoint PAC">
            <Input
              value={form.pac_endpoint_url ?? ""}
              onChange={(e) => set("pac_endpoint_url", e.target.value || null)}
              placeholder="https://api.pac.com/v1"
              disabled={!canManage}
            />
          </Field>
        </Section>

        {/* ── Botón guardar ── */}
        {canManage && (
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Guardando…"
                : config
                  ? "Actualizar Configuración"
                  : "Guardar Configuración"}
            </Button>
          </div>
        )}

        {!canManage && (
          <p className="text-center text-xs text-muted-foreground">
            Se requiere permiso{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              cfdi.config.manage
            </code>{" "}
            para editar.
          </p>
        )}
      </form>
    </div>
  )
}
