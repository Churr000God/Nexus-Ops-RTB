import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/http"
import { authService } from "@/services/authService"

function validatePassword(value: string): string | null {
  if (value.length < 10) return "Mínimo 10 caracteres"
  if (new TextEncoder().encode(value).length > 72) return "Máximo 72 bytes"
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value))
    return "Debe incluir al menos una letra y un número"
  return null
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState<string | null>(null)

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1115] px-4">
        <div className="w-full max-w-sm rounded-xl border border-white/[0.06] bg-[#1a1d21] p-7 text-center">
          <p className="text-sm text-red-400">El enlace no es válido o ha expirado.</p>
          <Link to="/login" className="mt-4 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    const pwErr = validatePassword(password)
    if (pwErr) errs.password = pwErr
    if (password && confirm !== password) errs.confirm = "Las contraseñas no coinciden"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setApiError(null)
    setSubmitting(true)
    try {
      await authService.resetPassword(token, password)
      navigate("/login", {
        state: { message: "Contraseña actualizada. Inicia sesión con tu nueva contraseña." },
        replace: true,
      })
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message || "El enlace no es válido o ha expirado")
      } else {
        setApiError("No se pudo restablecer la contraseña")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1115] px-4">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl
                          bg-blue-600/20 ring-1 ring-blue-500/30">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-blue-400" fill="none"
                 stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Nexus Ops RTB</h1>
          <p className="mt-1 text-sm text-gray-500">Nueva contraseña</p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#1a1d21] p-7 shadow-2xl">
          <h2 className="mb-1 text-sm font-medium text-gray-300">Elige una nueva contraseña</h2>
          <p className="mb-6 text-xs text-gray-500">
            Mínimo 10 caracteres · al menos 1 letra y 1 número.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            {apiError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5">
                <p className="text-sm text-red-400">{apiError}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-gray-400">
                Nueva contraseña
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-9 border-white/[0.08] bg-white/[0.04] text-sm text-gray-100
                           placeholder:text-gray-600 focus-visible:border-blue-500/50
                           focus-visible:ring-blue-500/20"
              />
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm" className="text-xs font-medium text-gray-400">
                Confirmar contraseña
              </label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="h-9 border-white/[0.08] bg-white/[0.04] text-sm text-gray-100
                           placeholder:text-gray-600 focus-visible:border-blue-500/50
                           focus-visible:ring-blue-500/20"
              />
              {errors.confirm && (
                <p className="text-xs text-red-400">{errors.confirm}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 text-sm font-medium text-white
                         hover:bg-blue-500 focus-visible:ring-blue-500/40"
              disabled={submitting}
            >
              {submitting ? "Guardando…" : "Establecer contraseña"}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500
                         transition-colors hover:text-gray-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
