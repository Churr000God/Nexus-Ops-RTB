# Bitácora de Cambios (sesiones)

## 2026-04-29 — Clientes y Proveedores: edición completa + scroll independiente + fix 401

### Importación de datos
- `backend/scripts/seed_clientes.py` (nuevo): importación idempotente de 125 clientes desde `data/csv/Directorio_Clientes_Proveedores.csv` (Tipo="CLIENTE"); mapea siglas→code, categoria→locality, TPP→payment_terms_days; inserta tax_data si RFC válido y contacts si hay nombre.

### Backend — nuevos endpoints
- `PUT /api/clientes/{id}/addresses/{addr_id}` — actualizar dirección de cliente
- `DELETE /api/clientes/{id}/addresses/{addr_id}` — eliminar dirección de cliente
- `PUT /api/clientes/{id}/contacts/{c_id}` — actualizar contacto de cliente
- `PUT /api/proveedores/{id}/addresses/{addr_id}` — actualizar dirección de proveedor
- `DELETE /api/proveedores/{id}/addresses/{addr_id}` — eliminar dirección de proveedor
- `PUT /api/proveedores/{id}/contacts/{c_id}` — actualizar contacto de proveedor

### Frontend — Clientes.tsx
- Pestaña **Direcciones**: CRUD de direcciones DELIVERY/OTHER con `AddressInlineForm` reutilizable
- Pestaña **Contactos**: edición inline (Pencil + Trash2) con formulario desplegable
- Modal **Editar cliente**: nombre comercial, tipo, localidad, días de crédito, límite, moneda, notas
- Panel sticky: `overflow-hidden` en contenedor flex para scroll independiente

### Frontend — ProveedoresMaestro.tsx
- Pestaña **Direcciones**: CRUD tipo PICKUP/OTHER con `SupplierAddressInlineForm`
- Pestaña **Contactos**: edición inline con Pencil + formulario desplegable
- Panel sticky: mismo fix de `overflow-hidden`

### Frontend — tipos y servicio
- `types/clientesProveedores.ts`: añadidos `CustomerAddressCreate`, `CustomerContactCreate`, `SupplierAddressCreate`, `SupplierContactCreate`
- `services/clientesProveedoresService.ts`: 8 nuevos métodos para CRUD de direcciones y contactos

### Fix — 401 en inventario/equipos
- `services/assetsService.ts`: todos los métodos reciben `token: string | null` y lo pasan a `requestJson`
- `pages/Inventarios.tsx` + `pages/EquiposPage.tsx`: leen `useAuthStore` y pasan token

### Fix — scroll independiente tabla vs pestaña
- `components/layout/AppShell.tsx`: `main` cambia de `min-h-screen` a `h-screen overflow-hidden`; div interior de `min-h-[calc(100vh-64px)]` a `h-full overflow-auto`. Con `min-h`, los hijos con `h-full` resolvían a `auto` y los scrollbars internos nunca activaban.

### Documentación
- `estructura_proyecto/14_modulo_clientes_proveedores.md`: módulo 15 — arquitectura completa, endpoints, permisos RBAC, seed CSV, frontend, patrón SCD Type 2 y diagrama de scroll.

---

## 2026-04-30 — Módulo Inventario & Activos — Almacén y Equipos

### Backend
- `app/schemas/assets_schema.py`: `InventoryCurrentRead` extendido con `theoretical_qty: float | None` y `theoretical_value: float | None`.
- `app/services/assets_service.py`: `get_inventory_current` actualizado — `LEFT JOIN inventario` para traer stock teórico; calcula `theoretical_value = theoretical_qty × avg_unit_cost`.

### Frontend
- `src/types/assets.ts`: `InventoryCurrentItem` extendido con `theoretical_qty` y `theoretical_value`.
- `src/pages/Inventarios.tsx` — reescritura completa de `AlmacenPage`:
  - Header card blanco (ícono `Warehouse` + título + descripción), igual al patrón de `EquiposPage`.
  - 5 KPI cards computadas desde las filas cargadas (`useMemo`): Con Stock · Sin Stock · Stock Negativo · Valor Real · Valor Teórico.
  - Eliminado el MainTab Inventario/Equipos — Equipos sigue siendo página independiente.
  - Eliminados KPIs antiguos, `DateRangePicker`, modales de reporte y botones de CSV/email.
  - Columnas nuevas en tabla: Stock Teórico · Valor Real · Valor Teórico.
  - `maxHeight="calc(100vh - 430px)"` para scroll independiente de la página.
  - Import corregido: `@/stores/authStore` (con **s**).
