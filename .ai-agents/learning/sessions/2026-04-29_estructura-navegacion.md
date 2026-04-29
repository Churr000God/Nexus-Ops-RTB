# Sesion: Módulo 16 — Estructura de Navegación completa del sistema

**Fecha:** 2026-04-29
**Agente:** Claude Sonnet 4.6
**Area:** frontend
**Sprint:** 5
**Duracion aprox:** 60 min

## Objetivo

Implementar la arquitectura de navegación completa del sistema RTB siguiendo
`Reestructuracion_Bases_Datos/16_estructura_navegacion.docx`.

- Reorganizar el Sidebar de ~20 ítems planos a 14 secciones temáticas con RBAC
- Registrar 50+ rutas en `routes.tsx` incluyendo redirects para URLs antiguas
- Crear páginas stub (`PlaceholderPage`) para los 28 módulos pendientes de implementación
- Ampliar `AppShell.titlesByPath` con títulos y subtítulos de cada ruta nueva

## Contexto Previo

Módulos ya implementados con rutas ad-hoc:
- Ventas, Logística, Compras, Inventario, Equipos, Clientes, Proveedores, CFDI, Admin (usuarios + bitácora)
- El sidebar tenía estructura plana informal sin agrupación definitiva
- La ruta `/gastos` estaba suelta (no bajo `/compras`)
- El módulo CFDI estaba en `/cfdi` en lugar de `/facturacion`
- No había rutas para Catálogos, Cobranza, Reportes ni Mi Cuenta

## Trabajo Realizado

### PlaceholderPage
Componente reutilizable `frontend/src/components/common/PlaceholderPage.tsx`.
Muestra un `Card` con icono `Construction`, título y descripción. Scaffold genérico
para cualquier módulo pendiente de implementación.

### 28 páginas stub
Creadas usando `PlaceholderPage` en subdirectorios por módulo:
`ventas/`, `logistica/`, `proveedores/`, `catalogos/`, `facturacion/`,
`cobranza/`, `reportes/`, `admin/` (4 nuevas), `cuenta/`.

### routes.tsx
- 50+ rutas registradas con imports corregidos (default vs named export)
- 5 `<Navigate replace>` para rutas antiguas: `/cfdi`, `/inventarios`,
  `/proveedores/maestro`, `/gastos`, `/ventas`
- Todas las rutas stub apuntan a sus respectivos componentes

### Sidebar.tsx
- 14 secciones con `SectionLabel` + `NavItem`
- Scrollable: `flex-1 overflow-y-auto` en el área de menú
- Ancho: 220 → 240 px (necesario para ítems más largos)
- RBAC guards extendidos: `role.manage` para sub-ítems de Admin
- Footer fijo al fondo con `shrink-0 mt-2`

### AppShell.tsx
- `titlesByPath`: 45+ entradas con título descriptivo y subtítulo operativo
- Ancho `md:pl` actualizado de `[220px]` a `[240px]`

### Fix bonus: CfdiPage.tsx
Error pre-existente TS2322: `rowKey={(r) => r.cfdi_id}` — `number` no asignable a `string`.
Corregido en 3 instancias con `String(r.cfdi_id)`.

## Decisiones Tomadas

- **PlaceholderPage como scaffold** en lugar de páginas vacías: permite navegar al
  módulo sin 404 y documenta el estado "pendiente" al usuario.
- **Redirects `<Navigate replace>` en lugar de eliminar rutas**: backward compatible
  con bookmarks existentes y otras referencias.
- **Sidebar sin guards para la mayoría de módulos**: igual que antes — la visibilidad
  RBAC completa es una fase posterior. Solo Admin tiene guards por ser la sección
  más sensible.
- **VentasPage reutilizada como `/ventas/reportes`**: evita eliminar código implementado;
  el análisis de ventas encaja perfectamente como sub-sección de Reportes de Ventas.
- **Scrollable en el área de menú (no en el nav entero)**: el logo y el footer quedan
  fijos; solo el cuerpo de links hace scroll. Mejor UX que scroll total del sidebar.

## Errores Encontrados

- **Imports con `{}` para default exports**: `routes.tsx` original usaba default exports
  para varias páginas (CotizacionesPage, EnviosPage, GastosPage, etc.) pero el nuevo
  archivo los importó inicialmente con named exports `{}` → error de compilación.
  Fix: inspeccionar `grep "^export"` en cada archivo y usar el estilo correcto.

## Lecciones Aprendidas

- En React Router v6, `<Navigate to="..." replace />` dentro de `<Route>` es el
  patrón correcto para redirects permanentes — no requiere componente extra.
- Antes de reescribir un `routes.tsx` con ~30 imports nuevos, verificar el estilo de
  export (default vs named) de cada archivo con `grep "^export"`. Un solo archivo
  con estilo incorrecto rompe el build de TypeScript.
- Para sidebars con muchos ítems: `flex-1 overflow-y-auto` en el contenedor del menú
  y `shrink-0` en logo y footer es el patrón CSS correcto. `h-full` en el nav padre
  es prerequisito para que `overflow-y-auto` funcione.

## Archivos Modificados

**Nuevos (31):**
- `frontend/src/components/common/PlaceholderPage.tsx`
- `frontend/src/pages/ventas/ReportesVentasPage.tsx`
- `frontend/src/pages/logistica/EmpacadoPage.tsx`
- `frontend/src/pages/proveedores/CatalogoPage.tsx`
- `frontend/src/pages/catalogos/{ProductosCatalogoPage,MarcasPage,CategoriasPage}.tsx`
- `frontend/src/pages/facturacion/{EmitirCfdiPage,ComplementosPagoPage,NotasCreditoPage,CancelacionesPage,PacLogPage}.tsx`
- `frontend/src/pages/cobranza/{ArPage,ApPage,PagosPage,SinAplicarPage,FlujoCajaPage}.tsx`
- `frontend/src/pages/reportes/{ComercialPage,MargenPage,OperacionPage,ComprasReportesPage,FinancieroPage}.tsx`
- `frontend/src/pages/admin/{RolesPage,FiscalPage,SeriesPage,SatPage}.tsx`
- `frontend/src/pages/cuenta/{PerfilPage,PasswordPage,SesionesPage}.tsx`

**Modificados (4):**
- `frontend/src/routes.tsx` — árbol completo de 50+ rutas
- `frontend/src/components/layout/Sidebar.tsx` — rediseño completo 14 secciones
- `frontend/src/components/layout/AppShell.tsx` — titlesByPath 45+ entradas
- `frontend/src/pages/CfdiPage.tsx` — fix TS2322 rowKey ×3

## Siguiente Paso

Con la navegación en pie, los siguientes módulos a implementar reemplazando sus stubs:
1. **Catálogos** (productos/marcas/categorías) — `09_modulo_productos_pricing.docx`
2. **Cobranza / Finanzas** — AR, AP, pagos, flujo de caja
3. **Reportes** — 5 secciones de BI
4. **Admin: Roles y Permisos UI** — gestión visual de la matriz RBAC
5. **Config. Fiscal + Series** — administración de emisor CFDI y series de folios
