import { NavLink } from "react-router-dom"
import {
  BarChart3,
  Box,
  Building2,
  ClipboardList,
  FileCheck,
  FileText,
  Home,
  Laptop,
  LayoutDashboard,
  MapPin,
  Package,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Stamp,
  Truck,
  Users,
} from "lucide-react"

import { usePermission } from "@/hooks/usePermission"
import { cn } from "@/lib/utils"

type SidebarProps = {
  onNavigate?: () => void
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-white/60 transition-all duration-150 hover:bg-white/8 hover:text-white",
    isActive && "bg-[hsl(var(--primary))] text-white shadow-soft-sm"
  )

function NavItem({
  to,
  label,
  icon: Icon,
  onNavigate,
}: {
  to: string
  label: string
  icon: React.ElementType
  onNavigate?: () => void
}) {
  return (
    <NavLink to={to} onClick={onNavigate} className={navLinkClass} aria-label={`Ir a ${label}`}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-3 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/40">
      {children}
    </p>
  )
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const canViewUsers = usePermission("user.view")
  const canViewAudit = usePermission("audit.view")
  const showAdmin = canViewUsers || canViewAudit

  return (
    <nav className="flex h-full flex-col gap-1 px-3 py-4 text-white">
      {/* Logo */}
      <div className="mb-2 flex h-14 items-center gap-3 rounded-[var(--radius-lg)] border border-white/10 bg-white/5 px-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[hsl(var(--primary))]">
          <BarChart3 className="h-4.5 w-4.5 text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">Nexus Ops RTB</div>
          <div className="truncate text-[11px] text-white/60">Dashboard operativo</div>
        </div>
      </div>

      {/* General */}
      <div className="flex flex-col gap-0.5">
        <NavItem to="/" label="Inicio" icon={Home} onNavigate={onNavigate} />
        <NavItem to="/ventas" label="Análisis Ventas" icon={BarChart3} onNavigate={onNavigate} />
        <NavItem to="/inventarios" label="Almacén" icon={Package} onNavigate={onNavigate} />
        <NavItem to="/equipos" label="Equipos" icon={Laptop} onNavigate={onNavigate} />
        <NavItem to="/clientes" label="Clientes" icon={Building2} onNavigate={onNavigate} />
        <NavItem to="/proveedores/maestro" label="Proveedores" icon={Truck} onNavigate={onNavigate} />
        <NavItem to="/gastos" label="Gastos" icon={Receipt} onNavigate={onNavigate} />
      </div>

      {/* Compras */}
      <div className="flex flex-col gap-0.5">
        <SectionLabel>Compras</SectionLabel>
        <NavItem to="/compras/solicitudes" label="Solicitudes" icon={ClipboardList} onNavigate={onNavigate} />
        <NavItem to="/compras/ordenes" label="Órdenes de Compra" icon={ShoppingBag} onNavigate={onNavigate} />
        <NavItem to="/compras/recepciones" label="Recepciones" icon={Package} onNavigate={onNavigate} />
        <NavItem to="/compras/facturas" label="Facturas Proveedor" icon={FileText} onNavigate={onNavigate} />
      </div>

      {/* Facturación */}
      <div className="flex flex-col gap-0.5">
        <SectionLabel>Facturación</SectionLabel>
        <NavItem to="/cfdi" label="CFDI 4.0" icon={Stamp} onNavigate={onNavigate} />
      </div>

      {/* Ventas Operativo */}
      <div className="flex flex-col gap-0.5">
        <SectionLabel>Ventas Operativo</SectionLabel>
        <NavItem to="/ventas/operacional" label="Dashboard" icon={LayoutDashboard} onNavigate={onNavigate} />
        <NavItem to="/ventas/cotizaciones" label="Cotizaciones" icon={FileText} onNavigate={onNavigate} />
        <NavItem to="/ventas/pedidos" label="Pedidos" icon={ShoppingCart} onNavigate={onNavigate} />
        <NavItem to="/ventas/notas-remision" label="Notas de Remisión" icon={FileCheck} onNavigate={onNavigate} />
      </div>

      {/* Logística */}
      <div className="flex flex-col gap-0.5">
        <SectionLabel>Logística</SectionLabel>
        <NavItem to="/logistica/envios" label="Envíos" icon={Box} onNavigate={onNavigate} />
        <NavItem to="/logistica/rutas" label="Rutas" icon={MapPin} onNavigate={onNavigate} />
        <NavItem to="/logistica/fleteras" label="Fleteras" icon={Truck} onNavigate={onNavigate} />
      </div>

      {/* Administración */}
      {showAdmin && (
        <div className="flex flex-col gap-0.5">
          <SectionLabel>Administración</SectionLabel>
          {canViewUsers && (
            <NavItem to="/admin/usuarios" label="Usuarios" icon={Users} onNavigate={onNavigate} />
          )}
          {canViewAudit && (
            <NavItem to="/admin/audit-log" label="Bitácora" icon={ClipboardList} onNavigate={onNavigate} />
          )}
        </div>
      )}

      <div className="mt-auto rounded-[var(--radius-lg)] border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/55">
        <div className="font-medium text-white/80">Nexus Ops RTB</div>
        <div className="mt-0.5">v2026.04</div>
      </div>
    </nav>
  )
}
