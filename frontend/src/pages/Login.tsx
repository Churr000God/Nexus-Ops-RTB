import { useEffect, useMemo, useState } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/http"
import { useAuth } from "@/hooks/useAuth"

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { status, isAuthenticated, login, clearError } = useAuth()

  const redirectTo = useMemo(() => {
    const fromState = (location.state as { from?: string } | null)?.from
    return typeof fromState === "string" ? fromState : "/"
  }, [location.state])

  const successMessage = (location.state as { message?: string } | null)?.message ?? null

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "mfa_setup") navigate("/setup-2fa", { replace: true })
    if (status === "mfa_verify") navigate("/verify-2fa", { replace: true })
  }, [status, navigate])

  if (isAuthenticated) return <Navigate to="/" replace />

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    setError(null)
    setSubmitting(true)
    try {
      await login({ email, password })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Credenciales incorrectas")
      } else {
        setError("No se pudo iniciar sesión")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1115] px-4">
      <div className="w-full max-w-sm">

        {/* Logo / brand */}
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
          <p className="mt-1 text-sm text-gray-500">Sistema de operaciones interno</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-white/[0.06] bg-[#1a1d21] p-7 shadow-2xl">
          <h2 className="mb-6 text-sm font-medium text-gray-300">Inicia sesión en tu cuenta</h2>

          <form onSubmit={onSubmit} className="space-y-4">
            {successMessage && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5">
                <p className="text-sm text-emerald-400">{successMessage}</p>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-gray-400">
                Correo electrónico
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="tu@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-9 border-white/[0.08] bg-white/[0.04] text-sm text-gray-100
                           placeholder:text-gray-600 focus-visible:border-blue-500/50
                           focus-visible:ring-blue-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-medium text-gray-400">
                  Contraseña
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-gray-500 transition-colors hover:text-blue-400"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-9 border-white/[0.08] bg-white/[0.04] text-sm text-gray-100
                           placeholder:text-gray-600 focus-visible:border-blue-500/50
                           focus-visible:ring-blue-500/20"
              />
            </div>

            <Button
              type="submit"
              className="mt-1 w-full bg-blue-600 text-sm font-medium text-white
                         hover:bg-blue-500 focus-visible:ring-blue-500/40"
              disabled={submitting}
            >
              {submitting ? "Verificando…" : "Entrar"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          Acceso restringido · solo personal autorizado
        </p>
      </div>
    </div>
  )
}
