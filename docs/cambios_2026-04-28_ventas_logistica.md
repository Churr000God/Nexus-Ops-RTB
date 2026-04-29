# Módulo Ventas y Logística — Implementación completa (2026-04-28)

## Contexto

Se implementó el módulo operativo de Ventas y Logística descrito en
`Reestructuracion_Bases_Datos/11_modulo_ventas_logistica.docx`.
Cubre el ciclo completo:

```
NR → Cotización → Pedido → Empacado → Envío / Ruta → CFDI → Cobro
```

Las tablas legacy CSV (`cotizaciones`, `pedidos_clientes`, etc.) no se modificaron.
Las nuevas tablas operativas son en **inglés** para distinguirlas visualmente.

---

## Base de Datos

### Migraciones aplicadas

| Revisión | Archivo | Contenido |
|---|---|---|
| `20260428_0015` | `20260428_0015_ventas_logistica_ddl.py` | 21 tablas + 17 índices |
| `20260428_0016` | `20260428_0016_ventas_logistica_views_triggers.py` | 5 vistas + 4 triggers + 11 permisos RBAC + rol DRIVER |

### Tablas (21)

#### Catálogo de Fleteras
- **`carriers`** — Catálogo de empresas transportistas. Campos clave: `code` (único), `is_internal`, `tracking_url_template`.

#### Notas de Remisión (NR)
- **`delivery_notes`** — Notas informales de entrega previas a cotización formal. Estados: `DRAFT → ISSUED → DELIVERED → TRANSFORMED / PARTIALLY_INVOICED / INVOICED / CANCELLED`.
- **`delivery_note_items`** — Líneas de producto en cada NR.
- **`quote_delivery_notes`** — Asociación M:N entre NRs y cotizaciones formales.

#### Cotizaciones Formales
- **`quotes`** — Cotizaciones formales aprobables. Estados: `DRAFT → SUBMITTED → APPROVED / REJECTED / EXPIRED / CANCELLED`. Campos de aprobación: `approved_by` (FK `users.id` UUID), `approved_at`, `rejected_by`, `rejected_at`, `rejection_reason`.
- **`quote_items`** — Líneas de producto por cotización. Enlace opcional a `delivery_note_items`.
- **`quote_status_history`** — Log de cada transición de estado de la cotización.

#### Pedidos Formales
- **`orders`** — Pedidos creados automáticamente al aprobar una cotización (vía trigger). Campos: `packing_status` (`NOT_STARTED / IN_PROGRESS / READY / PACKED_FOR_ROUTE / DISPATCHED`), `packer_id` (FK `users.id`).
- **`order_items`** — Líneas de pedido. Columnas críticas: `quantity_ordered`, `quantity_packed`, `quantity_shipped`.
- **`order_milestones`** — Hitos auditables del pedido (CREATED, CONFIRMED, SHIPPED, DELIVERED, INVOICED, PAID).

#### CFDI y Comprobantes Fiscales
- **`cfdi`** — Comprobantes CFDI 4.0. Auto-referenciante: `replaces_cfdi_id` y `replaced_by_cfdi_id` para cancelaciones con sustituto.
- **`cfdi_items`** — Líneas del comprobante con claves SAT (`unit_key`, `product_key`).
- **`cfdi_credit_notes`** — Notas de crédito vinculadas a CFDIs.
- **`cfdi_payments`** — Complementos de pago CFDI (pago en parcialidades).

#### Cobros
- **`payments`** — Registro de cobros recibidos.
- **`payment_applications`** — Aplicación de un cobro a uno o varios pedidos/CFDIs.

#### Logística
- **`shipments`** — Envíos físicos. Estados: `PREPARING → READY → IN_TRANSIT → DELIVERED / RETURNED / INCIDENT / CANCELLED`.
- **`shipment_items`** — Items de `order_items` incluidos en el envío.
- **`shipment_tracking_events`** — Eventos de rastreo (manual o automático).
- **`routes`** — Rutas de reparto del día. Estados: `PLANNING → ASSIGNED → IN_PROGRESS → COMPLETED / CANCELLED`.
- **`route_stops`** — Paradas de la ruta. Tipo: `DELIVERY` (entrega a cliente) o `PICKUP` (recolección de proveedor).

