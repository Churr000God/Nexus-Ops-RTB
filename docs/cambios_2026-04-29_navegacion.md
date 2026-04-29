# Módulo 16 — Estructura de Navegación (2026-04-29)

## Contexto

Se implementó la arquitectura de navegación completa del sistema RTB
siguiendo el documento `Reestructuracion_Bases_Datos/16_estructura_navegacion.docx`.

Este módulo es exclusivamente **frontend** — no hay cambios de BD ni de backend.
Define la estructura de 14 módulos, rutas canónicas, RBAC de visibilidad en sidebar
y páginas stub para los módulos pendientes de implementación.

---

## Commit

`95bddef` — `feat(nav): implementa estructura de navegación completa — 14 módulos, 50+ rutas`

---

## Cambios de rutas (redirects permanentes activos)

Las rutas antiguas siguen funcionando vía `<Navigate replace>`:

| Ruta antigua | Ruta nueva | Motivo |
|---|---|---|
| `/cfdi` | `/facturacion` | Renombrado a módulo Facturación |
| `/inventarios` | `/inventario` | Normalización (singular) |
| `/proveedores/maestro` | `/proveedores` | Simplificación de path |
| `/gastos` | `/compras/gastos` | Gastos es sub-sección de Compras |
| `/ventas` | `/ventas/cotizaciones` | Ventas es sección, no página directa |

---

## Árbol de rutas resultante

```
/                           → Home (dashboard ejecutivo)

/ventas/cotizaciones        → CotizacionesPage          [implementado]
/ventas/notas-remision      → NotasRemisionPage          [implementado]
/ventas/pedidos             → PedidosPage                [implementado]
/ventas/reportes            → VentasPage (reutilizada)   [implementado]
/ventas/operacional         → VentasOperacional           [implementado, no en sidebar]

/logistica/empacado         → EmpacadoPage               [stub]
/logistica/envios           → EnviosPage                 [implementado]
/logistica/rutas            → RutasPage                  [implementado]
/logistica/fleteras         → FleterasPage               [implementado]

/compras/solicitudes        → SolicitudesPage            [implementado]
/compras/ordenes            → OrdenesPage                [implementado]
/compras/recepciones        → RecepcionesPage            [implementado]
/compras/facturas           → FacturasProveedorPage      [implementado]
/compras/gastos             → GastosPage (movida)        [implementado]

/inventario                 → AlmacenPage                [implementado]
/equipos                    → EquiposPage                [implementado]

/clientes                   → ClientesPage               [implementado]
/proveedores                → ProveedoresMaestroPage     [implementado]
/proveedores/catalogo       → CatalogoPage               [stub]

/catalogos/productos        → ProductosCatalogoPage      [stub]
/catalogos/marcas           → MarcasPage                 [stub]
/catalogos/categorias       → CategoriasPage             [stub]

/facturacion                → CfdiPage (ruta principal)  [implementado]
/facturacion/emitir         → EmitirCfdiPage             [stub]
/facturacion/complementos   → ComplementosPagoPage       [stub]
/facturacion/notas-credito  → NotasCreditoPage           [stub]
/facturacion/cancelaciones  → CancelacionesPage          [stub]
/facturacion/pac-log        → PacLogPage                 [stub]

/cobranza/ar                → ArPage                     [stub]
/cobranza/ap                → ApPage                     [stub]
/cobranza/pagos             → PagosPage                  [stub]
/cobranza/sin-aplicar       → SinAplicarPage             [stub]
/cobranza/flujo             → FlujoCajaPage              [stub]

/reportes/comercial         → ComercialPage              [stub]
/reportes/margen            → MargenPage                 [stub]
/reportes/operacion         → OperacionPage              [stub]
/reportes/compras           → ComprasReportesPage        [stub]
/reportes/financiero        → FinancieroPage             [stub]

/admin/usuarios             → AdminUsuariosPage          [implementado]
/admin/roles                → RolesPage                  [stub]
/admin/fiscal               → FiscalPage                 [stub]
/admin/series               → SeriesPage                 [stub]
/admin/sat                  → SatPage                    [stub]
/admin/audit-log            → AdminAuditLogPage          [implementado]

/cuenta/perfil              → PerfilPage                 [stub]
/cuenta/password            → PasswordPage               [stub]
/cuenta/sesiones            → SesionesPage               [stub]
```

---

## Archivos nuevos

### Componente base

| Archivo | Descripción |
|---|---|
| `frontend/src/components/common/PlaceholderPage.tsx` | Card genérica "en desarrollo" — recibe `title` y `description` |

### Páginas stub (28 archivos)

**Ventas:**
- `frontend/src/pages/ventas/ReportesVentasPage.tsx`

**Logística:**
- `frontend/src/pages/logistica/EmpacadoPage.tsx`

**Proveedores:**
- `frontend/src/pages/proveedores/CatalogoPage.tsx`

**Catálogos:**
- `frontend/src/pages/catalogos/ProductosCatalogoPage.tsx`
- `frontend/src/pages/catalogos/MarcasPage.tsx`
- `frontend/src/pages/catalogos/CategoriasPage.tsx`

