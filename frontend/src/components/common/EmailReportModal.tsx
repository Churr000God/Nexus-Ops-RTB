import { useEffect, useRef, useState } from "react"
import { Loader2, Mail, Send, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ventasService } from "@/services/ventasService"
import { useAuthStore } from "@/stores/authStore"

interface Section {
  key: string
  label: string
}

const SECTIONS: Section[] = [
  { key: "kpis", label: "KPIs Resumen" },
  { key: "clientes", label: "Top Clientes" },
  { key: "productos", label: "Distribución por Producto" },
  { key: "margen", label: "Margen Bruto" },
  { key: "pagos", label: "Pagos Pendientes" },
  { key: "riesgo", label: "Clientes en Riesgo" },
]

interface EmailReportModalProps {
  open: boolean
  onClose: () => void
  startDate: string | null
  endDate: string | null
}

export function EmailReportModal({ open, onClose, startDate, endDate }: EmailReportModalProps) {
  const token = useAuthStore((s) => s.accessToken)
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(SECTIONS.map((s) => s.key))
  )
  const [sending, setSending] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  if (!open) return null

  const toggleSection = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const validateEmail = (value: string) => {
    if (!value.trim()) return "Ingresa un correo destinatario."
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "Formato de correo inválido."
    return ""
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    if (emailError) setEmailError(validateEmail(e.target.value))
  }

  const handleSend = async () => {
    const err = validateEmail(email)
    if (err) {
      setEmailError(err)
      inputRef.current?.focus()
      return
    }
    if (selected.size === 0) {
      toast.warning("Selecciona al menos una sección para el reporte.")
      return
    }

    setSending(true)
    try {
      await ventasService.sendVentasReportByEmail(token ?? "", {
        to_email: email.trim(),
        start_date: startDate,
        end_date: endDate,
        sections: Array.from(selected),
      })
      toast.success(`Reporte enviado a ${email.trim()}`)
      onClose()
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "Error al enviar. Verifica el token de MailerSend."
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const periodLabel =
    startDate && endDate
      ? `${startDate} — ${endDate}`
      : startDate
        ? `Desde ${startDate}`
        : endDate
          ? `Hasta ${endDate}`
          : "Todos los datos históricos"

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-modal-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-white/20 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h2 id="email-modal-title" className="text-base font-semibold text-gray-900">
              Enviar Reporte por Correo
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Period info */}
        <div className="border-b border-gray-100 bg-blue-50 px-6 py-2.5">
          <p className="text-xs text-blue-700">
            <span className="font-medium">Periodo:</span> {periodLabel}
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Email input */}
          <div>
            <label
              htmlFor="email-recipient"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Correo destinatario
            </label>
            <input
              ref={inputRef}
              id="email-recipient"
              type="email"
              value={email}
              onChange={handleEmailChange}
              onBlur={() => setEmailError(validateEmail(email))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend()
              }}
              placeholder="ejemplo@empresa.com"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
                emailError
                  ? "border-red-400 focus:ring-red-200"
                  : "border-gray-300 focus:ring-blue-200 focus:border-blue-400"
              }`}
              disabled={sending}
              autoComplete="email"
            />
            {emailError && (
              <p className="mt-1 text-xs text-red-500">{emailError}</p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              Se enviará desde <span className="font-mono">noreply@refacrtb.com.mx</span>
            </p>
          </div>

          {/* Secciones */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Secciones a incluir</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(new Set(SECTIONS.map((s) => s.key)))}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Todas
                </button>
                <span className="text-xs text-gray-300">|</span>
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Ninguna
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {SECTIONS.map((section) => (
                <label
                  key={section.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(section.key)}
                    onChange={() => toggleSection(section.key)}
                    className="h-3.5 w-3.5 rounded border-gray-300 accent-blue-700"
                    disabled={sending}
                  />
                  <span className="text-xs font-medium text-gray-700">{section.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Attachments info */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium text-gray-600 mb-1">Adjuntos que recibirá:</p>
            <div className="flex gap-3">
              <span className="text-xs text-gray-500">📄 Reporte <span className="font-mono">.docx</span></span>
              <span className="text-xs text-gray-500">📊 Datos <span className="font-mono">.csv</span></span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <p className="text-xs text-gray-400">
            {selected.size} de {SECTIONS.length} secciones
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={sending || selected.size === 0}
              className="gap-1.5"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              {sending ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