### Vistas (5)

| Vista | Descripción |
|---|---|
| `v_order_packing_progress` | % empacado por pedido (`quantity_packed / quantity_ordered`) |
| `v_order_payment_status` | Saldo pendiente por cobrar por pedido (total − cobros aplicados) |
| `v_orders_incomplete_tracking` | Pedidos con material pendiente de embarque (`quantity_ordered > quantity_shipped`) |
| `v_shipments_overview` | Estado actual de envíos activos con nombre de cliente y fletera |
| `v_cfdi_cancellations` | CFDIs cancelados en los últimos 90 días con su CFDI sustituto |

### Triggers (4)

| Trigger | Función | Evento | Descripción |
|---|---|---|---|
| `trg_create_order_from_quote` | `fn_create_order_from_quote` | `AFTER UPDATE` en `quotes` | Crea el pedido automáticamente cuando `status` cambia a `APPROVED` |
| `trg_sync_shipped_qty` | `fn_sync_shipped_qty` | `AFTER INSERT/UPDATE/DELETE` en `shipment_items` | Recalcula `order_items.quantity_shipped` como suma de lo embarcado |
| `trg_shipment_delivered` | `fn_on_shipment_delivered` | `AFTER UPDATE` en `shipments` | Al marcar `DELIVERED`: actualiza `orders.delivery_date`, inserta milestone `DELIVERED` |
| `trg_packing_inv_movement` | `fn_packing_inv_movement` | `AFTER UPDATE` en `order_items` | Cuando `quantity_packed` aumenta: inserta movimiento `ISSUE` en `movimientos_inventario` |

**Lógica del trigger `fn_create_order_from_quote`:**
```sql
-- 1. Inserta el pedido con número temporal
INSERT INTO orders (...) VALUES ('ORD-TEMP', ...) RETURNING order_id INTO v_order_id;
-- 2. Actualiza el número definitivo con el ID generado
UPDATE orders SET order_number = 'ORD-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(v_order_id::TEXT, 5, '0')
WHERE order_id = v_order_id;
-- 3. Copia los items de quote_items a order_items
INSERT INTO order_items (order_id, quote_item_id, ...) SELECT v_order_id, ...  FROM quote_items;
```

### RBAC

**Nuevos permisos (11):**
`delivery_note.create`, `delivery_note.manage`, `delivery_note.invoice`,
`shipment.create`, `shipment.manage`, `shipment.track.update`,
`route.create`, `route.manage`, `route.execute`,
`order.create`, `order.manage`

**Nuevo rol:** `DRIVER` — asignado con permisos `route.execute` + `shipment.track.update`.

---

## Backend (FastAPI)

### Archivos nuevos

| Archivo | Descripción |
|---|---|
| `app/models/ventas_logistica_models.py` | 21 modelos SQLAlchemy. Clases `SalesQuote` y `SalesQuoteItem` (renombradas para evitar colisión con `ops_models.Quote` → `cotizaciones`) |
| `app/schemas/ventas_logistica_schema.py` | ~30 schemas Pydantic v2 (`Create` / `Update` / `Response` por entidad + schemas de vistas) |
| `app/services/ventas_logistica_service.py` | CRUD completo + lógica de negocio (aprobación de cotizaciones, empacado, entrega de envíos) |
| `app/routers/ventas_logistica.py` | 31 endpoints bajo `/api/ventas-logistica/` |

### Endpoints (31)

