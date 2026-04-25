import { NavLink } from "react-router-dom"
import { BarChart3, Home, Package, Receipt, Truck } from "lucide-react"

import { cn } from "@/lib/utils"

type SidebarProps = {
  onNavigate?: () => void
}

const items = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/ventas", label: "Ventas", icon: BarChart3 },
  { to: "/inventarios", label: "Almacén", icon: Package },
  { to: "/proveedores", label: "Proveedores", icon: Truck, disabled: true },
  { to: "/gastos", label: "Gastos", icon: Receipt, disabled: true },
]

export function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <nav className="flex h-full flex-col gap-3 px-3 py-4 text-white">
      <div className="flex h-14 items-center gap-3 rounded-[var(--radius-lg)] border border-white/10 bg-white/5 px-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[hsl(var(--primary))]">
          <BarChart3 className="h-4.5 w-4.5 text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">Nexus Ops RTB</div>
          <div className="truncate text-[11px] text-white/60">Dashboard operativo</div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon
          if (item.disabled) {
            return (
              <div
                key={item.to}
                className="flex cursor-not-allowed items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 text-sm text-white/45 opacity-80"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
                <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                  Pronto
                </span>
              </div>
            )
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 text-sm font-medium text-white/60 transition-all duration-150 hover:bg-white/8 hover:text-white",
                  isActive && "bg-[hsl(var(--primary))] text-white shadow-soft-sm"
                )
              }
              aria-label={`Ir a ${item.label}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </div>
      <div className="mt-auto rounded-[var(--radius-lg)] border border-white/10 bg-white/5 px-3 py-4 text-xs text-white/55">
        <div className="font-medium text-white/80">Navegación base</div>
        <div className="mt-1">Ventas y Almacén activos · resto en construcción</div>
      </div>
    </nav>
  )
}
