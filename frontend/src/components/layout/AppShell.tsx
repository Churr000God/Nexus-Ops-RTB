import { useMemo, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"

import { Header } from "@/components/layout/Header"
import { Sidebar } from "@/components/layout/Sidebar"
import { cn } from "@/lib/utils"

type AppShellProps = {
  userEmail?: string | null
  onLogout: () => void
}

const titlesByPath: Record<string, { title: string; subtitle?: string }> = {
  "/": { title: "Inicio", subtitle: "Resumen operativo" },
  "/ventas": { title: "Ventas" },
  "/inventarios": { title: "Inventarios" },
  "/proveedores": { title: "Proveedores" },
  "/gastos": { title: "Gastos" },
}

export function AppShell({ userEmail, onLogout }: AppShellProps) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const header = useMemo(() => {
    return titlesByPath[location.pathname] ?? { title: "Nexus Ops RTB" }
  }, [location.pathname])

  return (
    <div className="h-full">
      <Header
        onOpenSidebar={() => setMobileOpen(true)}
        title={header.title}
        subtitle={header.subtitle}
        userLabel={userEmail ?? undefined}
        onLogout={onLogout}
      />
      <div className="mx-auto grid h-[calc(100%-56px)] max-w-screen-2xl grid-cols-1 md:grid-cols-[260px_1fr]">
        <aside className="hidden border-r md:block">
          <Sidebar />
        </aside>
        <main className="min-w-0 overflow-y-auto">
          <div className="p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>

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
          "fixed inset-y-0 left-0 z-40 w-[280px] border-r bg-background shadow-soft-md transition-transform md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Navegación"
      >
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </aside>
    </div>
  )
}