- `src/pages/EquiposPage.tsx`:
  - Header card blanco añadido (ícono `ClipboardList` + "Gestión de Equipos" en texto oscuro).
  - `token` pasado a todos los métodos de `assetsService` desde `useAuthStore`.
  - Import corregido: `@/stores/authStore`.
  - Tabla principal: `maxHeight="calc(100vh - 320px)"`.
  - Panel de detalle (componentes/historial): `maxHeight="300px"`.
- `src/components/common/DataTable.tsx`: scroll horizontal y vertical unificados en un solo contenedor — cuando se pasa `maxHeight`, ambos ejes son independientes de la página (`overflow-x-auto overflow-y-auto` en el mismo div).

### Paleta de colores
- Contenedores de sección: `bg-slate-800/60 border-slate-700` (en lugar de `bg-white/5 border-white/10`).
- Selects de filtro: `bg-slate-800 border-slate-600`.
- KPI card "Valor Teórico": tono `violet` (`bg-violet-500/10 border-violet-500/30 text-violet-300`).

### Documentación
- `estructura_proyecto/14_modulo_inventario_almacen.md`: nuevo documento — arquitectura completa del módulo, endpoints, schemas, componentes y paleta de colores.

---

## 2026-04-29 — Admin CFDI: Configuración Fiscal y Series y Folios

### Backend
- `app/schemas/cfdi_schemas.py`: añadidos `CfdiSeriesIn` (series/cfdi_type/description) y `CfdiSeriesUpdate` (description/is_active).
- `app/services/cfdi_service.py`: nuevas funciones `create_series` (unicidad por `(series, cfdi_type)`, `ValueError` si duplicado) y `update_series` (`ValueError` si no existe).
- `app/routers/cfdi.py`: `POST /api/cfdi/series` (201, 409 en duplicado) y `PATCH /api/cfdi/series/{id}` (404 si no existe); ambos protegidos con `cfdi.config.manage`.

### Frontend
- `src/types/cfdi.ts`: añadidas interfaces `CfdiSeriesIn` y `CfdiSeriesUpdate`.
- `src/services/cfdiService.ts`: firma de `getSeries` actualizada para recibir `token`; añadidas `createSeries` y `updateSeries`.
- `src/pages/admin/FiscalPage.tsx`: reemplazo de PlaceholderPage — StatusBanner + 3 tarjetas (Datos del Emisor, CSD, PAC) con `ThemedSelect` nativo para tema light; contraste corregido (`text-foreground`, `bg-card`, `border-border`).
- `src/pages/admin/SeriesPage.tsx`: reemplazo de PlaceholderPage — tabla completa con `SeriesRow` (edición inline de descripción, toggle activa/inactiva) y `CreateModal` (grid 4 tipos CFDI); `next_folio` es solo lectura.

### Documentación
- `estructura_proyecto/13_modulo_cfdi_admin.md`: nuevo documento — permisos RBAC, esquema de componentes, endpoints, schemas Pydantic/TS e invariantes de integridad.

---

## 2026-04-29 — Edición de permisos de roles + limpieza de scripts

### Backend
- `app/schemas/user_schema.py`: añadido `UpdateRolePermissionsRequest` (`permission_codes: list[str]`).
- `app/services/admin_service.py`: nuevas excepciones `RoleNotFoundError` y `RoleProtectedError`; nuevo método `update_role_permissions(role_id, codes)` — reemplaza toda la tabla `role_permissions` del rol, bloquea código `ADMIN`.
- `app/routers/admin.py`: endpoint `PUT /api/admin/roles/{role_id}/permissions` — requiere `role.manage`; HTTP 403 si el rol es ADMIN, 404 si no existe, 422 si algún permiso no existe.

### Frontend
- `src/services/adminService.ts`: añadida función `updateRolePermissions(token, roleId, codes)`.
- `src/pages/admin/RolesPage.tsx`: nuevo `EditPermissionsModal` con permisos pre-marcados, toggles de grupo por módulo (indeterminate), contador de cambios pendientes, botón deshabilitado sin cambios. `RoleCard` refactorizado: botón expand separado del contenido; ícono `✏` visible en todos los roles excepto ADMIN.

