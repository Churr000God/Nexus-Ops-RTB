import { useMemo, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"

import { Header } from "@/components/layout/Header"
import { Sidebar } from "@/components/layout/Sidebar"
import { useSyncStatus } from "@/hooks/useSyncStatus"
import { cn } from "@/lib/utils"

type AppShellProps = {
  userEmail?: string | null
  onLogout: () => void
}

const titlesByPath: Record<string, { title: string; subtitle?: string }> = {
  "/": { title: "Nexus Ops RTB · Dashboard General", subtitle: "Vista ejecutiva consolidada" },

  // Ventas
  "/ventas/cotizaciones": { title: "Cotizaciones", subtitle: "Pipeline comercial · DRAFT → SENT → APROBADA" },
  "/ventas/notas-remision": { title: "Notas de Remisión", subtitle: "Entregas informales · conversión a cotización formal" },
  "/ventas/pedidos": { title: "Pedidos", subtitle: "Órdenes confirmadas · hitos · envíos · pagos · CFDIs" },
  "/ventas/reportes": { title: "Análisis de Ventas", subtitle: "Clientes · productos · márgenes · conversión" },
  "/ventas/operacional": { title: "Dashboard Operacional de Ventas", subtitle: "Resumen en tiempo real" },

  // Logística
  "/logistica/empacado": { title: "Empacado", subtitle: "Cola de pedidos a empacar · avance por partida" },
  "/logistica/envios": { title: "Envíos", subtitle: "Shipments · tracking · evidencia de entrega" },
  "/logistica/rutas": { title: "Rutas", subtitle: "Calendario de rutas · paradas · conductor · mapa" },
  "/logistica/fleteras": { title: "Fleteras", subtitle: "Propias y externas · URLs de tracking" },

  // Compras
  "/compras/solicitudes": { title: "Solicitudes de Material", subtitle: "Flujo de compras · paso 1 de 4" },
  "/compras/ordenes": { title: "Órdenes de Compra", subtitle: "Flujo de compras · paso 2 de 4" },
  "/compras/recepciones": { title: "Recepciones de Mercancía", subtitle: "Flujo de compras · paso 3 de 4" },
  "/compras/facturas": { title: "Facturas de Proveedor", subtitle: "Flujo de compras · paso 4 de 4" },
  "/compras/gastos": { title: "Gastos Operativos RTB", subtitle: "Renta · servicios · viáticos · honorarios" },

  // Inventario & Activos
  "/inventario": { title: "Almacén", subtitle: "Stock · movimientos · KPIs ABC · no conformes · snapshots" },
  "/equipos": { title: "Equipos", subtitle: "Assets · componentes · historial de cambios" },

  // Clientes & Proveedores
  "/clientes": { title: "Clientes", subtitle: "Maestro · multi-RFC · convenios Ariba · estado de cuenta" },
  "/proveedores": { title: "Proveedores", subtitle: "Maestro · catálogo · estado de cuenta · performance" },
  "/proveedores/catalogo": { title: "Catálogo Cross-Proveedor", subtitle: "Por SKU: opciones de proveedor · precio · lead time" },

  // Catálogos
  "/catalogos/productos": { title: "Catálogo de Productos", subtitle: "SKU · atributos · BOM · precios y costos" },
  "/catalogos/marcas": { title: "Marcas", subtitle: "Alta · edición · desactivación" },
  "/catalogos/categorias": { title: "Categorías", subtitle: "Árbol jerárquico · margen de rentabilidad" },

  // Facturación
  "/facturacion": { title: "CFDI 4.0 — Emitidos", subtitle: "Facturas · notas de crédito · complementos timbrados" },
  "/facturacion/emitir": { title: "Emitir Nuevo CFDI", subtitle: "Wizard de timbrado · PAC · XML/PDF" },
  "/facturacion/complementos": { title: "Complementos de Pago (PPD)", subtitle: "CFDI tipo P · saldo restante · partialities" },
  "/facturacion/notas-credito": { title: "Notas de Crédito", subtitle: "CFDI tipo E vinculados a facturas originales" },
  "/facturacion/cancelaciones": { title: "Cancelaciones", subtitle: "Motivo SAT · CFDI sustituto" },
  "/facturacion/pac-log": { title: "Bitácora PAC", subtitle: "Log de timbrados · errores · reintentos" },

  // Cobranza
  "/cobranza/ar": { title: "Cuentas por Cobrar", subtitle: "Aging: 0-30 · 31-60 · 61-90 · +90 días" },
  "/cobranza/ap": { title: "Cuentas por Pagar", subtitle: "Vencimientos de facturas de proveedor" },
  "/cobranza/pagos": { title: "Pagos Recibidos", subtitle: "Registrar · aplicar a CFDI/orden · generar complemento" },
  "/cobranza/sin-aplicar": { title: "Pagos Sin Aplicar", subtitle: "Saldo a favor del cliente pendiente de aplicar" },
  "/cobranza/flujo": { title: "Flujo de Caja Proyectado", subtitle: "Ingresos vs egresos por período · saldo acumulado" },

  // Reportes
  "/reportes/comercial": { title: "Reportes Comerciales", subtitle: "Ventas · pipeline · conversión · performance por vendedor" },
  "/reportes/margen": { title: "Margen y Rentabilidad", subtitle: "Por producto · categoría · cliente" },
  "/reportes/operacion": { title: "Reportes de Operación", subtitle: "KPIs almacén · no conformes · rutas · pedidos incompletos" },
  "/reportes/compras": { title: "Reportes de Compras", subtitle: "Top proveedores · cadena PR→PO→GR→Factura · aging AP" },
  "/reportes/financiero": { title: "Reportes Financieros", subtitle: "AR/AP · flujo de caja · facturación · cancelaciones" },

  // Administración
  "/admin/usuarios": { title: "Usuarios", subtitle: "Alta · roles · activar / desactivar" },
  "/admin/roles": { title: "Roles y Permisos", subtitle: "Matriz de permisos · asignación de usuarios" },
  "/admin/fiscal": { title: "Configuración Fiscal", subtitle: "Emisor · CSD · PAC · ambiente de timbrado" },
  "/admin/series": { title: "Series y Folios", subtitle: "Series CFDI · próximo folio · activar / desactivar" },
  "/admin/sat": { title: "Catálogos SAT", subtitle: "Producto/servicio · unidades · régimen · uso CFDI · formas de pago" },
  "/admin/audit-log": { title: "Bitácora de Auditoría", subtitle: "Cambios por entidad · usuario · fecha" },

  // Mi Cuenta
  "/cuenta/perfil": { title: "Mi Perfil", subtitle: "Nombre · email · roles · último acceso" },
  "/cuenta/password": { title: "Cambiar Contraseña", subtitle: "Actualizar credenciales de acceso" },
  "/cuenta/sesiones": { title: "Mis Sesiones", subtitle: "Dispositivos activos · cerrar sesión remota" },
}

export function AppShell({ userEmail, onLogout }: AppShellProps) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { status: syncStatus, triggering, trigger } = useSyncStatus()

  const header = useMemo(() => {
    return titlesByPath[location.pathname] ?? { title: "Nexus Ops RTB" }
  }, [location.pathname])

  return (
    <div className="min-h-full bg-background">
      <Header
        onOpenSidebar={() => setMobileOpen(true)}
        title={header.title}
        subtitle={header.subtitle}
        userLabel={userEmail ?? undefined}
        onLogout={onLogout}
        syncStatus={syncStatus}
        triggering={triggering}
        onSync={trigger}
      />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] bg-[#1a1d21] md:block">
        <Sidebar />
      </aside>
      <main className="h-screen overflow-hidden pt-16 md:pl-[240px]">
        <div className="h-full overflow-auto px-4 py-5 md:px-6 md:py-6">
          <Outlet />
        </div>
      </main>

      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-hidden={!mobileOpen}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[240px] bg-[#1a1d21] shadow-soft-lg transition-transform md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Navegación"
      >
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </aside>
    </div>
  )
}
