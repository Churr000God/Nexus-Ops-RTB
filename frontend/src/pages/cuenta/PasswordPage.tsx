import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/http"
import { cuentaService } from "@/services/cuentaService"
import { useAuthStore } from "@/stores/authStore"

function validateNewPassword(value: string): string | null {
  if (value.length < 10) return "Mínimo 10 caracteres"
  if (new TextEncoder().encode(value).length > 72) return "Máximo 72 bytes"
  const hasLetter = /[a-zA-Z]/.test(value)
  const hasDigit = /\d/.test(value)
  if (!hasLetter || !hasDigit) return "Debe incluir al menos una letra y un número"
  return null
}

export function PasswordPage() {
  const token = useAuthStore((s) => s.accessToken)
  const logout = useAuthStore((s) => s.logout)

  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!current) errs.current = "Ingresa tu contraseña actual"
    const pwErr = validateNewPassword(next)
    if (pwErr) errs.next = pwErr
    if (next && confirm !== next) errs.confirm = "Las contraseñas no coinciden"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !token) return
    setSubmitting(true)
    try {
      await cuentaService.changeOwnPassword(token, {
        current_password: current,
        new_password: next,
      })
      toast.success("Contraseña actualizada. Inicia sesión con la nueva contraseña.")
      await logout()
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setErrors({ current: "Contraseña actual incorrecta" })
      } else {
        toast.error("No se pudo cambiar la contraseña")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-5 text-sm font-semibold text-foreground">Cambiar contraseña</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Contraseña actual
            </label>
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="h-8 text-sm"
              autoComplete="current-password"
            />
            {errors.current && (
              <p className="text-xs text-destructive">{errors.current}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Nueva contraseña
            </label>
            <Input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="h-8 text-sm"
              autoComplete="new-password"
            />
            {errors.next ? (
              <p className="text-xs text-destructive">{errors.next}</p>
            ) : (
              <p className="text-xs text-muted-foreground/60">
                Mínimo 10 caracteres · al menos 1 letra y 1 número
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Confirmar nueva contraseña
            </label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-8 text-sm"
              autoComplete="new-password"
            />
            {errors.confirm && (
              <p className="text-xs text-destructive">{errors.confirm}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Guardando…" : "Cambiar contraseña"}
          </Button>
        </form>

        <p className="mt-4 text-xs text-muted-foreground/60">
          Al cambiar la contraseña se cerrará sesión en todos los dispositivos.
        </p>
      </div>
    </div>
  )
}