### Scripts — limpieza de obsoletos
- **Eliminados:** `rebuild-safe.sh`, `start-dev.sh`, `deploy.sh`, `update-and-deploy.sh` (todos absorbidos por `init-project.sh` y `update-safe.sh`).
- **Actualizado `health-check.sh`:** eliminada verificación del contenedor `postgres` local (BD en Supabase).
- **Actualizado `CLAUDE.md`:** sección de scripts reescrita — tabla con los 8 scripts actuales, instrucción de arranque apunta a `init-project.sh`.
- **Actualizado `estructura_proyecto/08_scripts_git.md`:** reescritura completa con inventario real, flujos de uso y referencia de `lib/common.sh`.

### Documentación
- `estructura_proyecto/12_modulo_usuarios_admin.md`: sección 7 ampliada con endpoint de edición de permisos; sección 9 actualizada con descripción del `EditPermissionsModal`; tabla de guards y tabla de archivos actualizadas.
- `estructura_proyecto/08_scripts_git.md`: reescrito desde cero para reflejar scripts reales actuales.

---

## 2026-04-29 — Módulo 16: Gestión de Usuarios y Roles (panel admin)

### Base de datos
- Sin nuevas migraciones. Usa tablas existentes: `users`, `roles`, `permissions`, `role_permissions`, `user_roles` (migración 0010).

### Backend
- `app/schemas/user_schema.py`: añadido `ChangePasswordRequest` (validación política contraseña) y `CreateRoleRequest` (code normalizado a mayúsculas, regex alfanumérico).
- `app/services/user_service.py`: nuevo método `change_password()` con guard `CannotChangeAdminPasswordError` (bloquea cambio si target.role == "admin").
- `app/services/admin_service.py`: nuevas excepciones `RoleAlreadyExistsError` / `PermissionNotFoundError` + método `create_role()` con flush+commit atómico.
- `app/routers/usuarios.py`: endpoint `PATCH /api/usuarios/{id}/password` — doble guard: `user.manage` + `current_user.role == "admin"`.
- `app/routers/admin.py`: endpoint `POST /api/admin/roles` — requiere `role.manage`, retorna `RoleWithPermissions`.

### Frontend
- `src/services/adminService.ts`: añadidas funciones `createUser`, `updateUser`, `changePassword`, `createRole` + tipos `CreateUserPayload`, `UpdateUserPayload`, `CreateRolePayload`.
- `src/pages/AdminUsuarios.tsx`: reescritura completa — `CreateUserModal` (alta con validación client-side), `EditUserModal` (nombre + toggle is_active + sección colapsable cambio de contraseña protegida por role), gestión de modales unificada en discriminated union `ActiveModal`.
- `src/pages/admin/RolesPage.tsx`: implementación completa desde stub — `RoleCard` expandible, `PermissionsSection` con búsqueda y grid agrupado por módulo (24 grupos), `CreateRoleModal` con multiselect de permisos y buscador interno.

### Documentación
- `estructura_proyecto/12_modulo_usuarios_admin.md`: nuevo documento — schema BD completo, sistema dual de roles, flujos de alta/edición/contraseña, guards de seguridad, inventario de archivos.

---

## 2026-04-29 — Módulo 15: Reportes y Analytics (migración 0024)

### Base de datos
- Migración `0024` (Supabase vía MCP): 21 vistas SQL analíticas creadas.
- Vistas por área: 4 comerciales, 3 de margen, 3 de compras, 7 financieras, 3 de operación, 1 ejecutiva.
- Adaptaciones al schema real: tablas en español (`productos`, `categorias`, `gastos_operativos`, `no_conformes`), `payment_due_date` calculado, `users.id` como UUID.

### Backend
- `app/schemas/analytics_schema.py` (nuevo): 21 modelos Pydantic v2.
- `app/services/analytics_service.py` (nuevo): helpers `_fetch_all`/`_fetch_one`, 17 funciones async.
- `app/routers/analytics.py` (nuevo): 20 GET endpoints bajo `/api/analytics`, todos con `report.view`.
- `app/main.py`: registro de `analytics_router`.

