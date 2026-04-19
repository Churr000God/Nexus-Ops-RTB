import { NavLink } from "react-router-dom"
import { BarChart3, Home, Package, Receipt, Truck } from "lucide-react"

import { cn } from "@/lib/utils"

type SidebarProps = {
  onNavigate?: () => void
}

const items = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/ventas", label: "Ventas", icon: BarChart3 },
  { to: "/inventarios", label: "Inventarios", icon: Package, disabled: true },
  { to: "/proveedores", label: "Proveedores", icon: Truck, disabled: true },
  { to: "/gastos", label: "Gastos", icon: Receipt, disabled: true },
]

export function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <nav className="flex h-full flex-col gap-2 p-3">
      <div className="px-2 py-3">
        <div className="text-sm font-semibold text-foreground">Nexus Ops RTB</div>
        <div className="text-xs text-muted-foreground">Dashboard operativo</div>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon
          if (item.disabled) {
            return (
              <div
                key={item.to}
                className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground opacity-60"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wide">Pronto</span>
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
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-accent text-accent-foreground"
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
      <div className="mt-auto px-2 py-3 text-xs text-muted-foreground">
        <div>v0.1</div>
      </div>
    </nav>
  )
}
