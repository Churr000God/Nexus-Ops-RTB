# Módulo de Compras — Implementación completa (2026-04-28)

## Contexto

Se implementó el módulo operativo de Compras descrito en
`Reestructuracion_Bases_Datos/12_modulo_compras.docx`.
Cubre el ciclo completo:

```
Solicitud de Material → Orden de Compra → Recepción → Factura Proveedor → Pago
```

Las tablas legacy CSV (`entradas_mercancia`, `pedidos_proveedor`, `facturas_compras`,
`gastos_operativos`) no se modificaron en su estructura base. Las nuevas tablas
operativas normalizadas coexisten con ellas.

---

## Base de Datos

### Migraciones aplicadas

| Revisión | Archivo | Contenido |
|---|---|---|
| `20260428_0017` | `20260428_0017_compras_ddl.py` | 10 tablas nuevas + ALTER gastos_operativos |
| `20260428_0018` | `20260428_0018_compras_triggers_views.py` | 5 triggers + vista v_purchase_chain + seed SAT + 7 permisos RBAC |

### Tablas nuevas (10)

#### Catálogos SAT
- **`sat_payment_forms`** — Formas de pago SAT (c_FormaPago). Seed: 8 registros (01 Efectivo, 02 Cheque, 03 Transferencia, 04 Tarjeta de crédito, 28 Tarjeta de débito, 05 Monedero, 06 Dinero electrónico, 17 Compensación).
- **`sat_payment_methods`** — Métodos de pago SAT. Seed: `PUE` (Pago en una sola exhibición) y `PPD` (Pago en parcialidades o diferido). El campo `is_credit = true` en PPD.

#### Solicitudes de Material
- **`purchase_requests`** — Solicitudes de compra. Estados: `DRAFT → APPROVED → PARTIALLY_ORDERED → ORDERED / REJECTED / CANCELLED`. FK opcional a `users.id` (UUID) como `requested_by`.
- **`purchase_request_items`** — Líneas de la solicitud. `item_type` puede ser `GOODS_RESALE`, `GOODS_INTERNAL` o `SERVICE`. Campo `quantity_ordered` actualizado por trigger al crear OC.

#### Órdenes de Compra
- **`purchase_orders`** — Órdenes formales a proveedor. Estados: `DRAFT → SENT → CONFIRMED → PARTIAL_RECEIVED → RECEIVED → INVOICED → PAID / CANCELLED`. FK a `proveedores.id` (BIGINT). Soporta múltiples monedas con `exchange_rate`.
- **`purchase_order_items`** — Líneas de la orden. Campo `quantity_received` actualizado por trigger al registrar recepciones.

#### Recepciones de Mercancía
- **`goods_receipts`** — Recepciones físicas. `po_id NOT NULL` — toda recepción debe tener una OC. Campo `delivery_pct` calculado por trigger como `cantidad_recibida / cantidad_ordenada`. `physical_validation` flag para validación física.
- **`goods_receipt_items`** — Items recibidos. Vinculados a `purchase_order_items`.

#### Facturas de Proveedor
- **`supplier_invoices`** — Facturas recibidas. Estados: `RECEIVED → VALIDATED → PAID / CANCELLED`. Campo `payment_status` (`UNPAID / PARTIAL / PAID`) separado del estado documental. FK a `sat_payment_forms` y `sat_payment_methods`. Campo `uuid_sat` para CFDI.
- **`supplier_invoice_items`** — Líneas de factura. Pueden linkearse a `purchase_order_items` y/o `goods_receipt_items`.

#### ALTER TABLE gastos_operativos

Columnas añadidas (todas nullable, sin afectar datos existentes):
- `sat_payment_form_id` — FK a `sat_payment_forms`
- `sat_payment_method_id` — FK a `sat_payment_methods`
- `uuid_sat` — UUID del CFDI cuando aplica
- `expense_number` — Número de gasto interno
- `responsible_user_id` — FK a `users.id` (UUID) como responsable
- `tax_amount` — IVA separado del subtotal (opcional)

### Vista

**`v_purchase_chain`** — Trazabilidad completa de la cadena de compra. Hace JOIN de las 5 tablas principales:

```
purchase_requests
  → purchase_request_items
    → purchase_order_items
      → purchase_orders
        → goods_receipt_items
          → goods_receipts
            → supplier_invoice_items
              → supplier_invoices
```