### Frontend
- `src/types/analytics.ts` (nuevo): 21 interfaces TypeScript.
- `src/services/analyticsService.ts` (nuevo): 17 funciones.
- 5 páginas reemplazadas (eran PlaceholderPage): `ComercialPage`, `MargenPage`, `OperacionPage`, `ComprasReportesPage`, `FinancieroPage` — todas con tabs, DataTable y sumarios.
- Rutas y sidebar ya existían, sin cambios.

---

## 2026-04-28 — Módulo de Compras (migraciones 0017-0018)

### Base de datos
- Migración `0017`: 10 tablas nuevas (`sat_payment_forms`, `sat_payment_methods`, `purchase_requests/items`, `purchase_orders/items`, `goods_receipts/items`, `supplier_invoices/items`) + ALTER TABLE `gastos_operativos` (6 columnas SAT opcionales).
- Migración `0018`: vista `v_purchase_chain` (trazabilidad completa PR→OC→Recepción→Factura), 5 triggers de negocio, 7 permisos RBAC nuevos, seed SAT (8 formas de pago + 2 métodos PUE/PPD).
- Triggers: `trg_validate_invoice_chain`, `trg_validate_po_has_request`, `trg_create_inv_from_receipt` (genera movimiento `ENTRY` en inventario al recibir), `trg_update_poi_received`, `trg_update_pri_qty_ordered`.

### Backend
- `app/models/compras_models.py`: 10 modelos SQLAlchemy. Clases `ComprasGoodsReceipt`/`ComprasGoodsReceiptItem` (renombradas para evitar colisión con `ops_models.GoodsReceipt` → `entradas_mercancia`).
- `app/models/ops_models.py`: `OperatingExpense` ampliado con 6 campos nullable (sat_payment_form_id, uuid_sat, etc.) para reflejar el ALTER TABLE.
- `app/schemas/compras_schema.py`: schemas Pydantic v2 completos. `OperatingExpenseOut` con `model_validate` override para mapear `spent_on → expense_date` (campo legacy).
- `app/services/compras_service.py`: CRUD + catálogos SAT + gastos operativos.
- `app/routers/compras.py`: 22 endpoints bajo `/api/compras` y `/api/gastos`.
- `app/main.py`: registro de ambos routers.

### Frontend
- Tipos: `src/types/compras.ts`.
- Service: `src/services/comprasService.ts`.
- Páginas nuevas (5): `SolicitudesPage`, `OrdenesPage`, `RecepcionesPage`, `FacturasProveedorPage`, `GastosPage`.
- `src/routes.tsx`: 5 rutas nuevas (`/gastos`, `/compras/solicitudes`, `/compras/ordenes`, `/compras/recepciones`, `/compras/facturas`).
- `src/components/layout/Sidebar.tsx`: sección "Compras" con 4 links + link activo para Gastos.

---

## 2026-04-28 — Módulo Ventas y Logística (migraciones 0015-0016)

### Base de datos
- Migración `0015`: 21 tablas operativas en inglés (`quotes`, `orders`, `shipments`, `routes`, etc.) + 17 índices.
- Migración `0016`: 5 vistas (`v_order_packing_progress`, `v_order_payment_status`, `v_orders_incomplete_tracking`, `v_shipments_overview`, `v_cfdi_cancellations`), 4 triggers de negocio, 11 permisos RBAC nuevos, rol `DRIVER`.
- Fix migración 0016: vistas usaban `c.trade_name` → corregido a `c.business_name` (columna real de `customers`).

### Backend
- `app/models/ventas_logistica_models.py`: 21 modelos SQLAlchemy. Clases `SalesQuote`/`SalesQuoteItem` (renombradas para evitar colisión con `ops_models.Quote` → `cotizaciones`).
- `app/schemas/ventas_logistica_schema.py`: ~30 schemas Pydantic v2.
- `app/services/ventas_logistica_service.py`: CRUD + lógica de aprobación, empacado, entrega.
- `app/routers/ventas_logistica.py`: 31 endpoints bajo `/api/ventas-logistica/`.
- `app/main.py`: registro del nuevo router.

