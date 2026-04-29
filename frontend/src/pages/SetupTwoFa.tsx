import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import QRCode from "react-qr-code"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/http"
import { useAuth } from "@/hooks/useAuth"

type Step = "scan" | "backup"

export function SetupTwoFaPage() {
  const navigate = useNavigate()
  const { mfaToken, completeMfaSetup, confirmMfaSetup } = useAuth()

  const [step, setStep] = useState<Step>("scan")
  const [secret, setSecret] = useState("")
  const [qrUri, setQrUri] = useState("")
  const [code, setCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!mfaToken) {
      navigate("/login", { replace: true })
      return
    }
    completeMfaSetup()
      .then((data) => {
        setSecret(data.secret)
        setQrUri(data.qr_uri)
      })
      .catch(() => {
        navigate("/login", { replace: true })
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const codes = await confirmMfaSetup(code)
      setBackupCodes(codes)
      setStep("backup")
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Código incorrecto")
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("No se pudo verificar el código")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleCopyAll() {
    await navigator.clipboard.writeText(backupCodes.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (step === "backup") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1115] px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl
                            bg-emerald-600/20 ring-1 ring-emerald-500/30">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-400" fill="none"
                   stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Autenticación activada
            </h1>
            <p className="mt-1 text-sm text-gray-500">Guarda tus códigos de respaldo</p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#1a1d21] p-7 shadow-2xl">
            <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5">
              <p className="text-xs text-amber-400">
                Estos códigos solo se muestran una vez. Guárdalos en un lugar seguro —
                son tu única opción de acceso si pierdes tu dispositivo.
              </p>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2">
              {backupCodes.map((c) => (
                <span
                  key={c}
                  className="rounded bg-[#0f1115] px-3 py-1.5 font-mono text-xs text-emerald-400"
                >
                  {c}
                </span>
              ))}
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full border-white/[0.08] bg-white/[0.04] text-sm text-gray-300
                           hover:bg-white/[0.08] hover:text-white"
                onClick={handleCopyAll}
              >
                {copied ? "Copiado" : "Copiar todos los códigos"}
              </Button>

              <Button
                type="button"
                className="w-full bg-blue-600 text-sm font-medium text-white hover:bg-blue-500"
                onClick={() => navigate("/", { replace: true })}
              >
                Entrar al sistema
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
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
                    d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25
                       2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3
                       0h3m-3 18.75h3" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Configura tu autenticador
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Escanea el código QR con Google Authenticator o similar
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#1a1d21] p-7 shadow-2xl">
          {qrUri ? (
            <div className="mb-5 flex justify-center">
              <div
                style={{
                  background: "white",
                  padding: "8px",
                  borderRadius: "8px",
                  display: "inline-block",
                }}
              >
                <QRCode value={qrUri} size={180} />
              </div>
            </div>
          ) : (
            <div className="mb-5 flex h-[196px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-500" />
            </div>
          )}

          {secret && (
            <div className="mb-5">
              <p className="mb-1.5 text-xs text-gray-500">
                ¿No puedes escanear? Ingresa este código manualmente:
              </p>
              <div className="rounded bg-[#0f1115] px-3 py-2 font-mono text-xs tracking-widest text-gray-300 break-all">
                {secret}
              </div>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="totp-code" className="text-xs font-medium text-gray-400">
                Código de verificación
              </label>
              <Input
                id="totp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                className="h-9 border-white/[0.08] bg-white/[0.04] text-center text-lg
                           font-mono tracking-[0.4em] text-gray-100
                           placeholder:text-gray-600 focus-visible:border-blue-500/50
                           focus-visible:ring-blue-500/20"
              />
            </div>

            <Button
              type="submit"
              className="mt-1 w-full bg-blue-600 text-sm font-medium text-white
                         hover:bg-blue-500 focus-visible:ring-blue-500/40"
              disabled={loading || code.length < 6}
            >
              {loading ? "Verificando…" : "Activar autenticación"}
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