**Facturación:**
- `frontend/src/pages/facturacion/EmitirCfdiPage.tsx`
- `frontend/src/pages/facturacion/ComplementosPagoPage.tsx`
- `frontend/src/pages/facturacion/NotasCreditoPage.tsx`
- `frontend/src/pages/facturacion/CancelacionesPage.tsx`
- `frontend/src/pages/facturacion/PacLogPage.tsx`

**Cobranza:**
- `frontend/src/pages/cobranza/ArPage.tsx`
- `frontend/src/pages/cobranza/ApPage.tsx`
- `frontend/src/pages/cobranza/PagosPage.tsx`
- `frontend/src/pages/cobranza/SinAplicarPage.tsx`
- `frontend/src/pages/cobranza/FlujoCajaPage.tsx`

**Reportes:**
- `frontend/src/pages/reportes/ComercialPage.tsx`
- `frontend/src/pages/reportes/MargenPage.tsx`
- `frontend/src/pages/reportes/OperacionPage.tsx`
- `frontend/src/pages/reportes/ComprasReportesPage.tsx`
- `frontend/src/pages/reportes/FinancieroPage.tsx`

**Administración (nuevas):**
- `frontend/src/pages/admin/RolesPage.tsx`
- `frontend/src/pages/admin/FiscalPage.tsx`
- `frontend/src/pages/admin/SeriesPage.tsx`
- `frontend/src/pages/admin/SatPage.tsx`

**Mi Cuenta:**
- `frontend/src/pages/cuenta/PerfilPage.tsx`
- `frontend/src/pages/cuenta/PasswordPage.tsx`
- `frontend/src/pages/cuenta/SesionesPage.tsx`

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/routes.tsx` | Árbol de rutas completo: 50+ `<Route>`, 5 `<Navigate>`, imports de 28 páginas nuevas; default exports corregidos |
| `frontend/src/components/layout/Sidebar.tsx` | Rediseñado: 14 secciones, scrollable (`overflow-y-auto`), ancho 220→240 px, RBAC guards en Admin, 30+ nuevos `NavItem` |
| `frontend/src/components/layout/AppShell.tsx` | `titlesByPath` ampliado con 45+ entradas; ancho `md:pl-220px` → `md:pl-240px` |
| `frontend/src/pages/CfdiPage.tsx` | Fix pre-existente: `rowKey={(r) => r.cfdi_id}` → `String(r.cfdi_id)` (3 instancias, error TS2322) |

---

## Sidebar — estructura definitiva

```
Inicio
── Ventas ────────  Cotizaciones · Notas de Remisión · Pedidos · Reportes
── Logística ─────  Empacado · Envíos · Rutas · Fleteras
── Compras ───────  Solicitudes · Órdenes de Compra · Recepciones · Facturas Proveedor · Gastos
── Inventario & Activos ─  Almacén · Equipos
── Clientes & Proveedores ─  Clientes · Proveedores · Catálogo Cross
── Catálogos ─────  Productos · Marcas · Categorías
── Facturación ───  CFDIs Emitidos · Emitir Nuevo · Complementos Pago · Notas de Crédito
                    Cancelaciones · Bitácora PAC
── Cobranza ──────  Cuentas x Cobrar · Cuentas x Pagar · Pagos Recibidos
                    Sin Aplicar · Flujo de Caja
── Reportes ──────  Comercial · Margen · Operación · Compras · Financiero
── Administración ─  [user.view] Usuarios · [role.manage] Roles · Config. Fiscal
   (RBAC guards)    Series y Folios · Catálogos SAT · [audit.view] Bitácora
── Mi Cuenta ─────  Mi Perfil · Contraseña · Sesiones
```

**Scrollable:** la sección de menú tiene `flex-1 overflow-y-auto` para manejar la altura completa sin ocultar ítems.

---

## Fix asociado: CfdiPage.tsx (TS2322)

`DataTable.rowKey` espera `(row: T) => string`. El campo `cfdi_id` es `number`
en los tipos de TypeScript pero el prop requería `string`. Fix:

```tsx
// Antes (error TS2322)
rowKey={(r) => r.cfdi_id}

// Después
rowKey={(r) => String(r.cfdi_id)}
```

Aplicado en 3 instancias: `FacturasTab`, `ComplementosTab` y `NotasCreditoTab`.

---

## Próximos módulos a implementar

Con la navegación en pie, el orden recomendado de implementación:

| # | Módulo | Documento fuente | Rutas ya registradas |
|---|---|---|---|
| 1 | **Catálogos** (productos, marcas, categorías) | `09_modulo_productos_pricing.docx` | `/catalogos/*` |
| 2 | **Cobranza / Finanzas** | `15_modulo_reportes.docx` | `/cobranza/*` |
| 3 | **Reportes** | `15_modulo_reportes.docx` | `/reportes/*` |
| 4 | **Roles y Permisos UI** | — | `/admin/roles` |
| 5 | **Config. Fiscal + Series** (CFDI admin) | `14_modulo_cfdi.docx` | `/admin/fiscal`, `/admin/series` |
| 6 | **Mi Cuenta** | — | `/cuenta/*` |

Para cada uno: reemplazar el `PlaceholderPage` del stub con la implementación real.