### Frontend
- Tipos: `src/types/ventasLogistica.ts`.
- Service: `src/services/ventasLogisticaService.ts`.
- Páginas nuevas (7): `VentasOperacional`, `CotizacionesPage`, `PedidosPage`, `NotasRemisionPage`, `EnviosPage`, `RutasPage`, `FleterasPage`.
- `src/routes.tsx`: 7 rutas nuevas bajo `/ventas/*` y `/logistica/*`.
- `src/components/layout/Sidebar.tsx`: secciones **Ventas Operativo** y **Logística** con 7 links nuevos; refactorizado con `NavItem`/`SectionLabel`.

---

## 2026-04-24 — Tiempos de aprobación y diferencia Venta vs PO en Dashboard de Ventas

### Backend (FastAPI)

- `venta_schema.py`: nuevo schema `ApprovalTimeTrendResponse` (year_month, avg_days, upper_days,
  lower_days, count, projected_days); campos `diff_vs_po_monto` y `diff_vs_po_pct` añadidos a
  `SalesSummaryResponse`.
- `ventas_service.py`:
  - Nuevo método `approval_time_trend`: calcula `approved_on − created_on` de cotizaciones
    aprobadas agrupado por mes; incluye banda de variación ±σ (`stddev_pop`) y proyección lineal
    simple a 3 meses (funciona con ≥1 mes de datos, pendiente plana con 1 solo punto).
  - `sales_summary`: añade query de diff_vs_po via JOIN `ventas → cotizaciones` usando
    `cotizacion.subtotal` como PO; calcula diferencia en monto y porcentaje.
- `ventas.py` (router): nuevo endpoint `GET /api/ventas/approval-time-trend`.

### Frontend (React)

- `ventas.ts`: nuevo tipo `ApprovalTimeTrend`; campos `diff_vs_po_monto` y `diff_vs_po_pct` en
  `SalesSummary`.
- `ventasService.ts`: nuevo método `approvalTimeTrend`.
- `VentasDashboard.tsx`:
  - Grid de KPIs cambiado de 4 → 6 columnas; añadidas 2 tarjetas nuevas:
    - **Tiempo Promedio de Aprobación**: promedio de días del período seleccionado.
    - **Diferencia Venta vs PO**: monto y % de desviación PO vs venta real.
  - Nuevo `ChartPanel` "Tiempos de Aprobación de Cotizaciones": `LineChart` con 4 líneas
    (promedio sólida, +σ punteada, −σ punteada, proyección púrpura punteada); tooltip
    personalizado en días.

### Base de datos

- `UPDATE ventas SET subtotal_in_po = cotizaciones.subtotal WHERE quote_id = cotizaciones.id`:
  pobló 466 filas con el subtotal de la cotización relacionada (dato histórico).

### Diagnóstico de datos identificado

- `cotizaciones.approval_days`: 0 registros poblados — se calcula en tiempo real con
  `approved_on − created_on`.
- `cotizaciones.approved_on`: 125 de 646 registros tienen fecha; marzo tiene 89 aprobadas sin
  `approved_on` (71% sin cobertura). Se documenta como deuda de datos.

---

## 2026-04-24 — Despliegue Raspberry Pi, ngrok, fix sincronización CSV, update-safe.sh

### Docker / nginx

- `docker/nginx/default.conf`: corregido `proxy_pass` (sin puerto en upstream); añadidos headers
  `X-Forwarded-*`; eliminado bloque `/n8n/` no usado.
- `docker/nginx/default.prod.conf`: vaciado (SSL no aplicable en despliegue actual con ngrok).
- `docker-compose.yml`: añadido ARG `VITE_API_URL` en build de frontend; nuevo servicio `ngrok`
  con dominio estático `caress-shortlist-disarm.ngrok-free.dev`.

### Frontend

- `frontend/Dockerfile`: añadido `ARG VITE_API_URL=` + `ENV` antes de `npm run build` para
  inyectar variables Vite en tiempo de build.
- `frontend/nginx.conf`: añadido bloque `/api/` para proxy desde puerto 5173 al backend.

### Sincronización CSV (Alembic / sync_service)

- `20260419_0002_import_csv_data.py`:
  - `_bulk_upsert`: filtra columnas al subconjunto existente en BD en el momento de la migración.
  - `_bulk_upsert`: deduplicación por `conflict_cols` y PK antes de insertar.
  - `_import_quote_items`: deduplicación global por `id` y `(quote_id, line_external_id)`;
    `conflict_cols` cambiado a `["id"]`.