Campos de trazabilidad: `request_number`, `po_number`, `receipt_number`, `invoice_number` en una sola fila por ítem.

### Triggers (5)

| Trigger | Función | Evento | Descripción |
|---|---|---|---|
| `trg_validate_invoice_chain` | `fn_validate_invoice_chain` | `BEFORE INSERT` en `supplier_invoices` | Valida que la factura esté vinculada a una OC o recepción válida |
| `trg_validate_po_has_request` | `fn_validate_po_has_request` | `BEFORE INSERT` en `purchase_orders` | Valida que la OC referencie solicitudes aprobadas cuando se especifican |
| `trg_create_inv_from_receipt` | `fn_create_inv_movement_from_receipt` | `AFTER INSERT` en `goods_receipt_items` | Genera movimiento `ENTRY` en `movimientos_inventario` al recibir mercancía |
| `trg_update_poi_received` | `fn_update_poi_received` | `AFTER INSERT/UPDATE` en `goods_receipt_items` | Actualiza `purchase_order_items.quantity_received` como suma acumulada |
| `trg_update_pri_qty_ordered` | `fn_update_pri_quantity_ordered` | `AFTER INSERT/UPDATE` en `purchase_order_items` | Actualiza `purchase_request_items.quantity_ordered` cuando se crea OC |

### RBAC

**Nuevos permisos (7):**
`purchase_request.create`, `purchase_request.approve`,
`purchase_order.create`, `purchase_order.manage`,
`goods_receipt.create`, `supplier_invoice.create`, `supplier_invoice.pay`

**Asignaciones por rol:**
- `ADMIN` — todos los 7 permisos
- `PURCHASING` — todos los 7 permisos
- `READ_ONLY` — sin nuevos permisos (solo lectura implícita)
- `ACCOUNTING` — `supplier_invoice.create` + `supplier_invoice.pay`

---

## Backend (FastAPI)

### Archivos nuevos

| Archivo | Descripción |
|---|---|
| `app/models/compras_models.py` | 10 modelos SQLAlchemy. Clases `ComprasGoodsReceipt` y `ComprasGoodsReceiptItem` (renombradas para evitar colisión con `ops_models.GoodsReceipt` → `entradas_mercancia`) |
| `app/schemas/compras_schema.py` | Schemas Pydantic v2 para todos los modelos (`*In`, `*Out`, `*ListItem`, `*StatusUpdate`) + schemas de catálogos SAT |
| `app/services/compras_service.py` | CRUD completo + servicios de catálogos SAT + gastos operativos |
| `app/routers/compras.py` | 22 endpoints bajo `/api/compras` y `/api/gastos` |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `app/models/__init__.py` | Exporta los 10 nuevos modelos de compras |
| `app/models/ops_models.py` | `OperatingExpense` — añadidos 6 campos nullable (sat_payment_form_id, sat_payment_method_id, uuid_sat, expense_number, responsible_user_id, tax_amount) |
| `app/main.py` | Registra `compras_router` (prefijo `/api/compras`) y `gastos_router` (prefijo `/api/gastos`) |

### Endpoints (22)

```
# Catálogos SAT
GET    /api/compras/sat/payment-forms
GET    /api/compras/sat/payment-methods

# Solicitudes de Material
GET    /api/compras/purchase-requests
POST   /api/compras/purchase-requests
GET    /api/compras/purchase-requests/{id}
PATCH  /api/compras/purchase-requests/{id}/status

# Órdenes de Compra
GET    /api/compras/purchase-orders
POST   /api/compras/purchase-orders
GET    /api/compras/purchase-orders/{id}
PATCH  /api/compras/purchase-orders/{id}/status

# Recepciones de Mercancía
GET    /api/compras/goods-receipts
POST   /api/compras/goods-receipts
GET    /api/compras/goods-receipts/{id}

# Facturas de Proveedor
GET    /api/compras/supplier-invoices
POST   /api/compras/supplier-invoices
GET    /api/compras/supplier-invoices/{id}
PATCH  /api/compras/supplier-invoices/{id}/status
POST   /api/compras/supplier-invoices/{id}/pay

# Vista de trazabilidad
GET    /api/compras/purchase-chain

# Gastos Operativos (legacy extendido)
GET    /api/gastos
POST   /api/gastos
GET    /api/gastos/{id}
PATCH  /api/gastos/{id}
```

