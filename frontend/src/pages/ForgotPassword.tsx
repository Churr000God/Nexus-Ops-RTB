import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authService } from "@/services/authService"

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await authService.forgotPassword(email.trim().toLowerCase())
      setSent(true)
    } catch {
      // Siempre mostrar éxito para no revelar si el email existe
      setSent(true)
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
          <p className="mt-1 text-sm text-gray-500">Recuperar acceso</p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#1a1d21] p-7 shadow-2xl">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full
                              bg-emerald-500/15 ring-1 ring-emerald-500/30">
                <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-medium text-gray-200">Revisa tu correo</h2>
                <p className="mt-2 text-sm text-gray-500">
                  Si existe una cuenta con ese email, recibirás un enlace para
                  restablecer tu contraseña. El enlace expira en 1 hora.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-gray-500
                           transition-colors hover:text-gray-300"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h2 className="mb-1 text-sm font-medium text-gray-300">Restablecer contraseña</h2>
              <p className="mb-6 text-xs text-gray-500">
                Ingresa tu correo y te enviaremos un enlace de acceso.
              </p>

              <form onSubmit={onSubmit} className="space-y-4">
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

                <Button
                  type="submit"
                  className="w-full bg-blue-600 text-sm font-medium text-white
                             hover:bg-blue-500 focus-visible:ring-blue-500/40"
                  disabled={submitting}
                >
                  {submitting ? "Enviando…" : "Enviar enlace"}
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