- `sync_service.py`: añadido `--skip-rollups` al subproceso (función `app.recompute_all_rollups`
  no existe en BD).

### Scripts

- `scripts/update-safe.sh` (NUEVO): actualización segura de 7 pasos con backup pre-update,
  restore antes de migraciones, y soporte `--dry-run`. Ver
  `docs/despliegue_raspberry_pi_2026-04-24.md`.

---

## 2026-04-21 — Dashboard de Ventas (riesgo + pagos) y hardening de API

### Backend (FastAPI)

- Ventas:
  - Se agregó endpoint `GET /api/ventas/payment-trend` para obtener tendencia de días de pago por cliente.
    - Fuente: `pedidos_clientes` (CustomerOrder).
    - Cálculo: `promedio_dias_pago = AVG(paid_on - invoiced_on)` (en días) por cliente, con `paid_on` e `invoiced_on` no nulos.
    - Filtros: `paid_on` dentro de `[start_date, end_date]` cuando se envían.
    - Salida: `{ customer_name, promedio_dias_pago, ultimo_pago, riesgo_pago }` con semáforo:
      - Bajo: `<= 30`
      - Medio: `<= 60`
      - Alto: `> 60`
  - Se agregó endpoint `GET /api/ventas/at-risk-customers` para clientes con caída de compras.
    - Fuente: `ventas`.
    - Cálculo: suma últimos 90 días vs 90 días previos; clasificación de riesgo (Bajo/Medio/Alto/Crítico).

- Auth:
  - Se mejoró el manejo de error cuando `JWT_SECRET` no está configurado (login/refresh devuelven 500 con `detail` explícito).

- CORS y manejo de errores:
  - Se amplió la detección de ambiente local para permitir orígenes por defecto cuando `ENV` sea `development/dev/local`.
  - Se agregó handler global de excepciones para retornar JSON consistente y permitir que CORS aplique headers aun en errores 500.

### Frontend (React)

- Dashboard de Ventas:
  - Ajustes visuales (layout) en paneles relacionados a demanda/pagos/riesgo para mantener proporciones en pantallas XL.
  - Consumo de endpoints de riesgo y tendencia de pagos vía `ventasService`.

### Docker / Entorno

- `docker-compose.yml`:
  - Fuerza `ENV=development` en servicio backend para asegurar CORS por defecto en dev.
  - Monta `./scripts` como `/scripts` dentro del contenedor backend (necesario para ejecutar `scripts/bootstrap_triggers.sql` durante pruebas).

- `docker-compose.prod.yml`:
  - Fuerza `ENV=production` en servicio backend.

### Operación BD (scripts)

- Makefile:
  - Nuevos targets `make setup-db` y `make restore-latest` para acelerar operaciones de entorno local.
- `scripts/setup-db.sh`:
  - Setup end-to-end: levanta servicios, aplica migraciones, bootstrap de triggers, carga CSV (replace) y genera backup.
  - Admin: se crea/actualiza solo si `ADMIN_EMAIL` y `ADMIN_PASSWORD` están definidos en `.env` (sin credenciales hardcodeadas).
  - Reset opcional: `SETUP_DB_RESET=true` para recrear la base de datos.
- `scripts/restore-db.sh`:
  - Si no se pasa archivo, auto-selecciona el backup más reciente en `data/backups/`.
- `backend/scripts/create_admin_user.py`:
  - Script de upsert del usuario por email (actualiza password/rol si ya existe).
- `docs/database_sync_runbook.md`:
  - Se documenta recuperación y flujos de backup/restore + creación de admin, evitando secretos en texto plano.

### Tests

- Se reforzó la inicialización de la BD de tests:
  - Reset completo del schema `public` (DROP/CREATE) para garantizar un esquema limpio y evitar residuos de tablas/vistas.
  - Se mantiene el schema `staging` para tablas auxiliares.
- Se agregaron/ajustaron pruebas de endpoints de ventas:
  - `payment-trend` (tendencia de pago).
  - Ajuste de aserción de porcentaje por precisión de punto flotante con `pytest.approx`.

### Migraciones (Alembic)

- Se ajustaron `down_revision` en algunas migraciones para mantener la cadena de dependencias consistente.

### Verificación

- Backend tests (en Docker): `docker compose run --rm backend pytest -q`
