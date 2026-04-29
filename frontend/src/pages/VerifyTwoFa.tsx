import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/http"
import { useAuth } from "@/hooks/useAuth"

export function VerifyTwoFaPage() {
  const navigate = useNavigate()
  const { mfaToken, completeMfaVerify } = useAuth()

  const [code, setCode] = useState("")
  const [useBackup, setUseBackup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const autoSubmitRef = useRef(false)

  useEffect(() => {
    if (!mfaToken) {
      navigate("/login", { replace: true })
    }
  }, [mfaToken, navigate])

  useEffect(() => {
    if (!useBackup && code.length === 6 && !autoSubmitRef.current) {
      autoSubmitRef.current = true
      handleVerify(code)
    }
    if (code.length < 6) {
      autoSubmitRef.current = false
    }
  }, [code, useBackup]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleVerify(value: string) {
    setError(null)
    setSubmitting(true)
    try {
      await completeMfaVerify(value)
      navigate("/", { replace: true })
    } catch (err) {
      autoSubmitRef.current = false
      if (err instanceof ApiError) {
        setError(err.message || "Código incorrecto")
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("No se pudo verificar el código")
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await handleVerify(code)
  }

  function handleCodeChange(value: string) {
    if (useBackup) {
      setCode(value.toUpperCase())
    } else {
      setCode(value.replace(/\D/g, ""))
    }
    setError(null)
  }

  function toggleBackup() {
    setUseBackup((prev) => !prev)
    setCode("")
    setError(null)
    autoSubmitRef.current = false
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
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0
                       002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0
                       00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Verificación en dos pasos
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {useBackup
              ? "Código de respaldo (XXXX-XXXX)"
              : "6 dígitos de tu app autenticadora"}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#1a1d21] p-7 shadow-2xl">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="verify-code" className="text-xs font-medium text-gray-400">
                {useBackup ? "Código de respaldo" : "Código de verificación"}
              </label>
              {useBackup ? (
                <Input
                  id="verify-code"
                  type="text"
                  autoComplete="off"
                  placeholder="XXXX-XXXX"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  required
                  className="h-9 border-white/[0.08] bg-white/[0.04] text-center
                             font-mono tracking-wider text-gray-100
                             placeholder:text-gray-600 focus-visible:border-blue-500/50
                             focus-visible:ring-blue-500/20"
                />
              ) : (
                <Input
                  id="verify-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  required
                  className="h-9 border-white/[0.08] bg-white/[0.04] text-center text-lg
                             font-mono tracking-[0.4em] text-gray-100
                             placeholder:text-gray-600 focus-visible:border-blue-500/50
                             focus-visible:ring-blue-500/20"
                />
              )}
              {!useBackup && (
                <p className="text-xs text-gray-600">
                  El código se enviará automáticamente al completar los 6 dígitos
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="mt-1 w-full bg-blue-600 text-sm font-medium text-white
                         hover:bg-blue-500 focus-visible:ring-blue-500/40"
              disabled={submitting || (!useBackup && code.length < 6) || (useBackup && !code)}
            >
              {submitting ? "Verificando…" : "Verificar"}
            </Button>
          </form>

          <div className="mt-5 border-t border-white/[0.04] pt-4">
            <button
              type="button"
              onClick={toggleBackup}
              className="w-full text-center text-xs text-gray-500 transition-colors
                         hover:text-blue-400"
            >
              {useBackup
                ? "Usar código de la app autenticadora"
                : "Usar código de respaldo"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          Acceso restringido · solo personal autorizado
        </p>
      </div>
    </div>
  )
}