### Fix crítico: colisión de mappers SQLAlchemy

`ops_models.py` ya tenía `class GoodsReceipt` mapeando a la tabla legacy `entradas_mercancia`.
El nuevo módulo también necesitaba una clase `GoodsReceipt` para la tabla normalizada `goods_receipts`.
Esto causaba:

```
InvalidRequestError: Multiple classes found for path "GoodsReceipt"
```

Solución: renombrar en `compras_models.py`:
- `GoodsReceipt` → `ComprasGoodsReceipt` (tabla `goods_receipts`)
- `GoodsReceiptItem` → `ComprasGoodsReceiptItem` (tabla `goods_receipt_items`)

En `compras_service.py` se importan con alias:
```python
from app.models.compras_models import ComprasGoodsReceipt as GoodsReceipt
from app.models.compras_models import ComprasGoodsReceiptItem as GoodsReceiptItem
```

### Fix: OperatingExpenseOut — ResponseValidationError

Al añadir columnas a `gastos_operativos` en la migración, el modelo ORM
`OperatingExpense` en `ops_models.py` no las declaraba como `Mapped` attributes.
Esto causaba `ResponseValidationError` al serializar registros existentes.

Fix 1: Añadir los 6 campos como `Mapped[Optional[...]] = mapped_column(nullable=True)` en `ops_models.py`.

Fix 2: En `OperatingExpenseOut`, todos los nuevos campos son opcionales con `default=None`.
Se agregó un `model_validate` override para mapear el campo legacy `spent_on → expense_date`:

```python
@classmethod
def model_validate(cls, obj, **kwargs):
    instance = super().model_validate(obj, **kwargs)
    if instance.expense_date is None and hasattr(obj, "spent_on"):
        instance.expense_date = obj.spent_on
    return instance
```

---

## Frontend (React + TypeScript)

### Archivos nuevos

| Archivo | Descripción |
|---|---|
| `src/types/compras.ts` | Interfaces TypeScript para todos los modelos del módulo |
| `src/services/comprasService.ts` | Funciones de API client para todos los endpoints |
| `src/pages/compras/SolicitudesPage.tsx` | Lista de solicitudes filtrable por estatus |
| `src/pages/compras/OrdenesPage.tsx` | Lista de OC filtrable por estatus con totales |
| `src/pages/compras/RecepcionesPage.tsx` | Lista de recepciones con % de entrega |
| `src/pages/compras/FacturasProveedorPage.tsx` | Lista de facturas con estatus documental y de pago |
| `src/pages/GastosPage.tsx` | Gastos operativos con KPIs de total y % deducible |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/routes.tsx` | 5 imports nuevos + 5 `<Route>` bajo `/compras/*` y `/gastos` |
| `src/components/layout/Sidebar.tsx` | Sección "Compras" con 4 links + link activo para `/gastos` |
| `src/components/layout/AppShell.tsx` | Títulos de página para las 5 rutas nuevas |

### Patrón correcto de useApi + useCallback

Todas las páginas usan el patrón correcto con `useCallback` para evitar loops infinitos:

```tsx
const fetcher = useCallback(
  (signal: AbortSignal) => getXxx({ status: filterStatus || undefined }, signal),
  [filterStatus],
)
const { data, status } = useApi(fetcher)
```

Y el `emptyLabel` usa `status` (no `loading`/`error`):
```tsx
emptyLabel={
  status === "loading" ? "Cargando…"
  : status === "error" ? "Error al cargar"
  : "Sin registros"
}
```

### Rutas registradas

| Ruta | Componente |
|---|---|
| `/gastos` | `GastosPage` |
| `/compras/solicitudes` | `SolicitudesPage` |
| `/compras/ordenes` | `OrdenesPage` |
| `/compras/recepciones` | `RecepcionesPage` |
| `/compras/facturas` | `FacturasProveedorPage` |

---

## Notas de despliegue

```bash
# Migraciones ya aplicadas en Supabase (0017 y 0018):
docker compose exec backend alembic upgrade head

# Rebuild seguro (sin tocar postgres-n8n):
docker compose up -d --build backend frontend
```

### Seed SAT cargado automáticamente (migración 0018)

8 formas de pago + 2 métodos de pago disponibles en `/api/compras/sat/payment-forms` y `/api/compras/sat/payment-methods`.
