import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"

import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"
import { AdminAuditLogPage } from "@/pages/AdminAuditLog"
import { AdminUsuariosPage } from "@/pages/AdminUsuarios"
import { RolesPage } from "@/pages/admin/RolesPage"
import { FiscalPage } from "@/pages/admin/FiscalPage"
import { SeriesPage } from "@/pages/admin/SeriesPage"
import { SatPage } from "@/pages/admin/SatPage"
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
import CfdiPage from "@/pages/CfdiPage"
import VentasOperacional from "@/pages/VentasOperacional"
import { VentasPage } from "@/pages/Ventas"
// Ventas
import { ReportesVentasPage } from "@/pages/ventas/ReportesVentasPage"
// Logística
import { EmpacadoPage } from "@/pages/logistica/EmpacadoPage"
// Proveedores
import { CatalogoPage } from "@/pages/proveedores/CatalogoPage"
// Catálogos
import { ProductosCatalogoPage } from "@/pages/catalogos/ProductosCatalogoPage"
import { MarcasPage } from "@/pages/catalogos/MarcasPage"
import { CategoriasPage } from "@/pages/catalogos/CategoriasPage"
// Facturación
import { EmitirCfdiPage } from "@/pages/facturacion/EmitirCfdiPage"
import { ComplementosPagoPage } from "@/pages/facturacion/ComplementosPagoPage"
import { NotasCreditoPage } from "@/pages/facturacion/NotasCreditoPage"
import { CancelacionesPage } from "@/pages/facturacion/CancelacionesPage"
import { PacLogPage } from "@/pages/facturacion/PacLogPage"
// Cobranza
import { ArPage } from "@/pages/cobranza/ArPage"
import { ApPage } from "@/pages/cobranza/ApPage"
import { PagosPage } from "@/pages/cobranza/PagosPage"
import { SinAplicarPage } from "@/pages/cobranza/SinAplicarPage"
import { FlujoCajaPage } from "@/pages/cobranza/FlujoCajaPage"
// Reportes
import { ComercialPage } from "@/pages/reportes/ComercialPage"
import { MargenPage } from "@/pages/reportes/MargenPage"
import { OperacionPage } from "@/pages/reportes/OperacionPage"
import { ComprasReportesPage } from "@/pages/reportes/ComprasReportesPage"
import { FinancieroPage } from "@/pages/reportes/FinancieroPage"
// Mi Cuenta
import { PerfilPage } from "@/pages/cuenta/PerfilPage"
import { PasswordPage } from "@/pages/cuenta/PasswordPage"
import { SesionesPage } from "@/pages/cuenta/SesionesPage"

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

          {/* ── Ventas ── */}
          <Route path="ventas" element={<Navigate to="/ventas/cotizaciones" replace />} />
          <Route path="ventas/operacional" element={<VentasOperacional />} />
          <Route path="ventas/cotizaciones" element={<CotizacionesPage />} />
          <Route path="ventas/pedidos" element={<PedidosPage />} />
          <Route path="ventas/notas-remision" element={<NotasRemisionPage />} />
          <Route path="ventas/reportes" element={<VentasPage />} />

          {/* ── Logística ── */}
          <Route path="logistica/empacado" element={<EmpacadoPage />} />
          <Route path="logistica/envios" element={<EnviosPage />} />
          <Route path="logistica/rutas" element={<RutasPage />} />
          <Route path="logistica/fleteras" element={<FleterasPage />} />

          {/* ── Compras ── */}
          <Route path="compras/solicitudes" element={<SolicitudesPage />} />
          <Route path="compras/ordenes" element={<OrdenesPage />} />
          <Route path="compras/recepciones" element={<RecepcionesPage />} />
          <Route path="compras/facturas" element={<FacturasProveedorPage />} />
          <Route path="compras/gastos" element={<GastosPage />} />
          <Route path="gastos" element={<Navigate to="/compras/gastos" replace />} />

          {/* ── Inventario ── */}
          <Route path="inventario" element={<AlmacenPage />} />
          <Route path="inventarios" element={<Navigate to="/inventario" replace />} />

          {/* ── Equipos ── */}
          <Route path="equipos" element={<EquiposPage />} />

          {/* ── Clientes ── */}
          <Route path="clientes" element={<ClientesPage />} />

          {/* ── Proveedores ── */}
          <Route path="proveedores" element={<ProveedoresMaestroPage />} />
          <Route path="proveedores/maestro" element={<Navigate to="/proveedores" replace />} />
          <Route path="proveedores/catalogo" element={<CatalogoPage />} />

          {/* ── Catálogos ── */}
          <Route path="catalogos/productos" element={<ProductosCatalogoPage />} />
          <Route path="catalogos/marcas" element={<MarcasPage />} />
          <Route path="catalogos/categorias" element={<CategoriasPage />} />

          {/* ── Facturación ── */}
          <Route path="facturacion" element={<CfdiPage />} />
          <Route path="cfdi" element={<Navigate to="/facturacion" replace />} />
          <Route path="facturacion/emitir" element={<EmitirCfdiPage />} />
          <Route path="facturacion/complementos" element={<ComplementosPagoPage />} />
          <Route path="facturacion/notas-credito" element={<NotasCreditoPage />} />
          <Route path="facturacion/cancelaciones" element={<CancelacionesPage />} />
          <Route path="facturacion/pac-log" element={<PacLogPage />} />

          {/* ── Cobranza ── */}
          <Route path="cobranza/ar" element={<ArPage />} />
          <Route path="cobranza/ap" element={<ApPage />} />
          <Route path="cobranza/pagos" element={<PagosPage />} />
          <Route path="cobranza/sin-aplicar" element={<SinAplicarPage />} />
          <Route path="cobranza/flujo" element={<FlujoCajaPage />} />

          {/* ── Reportes ── */}
          <Route path="reportes/comercial" element={<ComercialPage />} />
          <Route path="reportes/margen" element={<MargenPage />} />
          <Route path="reportes/operacion" element={<OperacionPage />} />
          <Route path="reportes/compras" element={<ComprasReportesPage />} />
          <Route path="reportes/financiero" element={<FinancieroPage />} />

          {/* ── Administración ── */}
          <Route path="admin/usuarios" element={<AdminUsuariosPage />} />
          <Route path="admin/roles" element={<RolesPage />} />
          <Route path="admin/fiscal" element={<FiscalPage />} />
          <Route path="admin/series" element={<SeriesPage />} />
          <Route path="admin/sat" element={<SatPage />} />
          <Route path="admin/audit-log" element={<AdminAuditLogPage />} />

          {/* ── Mi Cuenta ── */}
          <Route path="cuenta/perfil" element={<PerfilPage />} />
          <Route path="cuenta/password" element={<PasswordPage />} />
          <Route path="cuenta/sesiones" element={<SesionesPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
