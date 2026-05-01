import { NavLink } from "react-router-dom"
import {
  Ban,
  BarChart2,
  BarChart3,
  Box,
  Building2,
  ClipboardList,
  CreditCard,
  Database,
  FileCheck,
  FilePlus,
  FileSpreadsheet,
  FileText,
  FileX,
  Hash,
  Home,
  Key,
  Laptop,
  Layers,
  Package,
  PackageCheck,
  Receipt,
  Server,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Stamp,
  Store,
  Tag,
  TrendingUp,
  Truck,
  User,
  Users,
  Wallet,
  MapPin,
  Building,
} from "lucide-react"

import { usePermission } from "@/hooks/usePermission"
import { cn } from "@/lib/utils"

type SidebarProps = {
  onNavigate?: () => void
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-white/60 transition-all duration-150 hover:bg-white/8 hover:text-white",
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
  const canManageRoles = usePermission("role.manage")
  const showAdmin = canViewUsers || canViewAudit || canManageRoles

  return (
    <nav className="flex h-full flex-col px-3 py-4 text-white">
      {/* Logo */}
      <div className="mb-2 flex h-14 shrink-0 items-center gap-3 rounded-[var(--radius-lg)] border border-white/10 bg-white/5 px-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[hsl(var(--primary))]">
          <BarChart3 className="h-4.5 w-4.5 text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">Nexus Ops RTB</div>
          <div className="truncate text-[11px] text-white/60">Dashboard operativo</div>
        </div>
      </div>

      {/* Scrollable menu area */}
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto pr-0.5">
        {/* Inicio */}
        <NavItem to="/" label="Inicio" icon={Home} onNavigate={onNavigate} />

        {/* Ventas */}
        <SectionLabel>Ventas</SectionLabel>
        <NavItem to="/ventas/cotizaciones" label="Cotizaciones" icon={FileText} onNavigate={onNavigate} />
        <NavItem to="/ventas/notas-remision" label="Notas de Remisión" icon={FileCheck} onNavigate={onNavigate} />
        <NavItem to="/ventas/pedidos" label="Pedidos" icon={ShoppingCart} onNavigate={onNavigate} />
        <NavItem to="/ventas/reportes" label="Reportes" icon={BarChart3} onNavigate={onNavigate} />

        {/* Logística */}
        <SectionLabel>Logística</SectionLabel>
        <NavItem to="/logistica/empacado" label="Empacado" icon={PackageCheck} onNavigate={onNavigate} />
        <NavItem to="/logistica/envios" label="Envíos" icon={Truck} onNavigate={onNavigate} />
        <NavItem to="/logistica/rutas" label="Rutas" icon={MapPin} onNavigate={onNavigate} />
        <NavItem to="/logistica/fleteras" label="Fleteras" icon={Building2} onNavigate={onNavigate} />

        {/* Compras */}
        <SectionLabel>Compras</SectionLabel>
        <NavItem to="/compras/solicitudes" label="Solicitudes" icon={ClipboardList} onNavigate={onNavigate} />
        <NavItem to="/compras/ordenes" label="Órdenes de Compra" icon={ShoppingBag} onNavigate={onNavigate} />
        <NavItem to="/compras/recepciones" label="Recepciones" icon={Package} onNavigate={onNavigate} />
        <NavItem to="/compras/facturas" label="Facturas Proveedor" icon={FileText} onNavigate={onNavigate} />
        <NavItem to="/compras/gastos" label="Gastos Operativos" icon={Receipt} onNavigate={onNavigate} />

        {/* Inventario & Activos */}
        <SectionLabel>Inventario & Activos</SectionLabel>
        <NavItem to="/inventario" label="Almacén" icon={Package} onNavigate={onNavigate} />
        <NavItem to="/equipos" label="Equipos" icon={Laptop} onNavigate={onNavigate} />
        <NavItem to="/activos/conteos" label="Conteos Físicos" icon={ClipboardList} onNavigate={onNavigate} />

        {/* Clientes & Proveedores */}
        <SectionLabel>Clientes & Proveedores</SectionLabel>
        <NavItem to="/clientes" label="Clientes" icon={Building2} onNavigate={onNavigate} />
        <NavItem to="/proveedores" label="Proveedores" icon={Truck} onNavigate={onNavigate} />
        <NavItem to="/proveedores/catalogo" label="Catálogo Cross" icon={Store} onNavigate={onNavigate} />

        {/* Catálogos */}
        <SectionLabel>Catálogos</SectionLabel>
        <NavItem to="/catalogos/productos" label="Productos" icon={Box} onNavigate={onNavigate} />
        <NavItem to="/catalogos/marcas" label="Marcas" icon={Tag} onNavigate={onNavigate} />
        <NavItem to="/catalogos/categorias" label="Categorías" icon={Layers} onNavigate={onNavigate} />

        {/* Facturación */}
        <SectionLabel>Facturación</SectionLabel>
        <NavItem to="/facturacion" label="CFDIs Emitidos" icon={Stamp} onNavigate={onNavigate} />
        <NavItem to="/facturacion/emitir" label="Emitir Nuevo" icon={FilePlus} onNavigate={onNavigate} />
        <NavItem to="/facturacion/complementos" label="Complementos Pago" icon={CreditCard} onNavigate={onNavigate} />
        <NavItem to="/facturacion/notas-credito" label="Notas de Crédito" icon={FileX} onNavigate={onNavigate} />
        <NavItem to="/facturacion/cancelaciones" label="Cancelaciones" icon={Ban} onNavigate={onNavigate} />
        <NavItem to="/facturacion/pac-log" label="Bitácora PAC" icon={Server} onNavigate={onNavigate} />

        {/* Cobranza */}
        <SectionLabel>Cobranza</SectionLabel>
        <NavItem to="/cobranza/ar" label="Cuentas x Cobrar" icon={TrendingUp} onNavigate={onNavigate} />
        <NavItem to="/cobranza/ap" label="Cuentas x Pagar" icon={FileSpreadsheet} onNavigate={onNavigate} />
        <NavItem to="/cobranza/pagos" label="Pagos Recibidos" icon={Wallet} onNavigate={onNavigate} />
        <NavItem to="/cobranza/sin-aplicar" label="Sin Aplicar" icon={CreditCard} onNavigate={onNavigate} />
        <NavItem to="/cobranza/flujo" label="Flujo de Caja" icon={BarChart2} onNavigate={onNavigate} />

        {/* Reportes */}
        <SectionLabel>Reportes</SectionLabel>
        <NavItem to="/reportes/comercial" label="Comercial" icon={FileSpreadsheet} onNavigate={onNavigate} />
        <NavItem to="/reportes/margen" label="Margen" icon={BarChart3} onNavigate={onNavigate} />
        <NavItem to="/reportes/operacion" label="Operación" icon={Package} onNavigate={onNavigate} />
        <NavItem to="/reportes/compras" label="Compras" icon={ShoppingBag} onNavigate={onNavigate} />
        <NavItem to="/reportes/financiero" label="Financiero" icon={BarChart2} onNavigate={onNavigate} />

        {/* Administración */}
        {showAdmin && (
          <>
            <SectionLabel>Administración</SectionLabel>
            {canViewUsers && (
              <NavItem to="/admin/usuarios" label="Usuarios" icon={Users} onNavigate={onNavigate} />
            )}
            {canManageRoles && (
              <NavItem to="/admin/roles" label="Roles y Permisos" icon={Shield} onNavigate={onNavigate} />
            )}
            {canManageRoles && (
              <NavItem to="/admin/fiscal" label="Config. Fiscal" icon={Building} onNavigate={onNavigate} />
            )}
            {canManageRoles && (
              <NavItem to="/admin/series" label="Series y Folios" icon={Hash} onNavigate={onNavigate} />
            )}
            {canManageRoles && (
              <NavItem to="/admin/sat" label="Catálogos SAT" icon={Database} onNavigate={onNavigate} />
            )}
            {canViewAudit && (
              <NavItem to="/admin/audit-log" label="Bitácora" icon={ClipboardList} onNavigate={onNavigate} />
            )}
          </>
        )}

        {/* Mi Cuenta */}
        <SectionLabel>Mi Cuenta</SectionLabel>
        <NavItem to="/cuenta/perfil" label="Mi Perfil" icon={User} onNavigate={onNavigate} />
        <NavItem to="/cuenta/password" label="Contraseña" icon={Key} onNavigate={onNavigate} />
        <NavItem to="/cuenta/sesiones" label="Sesiones" icon={Smartphone} onNavigate={onNavigate} />
      </div>

      {/* Footer — fijo al fondo */}
      <div className="mt-2 shrink-0 rounded-[var(--radius-lg)] border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/55">
        <div className="font-medium text-white/80">Nexus Ops RTB</div>
        <div className="mt-0.5">v2026.04</div>
      </div>
    </nav>
  )
}
