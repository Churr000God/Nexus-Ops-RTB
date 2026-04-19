import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"

import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"
import { HomePage } from "@/pages/Home"
import { LoginPage } from "@/pages/Login"
import { NotFoundPage } from "@/pages/NotFound"
import { VentasPage } from "@/pages/Ventas"

function RequireAuth() {
  const location = useLocation()
  const { status, error, isAuthenticated } = useAuth()

  if (status === "booting") {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Cargando...</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Validando sesión.</CardContent>
      </Card>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return <Outlet />
}

function Shell() {
  const { user, logout } = useAuth()
  return <AppShell userEmail={user?.email ?? null} onLogout={logout} />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route index element={<HomePage />} />
          <Route path="ventas" element={<VentasPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