```
GET/POST   /carriers
GET/PATCH  /carriers/{id}

GET/POST   /delivery-notes
GET/PATCH  /delivery-notes/{id}
POST       /delivery-notes/{id}/link-quote

GET/POST   /quotes
GET/PATCH  /quotes/{id}
POST       /quotes/{id}/approve
POST       /quotes/{id}/reject
POST       /quotes/{id}/link-delivery-notes

GET        /orders
GET/PATCH  /orders/{id}
PATCH      /orders/{id}/items/{item_id}/pack

GET/POST   /cfdi
GET/PATCH  /cfdi/{id}
POST       /cfdi/{id}/cancel

GET/POST   /payments
POST       /payments/{id}/apply

GET/POST   /shipments
GET/PATCH  /shipments/{id}
POST       /shipments/{id}/deliver
POST       /shipments/{id}/tracking-events

GET/POST   /routes
GET/PATCH  /routes/{id}
POST       /routes/{id}/stops

GET        /views/incomplete-orders
GET        /views/shipments-overview
GET        /views/cfdi-cancellations
GET        /views/order-packing-progress
GET        /views/order-payment-status
```

### Fix crítico: colisión de mappers SQLAlchemy

`ops_models.py` ya tenía clases `Quote` (→ `cotizaciones`) y `QuoteItem` (→ `cotizacion_items`).
El nuevo módulo usaba los mismos nombres Python causando:

```
InvalidRequestError: Multiple classes found for path "Quote"
```

Solución: renombrar en `ventas_logistica_models.py`:
- `Quote` → `SalesQuote` (tabla `quotes`)
- `QuoteItem` → `SalesQuoteItem` (tabla `quote_items`)

Las referencias en service y router se actualizaron en consecuencia.

### `main.py` modificado

```python
from app.routers.ventas_logistica import router as ventas_logistica_router
app.include_router(ventas_logistica_router)
```

---

## Frontend (React + TypeScript)

### Archivos nuevos

| Archivo | Descripción |
|---|---|
| `src/types/ventasLogistica.ts` | Interfaces TypeScript para todos los modelos y vistas |
| `src/services/ventasLogisticaService.ts` | Funciones de API client (`requestJson`) para todos los endpoints |
| `src/pages/VentasOperacional.tsx` | Dashboard KPI: pedidos incompletos + envíos activos |
| `src/pages/CotizacionesPage.tsx` | Lista filtrable con acciones aprobar/rechazar (gateada por `quote.approve`) |
| `src/pages/PedidosPage.tsx` | Lista con filtro de estado y estado de empacado |
| `src/pages/NotasRemisionPage.tsx` | Lista de NRs con filtro de estado |
| `src/pages/EnviosPage.tsx` | Lista de envíos con filtro de estado |
| `src/pages/RutasPage.tsx` | Lista de rutas con filtro de estado y conteo de paradas |
| `src/pages/FleterasPage.tsx` | Catálogo de fleteras con badge interno/externo |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/routes.tsx` | 7 imports nuevos + 7 `<Route>` bajo `/ventas/*` y `/logistica/*` |
| `src/components/layout/Sidebar.tsx` | Dos nuevas secciones: **Ventas Operativo** (4 links) y **Logística** (3 links). Refactorizado con componentes `NavItem` y `SectionLabel` para eliminar repetición |

### API de DataTable (corrección)

La implementación inicial usaba props inexistentes. La API real del componente es:

```tsx
// CORRECTO
<DataTable
  columns={columns}         // cell: (row: T) => ReactNode  (no "render")
  rows={data}               // prop "rows" (no "data")
  rowKey={(r) => r.id}      // requerido
  emptyLabel="Sin datos"    // (no "emptyMessage")
/>
```

El fetcher de `useApi` recibe `AbortSignal`:
```tsx
useApi(useCallback((_signal: AbortSignal) => fetchFn(params), [params]))
```

### Rutas registradas

| Ruta | Componente |
|---|---|
| `/ventas/operacional` | `VentasOperacional` |
| `/ventas/cotizaciones` | `CotizacionesPage` |
| `/ventas/pedidos` | `PedidosPage` |
| `/ventas/notas-remision` | `NotasRemisionPage` |
| `/logistica/envios` | `EnviosPage` |
| `/logistica/rutas` | `RutasPage` |
| `/logistica/fleteras` | `FleterasPage` |

---

## Notas de despliegue

```bash
# Migraciones ya aplicadas en Supabase:
docker compose exec backend alembic upgrade head

# Rebuild seguro (sin tocar postgres):
docker compose up -d --build backend frontend
```
