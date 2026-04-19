import { useMemo, useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { env } from "@/lib/env"
import { ApiError } from "@/lib/http"
import { useAuth } from "@/hooks/useAuth"

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, login, clearError, error } = useAuth()

  const redirectTo = useMemo(() => {
    const fromState = (location.state as { from?: string } | null)?.from
    return typeof fromState === "string" ? fromState : "/"
  }, [location.state])

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [localError, setLocalError] = useState<string | null>(null)

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    setLocalError(null)
    setStatus("loading")
    try {
      await login({ email, password })
      setStatus("success")
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setStatus("error")
      if (err instanceof ApiError) {
        setLocalError(err.message || "No se pudo iniciar sesión")
        return
      }
      setLocalError("No se pudo iniciar sesión")
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-md items-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>
            Accede al dashboard operativo. API configurada:{" "}
            <span className="font-medium">{env.apiBaseUrl}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" aria-label="Formulario de login">
            {status === "error" || error || localError ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {localError ?? error ?? "No se pudo iniciar sesión"}
                </AlertDescription>
              </Alert>
            ) : null}
            {status === "success" ? (
              <Alert>
                <AlertTitle>Listo</AlertTitle>
                <AlertDescription>Sesión iniciada correctamente.</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="Email"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-label="Contraseña"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={status === "loading"}
              aria-label="Entrar"
            >
              {status === "loading" ? "Entrando..." : "Entrar"}
            </Button>
            <div className="text-xs text-muted-foreground">
              Si el backend está levantado, usa un usuario registrado en{" "}
              <span className="font-medium">/api/auth/register</span>.
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
