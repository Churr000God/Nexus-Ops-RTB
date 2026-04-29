import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"

import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"
import { AdminAuditLogPage } from "@/pages/AdminAuditLog"
import { AdminUsuariosPage } from "@/pages/AdminUsuarios"
import { ClientesPage } from "@/pages/Clientes"
import FacturasProveedorPage from "@/pages/compras/FacturasProveedorPage"
import OrdenesPage from "@/pages/compras/OrdenesPage"
import RecepcionesPage from "@/pages/compras/RecepcionesPage"
import SolicitudesPage from "@/pages/compras/SolicitudesPage"
import CotizacionesPage from "@/pages/CotizacionesPage"
import EnviosPage from "@/pages/EnviosPage"
import FleterasPage from "@/pages/FleterasPage"
import EquiposPage from "@/pages/EquiposPage"
import GastosPage from "@/pages/GastosPage"
import { HomePage } from "@/pages/Home"
import { AlmacenPage } from "@/pages/Inventarios"
import { LoginPage } from "@/pages/Login"
import { NotFoundPage } from "@/pages/NotFound"
import NotasRemisionPage from "@/pages/NotasRemisionPage"
import PedidosPage from "@/pages/PedidosPage"
import { ProveedoresMaestroPage } from "@/pages/ProveedoresMaestro"
import RutasPage from "@/pages/RutasPage"
import VentasOperacional from "@/pages/VentasOperacional"
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
          <Route path="inventarios" element={<AlmacenPage />} />
          <Route path="equipos" element={<EquiposPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="proveedores/maestro" element={<ProveedoresMaestroPage />} />
          <Route path="ventas/operacional" element={<VentasOperacional />} />
          <Route path="ventas/cotizaciones" element={<CotizacionesPage />} />
          <Route path="ventas/pedidos" element={<PedidosPage />} />
          <Route path="ventas/notas-remision" element={<NotasRemisionPage />} />
          <Route path="logistica/envios" element={<EnviosPage />} />
          <Route path="logistica/rutas" element={<RutasPage />} />
          <Route path="logistica/fleteras" element={<FleterasPage />} />
          <Route path="gastos" element={<GastosPage />} />
          <Route path="compras/solicitudes" element={<SolicitudesPage />} />
          <Route path="compras/ordenes" element={<OrdenesPage />} />
          <Route path="compras/recepciones" element={<RecepcionesPage />} />
          <Route path="compras/facturas" element={<FacturasProveedorPage />} />
          <Route path="admin/usuarios" element={<AdminUsuariosPage />} />
          <Route path="admin/audit-log" element={<AdminAuditLogPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
