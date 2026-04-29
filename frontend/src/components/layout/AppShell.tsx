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
  "/ventas": { title: "Análisis de Ventas", subtitle: "Clientes · productos · márgenes" },
  "/inventarios": { title: "Almacén", subtitle: "Stock · movimientos · rotación" },
  "/proveedores": { title: "Proveedores" },
  "/gastos": { title: "Gastos Operativos RTB", subtitle: "Renta · servicios · viáticos · honorarios" },
  "/compras/solicitudes": { title: "Solicitudes de Material", subtitle: "Flujo de compras · paso 1 de 4" },
  "/compras/ordenes": { title: "Órdenes de Compra", subtitle: "Flujo de compras · paso 2 de 4" },
  "/compras/recepciones": { title: "Recepciones de Mercancía", subtitle: "Flujo de compras · paso 3 de 4" },
  "/compras/facturas": { title: "Facturas de Proveedor", subtitle: "Flujo de compras · paso 4 de 4" },
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] bg-[#1a1d21] md:block">
        <Sidebar />
      </aside>
      <main className="min-h-screen pt-16 md:pl-[220px]">
        <div className="min-h-[calc(100vh-64px)] px-4 py-5 md:px-6 md:py-6">
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
          "fixed inset-y-0 left-0 z-40 w-[220px] bg-[#1a1d21] shadow-soft-lg transition-transform md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Navegación"
      >
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </aside>
    </div>
  )
}
