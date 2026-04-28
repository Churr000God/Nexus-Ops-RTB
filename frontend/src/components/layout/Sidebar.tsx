import { NavLink } from "react-router-dom"
import { BarChart3, Building2, ClipboardList, Home, Package, Receipt, Shield, Truck, Users } from "lucide-react"

import { usePermission } from "@/hooks/usePermission"
import { cn } from "@/lib/utils"

type SidebarProps = {
  onNavigate?: () => void
}

const items = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/ventas", label: "Ventas", icon: BarChart3 },
  { to: "/inventarios", label: "Almacén", icon: Package },
  { to: "/clientes", label: "Clientes", icon: Building2 },
  { to: "/proveedores/maestro", label: "Proveedores", icon: Truck },
  { to: "/gastos", label: "Gastos", icon: Receipt, disabled: true },
]

export function Sidebar({ onNavigate }: SidebarProps) {
  const canViewUsers = usePermission("user.view")
  const canViewAudit = usePermission("audit.view")
  const showAdmin = canViewUsers || canViewAudit

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
      {showAdmin && (
        <div className="flex flex-col gap-1">
          <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
            Administración
          </p>
          {canViewUsers && (
            <NavLink
              to="/admin/usuarios"
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 text-sm font-medium text-white/60 transition-all duration-150 hover:bg-white/8 hover:text-white",
                  isActive && "bg-[hsl(var(--primary))] text-white shadow-soft-sm"
                )
              }
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>Usuarios</span>
            </NavLink>
          )}
          {canViewAudit && (
            <NavLink
              to="/admin/audit-log"
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 text-sm font-medium text-white/60 transition-all duration-150 hover:bg-white/8 hover:text-white",
                  isActive && "bg-[hsl(var(--primary))] text-white shadow-soft-sm"
                )
              }
            >
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              <span>Bitácora</span>
            </NavLink>
          )}
        </div>
      )}

      <div className="mt-auto rounded-[var(--radius-lg)] border border-white/10 bg-white/5 px-3 py-4 text-xs text-white/55">
        <div className="font-medium text-white/80">Nexus Ops RTB</div>
        <div className="mt-1">Gastos en construcción</div>
      </div>
    </nav>
  )
}
