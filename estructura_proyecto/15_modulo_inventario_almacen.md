# Módulo Inventario & Activos — Documentación Técnica Completa

> Última actualización: 2026-05-05

---

## 1. Visión General

El módulo agrupa tres secciones bajo la entrada **"Inventario & Activos"** del sidebar:

| Ruta | Página / Componente | Propósito |
|---|---|---|
| `/inventario` | `AlmacenPage` (`Inventarios.tsx`) | Stock real y teórico por SKU, separado en vendible / interno |
| `/equipos` | `EquiposPage` | Gestión de activos físicos fijos (laptops, máquinas, vehículos…) |
| `/activos/conteos` | `ConteosPage` | Sesiones de conteo físico y reconciliación de activos |

---

## 2. Base de Datos — Tablas

### 2.1 `inventory_movements`

Fuente de verdad de todo el stock de productos. Cada fila es un movimiento positivo (entrada) o negativo (salida).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | |
| `product_id` | UUID FK → productos | Producto afectado |
| `movement_type` | VARCHAR | `PURCHASE` / `SALE` / `ADJUSTMENT` / `ISSUE` / `RETURN` / `TRANSFER` |
| `quantity` | NUMERIC | Positivo = entrada, negativo = salida |
| `unit_cost` | NUMERIC | Costo unitario en el momento del movimiento |
| `reference_id` | UUID | ID del documento origen (pedido, orden de compra, etc.) |
| `reference_type` | VARCHAR | Tipo del documento origen |
| `warehouse` | VARCHAR | Almacén / ubicación |
| `notes` | TEXT | Notas libres |
| `created_by` | UUID FK → users | Usuario que registró el movimiento |
| `created_at` | TIMESTAMPTZ | Fecha/hora del movimiento |

### 2.2 `inventario`

Stock teórico proveniente de sync externo. Solo tiene datos cuando el sync externo está configurado.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | |
| `product_id` | UUID FK → productos UNIQUE | Un registro por producto |
| `theoretical_qty` | NUMERIC | Cantidad teórica sincronizada |
| `last_synced_at` | TIMESTAMPTZ | Última vez que se actualizó la fila |

> **Nota:** En el estado actual la tabla tiene 0 filas. Las columnas de stock/valor teórico muestran "—" en la UI.

### 2.3 `inventory_snapshots`

Snapshots mensuales de cierre. Se populan por la función `fn_close_monthly_snapshot()`.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | |
| `product_id` | UUID FK → productos | |
| `snapshot_date` | DATE | Fecha del cierre mensual |
| `quantity_on_hand` | NUMERIC | Stock real al momento del cierre |
| `avg_unit_cost` | NUMERIC | Costo promedio ponderado |
| `total_value` | NUMERIC | Valor total = qty × cost |
| `created_at` | TIMESTAMPTZ | |

### 2.4 `assets`

Activos físicos fijos de la empresa.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | |
| `asset_code` | VARCHAR UNIQUE | Código identificador único (ej. `LAP-001`) |
| `asset_type` | VARCHAR | `COMPUTER` / `LAPTOP` / `PRINTER` / `MACHINE` / `VEHICLE` / `TOOL` / `OTHER` |
| `name` | VARCHAR | Nombre descriptivo |
| `base_product_id` | UUID FK → productos (nullable) | Producto del catálogo al que corresponde este activo |
| `serial_number` | VARCHAR (nullable) | Número de serie del fabricante |
| `manufacturer` | VARCHAR (nullable) | Fabricante |
| `model` | VARCHAR (nullable) | Modelo |
| `location` | VARCHAR (nullable) | Ubicación física actual |
| `assigned_user_id` | UUID FK → users (nullable) | Usuario al que está asignado actualmente |
| `parent_asset_id` | UUID FK → assets.id (nullable) | Activo padre (relación jerárquica auto-referencial) |
| `status` | VARCHAR | `ACTIVE` / `IN_REPAIR` / `IDLE` / `RETIRED` / `DISMANTLED` |
| `purchase_date` | DATE (nullable) | Fecha de compra |
| `purchase_cost` | NUMERIC(14,4) (nullable) | Costo de adquisición — requerido para calcular depreciación |
| `warranty_until` | DATE (nullable) | Vencimiento de garantía |
| `notes` | TEXT (nullable) | Notas libres |
| `retired_at` | TIMESTAMPTZ (nullable) | Fecha/hora de retiro formal |
| `retirement_reason` | TEXT (nullable) | Motivo del retiro |
| `salvage_value` | NUMERIC(14,4) (nullable) | Valor de rescate al momento del retiro |
| `retired_by` | UUID FK → users SET NULL (nullable) | Usuario que ejecutó el retiro |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### 2.5 `asset_components`

Componentes actualmente instalados en un activo. Al remover un componente la fila se elimina y pasa a `asset_component_history`.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | |
| `asset_id` | UUID FK → assets CASCADE | Activo que contiene el componente |
| `product_id` | UUID FK → productos (nullable) | Producto del catálogo (RAM, disco, etc.) |
| `quantity` | NUMERIC | Cantidad instalada |
| `serial_number` | VARCHAR (nullable) | Serie del componente |
| `installed_at` | TIMESTAMPTZ server_default now() | Momento de instalación |
| `installed_by` | UUID FK → users (nullable) | Técnico que instaló |
| `notes` | TEXT (nullable) | |

### 2.6 `asset_component_history`

Log de auditoría inmutable de todas las operaciones de instalar / remover / reemplazar componentes.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | |
| `asset_id` | UUID FK → assets | |
| `operation` | VARCHAR | `INSTALL` / `REMOVE` / `REPLACE` |
| `product_id` | UUID FK → productos (nullable) | |
| `quantity` | NUMERIC | |
| `serial_number` | VARCHAR (nullable) | |
| `performed_by` | UUID FK → users | Técnico que realizó la operación |
| `reason` | TEXT (nullable) | Motivo (útil en REMOVE/REPLACE) |
| `notes` | TEXT (nullable) | |
| `inventory_movement_id` | UUID FK → inventory_movements (nullable) | Movimiento de inventario generado |
| `nc_id` | UUID FK → non_conformities (nullable) | No conformidad asociada (si aplica) |
| `occurred_at` | TIMESTAMPTZ | Momento de la operación |

### 2.7 `asset_assignment_history`

Historial de a quién y dónde ha estado asignado cada activo.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | |
| `asset_id` | UUID FK → assets CASCADE | |
| `user_id` | UUID FK → users (nullable) | `NULL` = activo desasignado |
| `location` | VARCHAR (nullable) | Ubicación en el momento de la asignación |
| `assigned_at` | TIMESTAMPTZ server_default now() | |
| `assigned_by` | UUID FK → users (nullable) | Quien realizó la asignación |
| `notes` | TEXT (nullable) | |

### 2.8 `asset_work_orders`

Órdenes de trabajo de mantenimiento asociadas a un activo.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | |
| `asset_id` | UUID FK → assets CASCADE | |
| `title` | VARCHAR | Título de la orden |
| `description` | TEXT (nullable) | Descripción detallada |
| `work_type` | VARCHAR | `PREVENTIVE` / `CORRECTIVE` / `INSPECTION` / `UPGRADE` |
| `priority` | VARCHAR | `LOW` / `MEDIUM` / `HIGH` / `URGENT` |
| `status` | VARCHAR default `OPEN` | `OPEN` / `IN_PROGRESS` / `DONE` / `CANCELLED` |
| `assigned_to` | UUID FK → users (nullable) | Técnico asignado |
| `scheduled_date` | DATE (nullable) | Fecha programada |
| `started_at` | TIMESTAMPTZ (nullable) | Inicio real del trabajo |
| `completed_at` | TIMESTAMPTZ (nullable) | Finalización del trabajo |
| `cost` | NUMERIC(14,4) (nullable) | Costo del mantenimiento |
| `notes` | TEXT (nullable) | |
| `created_by` | UUID FK → users (nullable) | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### 2.9 `asset_depreciation_config`

Configuración de depreciación por activo. UNIQUE en `asset_id` — un activo solo puede tener una configuración activa.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | |
| `asset_id` | UUID FK → assets CASCADE UNIQUE | |
| `method` | VARCHAR CHECK IN ('STRAIGHT_LINE') default 'STRAIGHT_LINE' | Método de depreciación |
| `useful_life_years` | INT > 0 | Vida útil en años |
| `residual_value` | NUMERIC(14,4) >= 0 default 0 | Valor residual al final de la vida útil |
| `start_date` | DATE | Fecha de inicio de la depreciación |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### 2.10 `physical_counts`

Sesiones de conteo físico. Puede ser de activos (`count_type='ASSET'`) o de productos (`count_type='PRODUCT'`).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | |
| `count_date` | DATE | Fecha del conteo |
| `count_type` | VARCHAR(10) CHECK IN ('ASSET','PRODUCT') default `'ASSET'` | Tipo de conteo |
| `location_filter` | VARCHAR (nullable) | Filtro de ubicación (solo aplica para `count_type='ASSET'`) |
| `status` | VARCHAR default `DRAFT` | `DRAFT` / `CONFIRMED` / `CANCELLED` |
| `notes` | TEXT (nullable) | |
| `created_by` | UUID FK → users (nullable) | |
| `created_at` | TIMESTAMPTZ | |
| `confirmed_at` | TIMESTAMPTZ (nullable) | Momento en que se cerró el conteo |
| `confirmed_by` | UUID FK → users (nullable) | |

### 2.11 `physical_count_lines`

Una fila por activo por sesión de conteo `count_type='ASSET'`. Representa el estado de cada activo al momento de la sesión.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | |
| `count_id` | UUID FK → physical_counts CASCADE | |
| `asset_id` | UUID FK → assets | |
| `asset_code` | VARCHAR | Snapshot del código al momento de crear el conteo |
| `asset_name` | VARCHAR | Snapshot del nombre al momento de crear el conteo |
| `expected_location` | VARCHAR (nullable) | Snapshot de la ubicación esperada al momento de crear el conteo |
| `scanned_location` | VARCHAR (nullable) | Ubicación real escaneada durante el conteo |
| `found` | BOOLEAN (nullable) | `NULL` = pendiente, `TRUE` = encontrado, `FALSE` = no encontrado |
| `notes` | TEXT (nullable) | |
| `updated_by` | UUID FK → users SET NULL (nullable) | Último usuario que actualizó la línea |
| `updated_at` | TIMESTAMPTZ (nullable) | Timestamp de la última actualización |

### 2.12 `product_count_lines`

Una fila por producto por sesión de conteo `count_type='PRODUCT'`. Permite contar cantidades de productos en almacén.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | |
| `count_id` | UUID FK → physical_counts CASCADE | |
| `product_id` | UUID FK → productos SET NULL (nullable) | Producto del catálogo |
| `sku` | VARCHAR(120) (nullable) | Snapshot del SKU |
| `product_name` | VARCHAR(500) | Snapshot del nombre del producto |
| `is_saleable` | BOOLEAN | Snapshot del tipo (vendible / interno) |
| `category` | VARCHAR(200) (nullable) | Snapshot de la categoría |
| `theoretical_qty` | NUMERIC(14,4) (nullable) | Stock teórico al momento de crear el conteo (tabla `inventario`) |
| `real_qty` | NUMERIC(14,4) default 0 | Stock real al momento de crear el conteo (`inventory_movements`) |
| `counted_qty` | NUMERIC(14,4) (nullable) | Cantidad contada físicamente; `NULL` = no contado aún |
| `notes` | TEXT (nullable) | |
| `updated_by` | UUID FK → users SET NULL (nullable) | Último operador que actualizó la línea |
| `updated_at` | TIMESTAMPTZ (nullable) | Timestamp de la última actualización |

---

## 3. Vistas SQL

### 3.1 `v_inventory_current`

Calcula el stock real de cada producto agregando todos sus movimientos en `inventory_movements`.

```sql
SELECT
    p.id               AS product_id,
    p.sku,
    p.name,
    p.is_saleable,
    c.name             AS category,
    COALESCE(SUM(im.quantity), 0)                              AS quantity_on_hand,
    CASE WHEN SUM(im.quantity) > 0
         THEN SUM(im.quantity * im.unit_cost) / SUM(im.quantity)
         ELSE 0 END                                            AS avg_unit_cost,
    COALESCE(SUM(im.quantity), 0)
        * CASE WHEN SUM(im.quantity) > 0
               THEN SUM(im.quantity * im.unit_cost) / SUM(im.quantity)
               ELSE 0 END                                      AS total_value,
    p.min_stock,
    CASE
        WHEN COALESCE(SUM(im.quantity), 0) = 0 THEN 'OUT'
        WHEN COALESCE(SUM(im.quantity), 0) < p.min_stock THEN 'BELOW_MIN'
        ELSE 'OK'
    END                                                        AS stock_status
FROM productos p
LEFT JOIN inventory_movements im ON im.product_id = p.id
LEFT JOIN categorias c ON c.id = p.category_id
GROUP BY p.id, p.sku, p.name, p.is_saleable, c.name, p.min_stock
```

### 3.2 `v_asset_current_components`

Muestra los componentes actualmente instalados en cada activo, enriquecidos con datos del producto.

```sql
SELECT
    ac.id          AS asset_component_id,
    ac.asset_id,
    ac.product_id,
    p.sku          AS component_sku,
    p.name         AS component_name,
    ac.quantity,
    ac.serial_number,
    ac.installed_at,
    u.email        AS installed_by_email,
    ac.notes
FROM asset_components ac
LEFT JOIN productos p ON p.id = ac.product_id
LEFT JOIN users u     ON u.id = ac.installed_by
```

### 3.3 `v_asset_repair_history`

Historial cronológico completo (DESC) de todas las operaciones de componentes de un activo.

```sql
SELECT
    ach.id                   AS history_id,
    ach.asset_id,
    ach.occurred_at,
    ach.operation,
    p.sku                    AS component_sku,
    p.name                   AS component_name,
    ach.quantity,
    ach.serial_number,
    u.email                  AS performed_by,
    ach.reason,
    ach.notes,
    ach.inventory_movement_id,
    ach.nc_id
FROM asset_component_history ach
LEFT JOIN productos p ON p.id = ach.product_id
LEFT JOIN users u     ON u.id = ach.performed_by
ORDER BY ach.occurred_at DESC
```

---

## 4. Migraciones Alembic

El módulo abarca nueve revisiones. La cadena de activos tiene **dos heads** conviviendo en el proyecto (rama TOTP en `20260429_0027` y la cadena de assets). **Nunca** ejecutar `alembic upgrade head` — siempre especificar el ID de revisión concreto.

| Revisión | Archivo | Contenido |
|---|---|---|
| `20260428_0019` | `inventario_assets_deuda_tecnica` | Renombra `movimientos_inventario` → `inventory_movements`; invierte `is_internal` → `is_saleable` (con backfill de valores); ajusta FKs |
| `20260428_0020` | `inventario_assets_ddl` | Crea las tablas `assets`, `asset_components`, `asset_component_history`, `inventory_snapshots` |
| `20260428_0021` | `inventario_assets_vistas_triggers` | Crea 6 vistas SQL, trigger `fn_on_component_install`, función `fn_remove_asset_component`, función `fn_close_monthly_snapshot`, job pg_cron para cierre automático |
| `20260430_0028` | `asset_assignment_history` | Crea tabla `asset_assignment_history` |
| `20260430_0029` | `asset_retirement_fields` | `ALTER TABLE assets` — agrega columnas `retired_at`, `retirement_reason`, `salvage_value`, `retired_by` |
| `20260430_0030` | `physical_counts` | Crea tablas `physical_counts` y `physical_count_lines` |
| `20260430_0031` | `asset_parent_hierarchy` | `ALTER TABLE assets` — agrega columna `parent_asset_id` + índice |
| `20260430_0032` | `asset_work_orders` | Crea tabla `asset_work_orders` |
| `20260430_0033` | `asset_depreciation_config` | Crea tabla `asset_depreciation_config` |
| `20260505_0034` | `product_count_lines` | ADD COLUMN `count_type` a `physical_counts`; ADD COLUMNS `updated_by`/`updated_at` a `physical_count_lines`; CREATE TABLE `product_count_lines` |

---

## 5. Endpoints Backend

Todos los endpoints requieren autenticación JWT: `Authorization: Bearer <token>`.

### 5.1 Router `/api/assets` — `assets.py`

| Método | Ruta | Status | Descripción |
|---|---|---|---|
| `GET` | `/api/assets` | 200 | Lista activos. Filtros: `status`, `asset_type`, `location`, `search`, `limit` (max 500), `offset` |
| `POST` | `/api/assets` | 201 | Crea activo |
| `GET` | `/api/assets/{id}` | 200 | Detalle de un activo; 404 si no existe |
| `PATCH` | `/api/assets/{id}` | 200 | Actualiza campos del activo (solo campos enviados — `exclude_none`) |
| `GET` | `/api/assets/{id}/children` | 200 | Sub-activos donde `parent_asset_id = id` |
| `POST` | `/api/assets/{id}/retire` | 200 | Retiro formal — establece `status=RETIRED`, `retired_at`, `retirement_reason`, `salvage_value`, `retired_by`; 400 si ya está RETIRED/DISMANTLED |
| `GET` | `/api/assets/{id}/components` | 200 | Componentes instalados actualmente (vía `v_asset_current_components`) |
| `POST` | `/api/assets/{id}/components` | 201 | Instala componente (trigger `fn_on_component_install` actúa automáticamente) |
| `POST` | `/api/assets/{id}/components/{comp_id}/remove` | 200 | Remueve componente (llama `fn_remove_asset_component` en PL/pgSQL) |
| `GET` | `/api/assets/{id}/history` | 200 | Historial de operaciones de componentes (vía `v_asset_repair_history`). Params: `limit`, `offset` |
| `GET` | `/api/assets/{id}/assignments` | 200 | Historial de asignaciones con emails JOINed. Params: `limit`, `offset` |
| `POST` | `/api/assets/{id}/assign` | 201 | Asigna/reasigna activo a usuario/ubicación; 404 si activo no existe |
| `POST` | `/api/assets/{id}/work-orders` | 201 | Crea orden de mantenimiento |
| `GET` | `/api/assets/{id}/work-orders` | 200 | Lista órdenes de mantenimiento (prioridad: OPEN→IN_PROGRESS→resto, luego desc created_at). Filtro opcional: `status` |
| `PATCH` | `/api/assets/{id}/work-orders/{wo_id}` | 200 | Actualiza orden (status, fechas, costo, notas); 404 si no existe |
| `GET` | `/api/assets/{id}/depreciation` | 200 | Obtiene calendario de depreciación calculado en Python |
| `POST` | `/api/assets/{id}/depreciation` | 200 | Crea o actualiza configuración de depreciación (upsert) |

**Conteos físicos (rutas estáticas — deben ir antes de `/{asset_id}` en el router):**

| Método | Ruta | Status | Descripción |
|---|---|---|---|
| `POST` | `/api/assets/counts` | 201 | Crea sesión de conteo. `count_type='ASSET'` hace snapshot de activos; `count_type='PRODUCT'` hace snapshot de productos con stock teórico y real |
| `GET` | `/api/assets/counts` | 200 | Lista sesiones de conteo. Filtro: `status` |
| `GET` | `/api/assets/counts/{count_id}/lines` | 200 | Líneas de activos de un conteo ASSET; incluye `updated_by_email` |
| `PATCH` | `/api/assets/counts/{count_id}/lines/{line_id}` | 200 | Actualiza `found`, `scanned_location`, `notes`, registra `updated_by`/`updated_at`; 400 si no es DRAFT |
| `GET` | `/api/assets/counts/{count_id}/product-lines` | 200 | Líneas de productos de un conteo PRODUCT. Params: `search`, `is_saleable` |
| `PATCH` | `/api/assets/counts/{count_id}/product-lines/{line_id}` | 200 | Actualiza `counted_qty`, `notes`, registra quién contó; 400 si no es DRAFT |
| `POST` | `/api/assets/counts/{count_id}/confirm` | 200 | Cierra el conteo (DRAFT → CONFIRMED); 400 si ya está cerrado |

### 5.2 Router `/api/inventario` — `inventory_router` en `assets.py`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/inventario/kpis-v2` | KPIs agregados del inventario completo (dos queries SQL + merge en Python) |
| `GET` | `/api/inventario/vendible` | Items con `is_saleable=true` de `v_inventory_current`. Params: `stock_status`, `search`, `category`, `sort_by`, `sort_order`, `limit` (max 5000), `offset` |
| `GET` | `/api/inventario/interno` | Items con `is_saleable=false`. Mismos params que `/vendible` |
| `GET` | `/api/inventario/movimientos` | Bitácora de movimientos de inventario. Params: `product_id`, `movement_type`, `search`, `date_from`, `date_to`, `limit` (default 100), `offset` |
| `POST` | `/api/inventario/ajustes` | Crea ajuste manual de inventario. Body: `AdjustmentCreate`. Status 201 |

**Columnas sort válidas para `/vendible` e `/interno`:** `sku`, `name`, `category`, `quantity_on_hand`, `avg_unit_cost`, `total_value`, `stock_status`.

### 5.3 Router `/api/inventario/snapshots` — `snapshot_router` en `assets.py`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/inventario/snapshots` | Lista snapshots mensuales. Params: `product_id` (UUID, opcional), `limit` (default 12, max 60) |
| `POST` | `/api/inventario/snapshots/close-month` | Ejecuta `fn_close_monthly_snapshot()` y retorna `{ "productos_snapshooteados": N }` |

---

## 6. Schemas Pydantic (`assets_schema.py`)

### 6.1 Asset

```python
class AssetCreate(BaseModel):
    asset_code: str
    asset_type: str
    name: str
    base_product_id: UUID | None = None
    serial_number: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    location: str | None = None
    assigned_user_id: UUID | None = None
    parent_asset_id: UUID | None = None
    status: str = "ACTIVE"
    purchase_date: date | None = None
    purchase_cost: float | None = None
    warranty_until: date | None = None
    notes: str | None = None

class AssetUpdate(BaseModel):   # todos los campos opcionales (exclude_none en servicio)
    asset_type / name / base_product_id / serial_number / manufacturer / model
    location / assigned_user_id / parent_asset_id / status
    purchase_date / purchase_cost / warranty_until / notes

class AssetRead(BaseModel):     # from_attributes=True
    id / asset_code / asset_type / name / base_product_id / serial_number
    manufacturer / model / location / assigned_user_id / parent_asset_id / status
    purchase_date / purchase_cost / warranty_until / notes
    retired_at / retirement_reason / salvage_value / retired_by   # campos de retiro
    created_at / updated_at
```

### 6.2 Componentes

```python
class AssetComponentCreate(BaseModel):
    product_id: UUID | None = None
    quantity: float = 1.0
    serial_number: str | None = None
    notes: str | None = None

class AssetComponentRead(BaseModel):            # from_attributes=True — ORM directo
    id / asset_id / product_id / quantity / serial_number
    installed_at / installed_by / notes

class AssetComponentDetailRead(BaseModel):      # enriquecido desde v_asset_current_components
    asset_component_id / product_id
    component_sku / component_name
    quantity / serial_number / installed_at
    installed_by_email / notes

class AssetComponentHistoryRead(BaseModel):     # desde v_asset_repair_history
    history_id / occurred_at / operation
    component_sku / component_name
    quantity / serial_number / performed_by
    reason / notes / inventory_movement_id / nc_id
```

### 6.3 Retiro y Remoción

```python
class RetireAssetPayload(BaseModel):
    retirement_reason: str | None = None
    salvage_value: float | None = None

class RemoveComponentRequest(BaseModel):
    is_reusable: bool
    reason: str | None = None
    notes: str | None = None
```

### 6.4 Asignaciones

```python
class AssignAssetPayload(BaseModel):
    user_id: UUID | None = None      # None = desasignar
    location: str | None = None
    notes: str | None = None

class AssetAssignmentRead(BaseModel):
    id / asset_id / user_id
    user_email / user_name           # JOINed desde users
    location / assigned_at
    assigned_by_email                # JOINed desde users (assigned_by)
    notes
```

### 6.5 Órdenes de Mantenimiento

```python
class WorkOrderCreate(BaseModel):
    title: str
    description: str | None = None
    work_type: str = "CORRECTIVE"    # PREVENTIVE / CORRECTIVE / INSPECTION / UPGRADE
    priority: str = "MEDIUM"         # LOW / MEDIUM / HIGH / URGENT
    scheduled_date: date | None = None
    cost: float | None = None
    notes: str | None = None

class WorkOrderUpdate(BaseModel):    # todos opcionales
    title / description / work_type / priority / status
    scheduled_date / started_at / completed_at / cost / notes

class WorkOrderRead(BaseModel):      # from_attributes=True
    id / asset_id / title / description / work_type / priority / status
    assigned_to / assigned_to_email  # email JOINed desde users
    scheduled_date / started_at / completed_at / cost / notes
    created_by / created_at / updated_at
```

### 6.6 Conteos Físicos

```python
class PhysicalCountCreate(BaseModel):
    count_date: date
    count_type: str = "ASSET"        # "ASSET" | "PRODUCT"
    location_filter: str | None = None  # solo para ASSET
    notes: str | None = None

class PhysicalCountRead(BaseModel):  # from_attributes=True
    id / count_date / count_type / location_filter / status / notes
    created_by / created_at
    confirmed_at / confirmed_by
    total_lines: int = 0
    # ASSET stats
    found_count: int = 0             # found is True
    not_found_count: int = 0         # found is False
    pending_count: int = 0           # found is None
    # PRODUCT stats
    counted_lines: int = 0           # counted_qty is not None
    discrepancy_lines: int = 0       # counted_qty != real_qty
    uncounted_lines: int = 0         # counted_qty is None

class PhysicalCountLineRead(BaseModel):  # from_attributes=True
    id / count_id / asset_id
    asset_code / asset_name          # snapshots al momento de crear el conteo
    expected_location / scanned_location
    found / notes
    updated_by: UUID | None          # nuevo — quién actualizó la línea
    updated_at: datetime | None      # nuevo — cuándo
    updated_by_email: str | None     # JOINed desde users

class PhysicalCountLineUpdate(BaseModel):
    found: bool | None = None
    scanned_location: str | None = None
    notes: str | None = None

class ProductCountLineRead(BaseModel):
    id / count_id / product_id
    sku / product_name / is_saleable / category
    theoretical_qty: float | None    # stock teórico al momento de crear
    real_qty: float                  # stock real al momento de crear
    counted_qty: float | None        # None = no contado aún
    notes / updated_by / updated_at
    updated_by_email: str | None     # JOINed desde users

class ProductCountLineUpdate(BaseModel):
    counted_qty: float | None = None
    notes: str | None = None
```

### 6.7 Movimientos e Inventario (nuevos schemas)

```python
class InventoryMovementRead(BaseModel):  # from_attributes=True
    id / movement_number
    product_id / product_sku / product_name  # enriquecido vía JOIN
    movement_type / qty_in / qty_out / qty_nonconformity
    unit_cost / moved_on / origin / destination / observations
    created_by_email: str | None     # JOINed desde users
    created_at

class AdjustmentCreate(BaseModel):
    product_id: UUID
    direction: str                   # "in" | "out" — validado con @field_validator
    quantity: float                  # > 0 — validado con @field_validator
    unit_cost: float | None = None
    observations: str                # requerido
    moved_on: date | None = None     # default: hoy en el backend
```

### 6.7 Depreciación

```python
class DepreciationConfigCreate(BaseModel):
    method: str = "STRAIGHT_LINE"
    useful_life_years: int           # > 0
    residual_value: float = 0.0
    start_date: date

class DepreciationConfigRead(BaseModel):  # from_attributes=True
    id / asset_id / method
    useful_life_years / residual_value / start_date
    created_at / updated_at

class DepreciationPeriodRead(BaseModel):
    year: int                        # 1-indexed
    period_start: date
    period_end: date
    annual_depreciation: float       # redondeado a 4 decimales
    accumulated_depreciation: float  # redondeado a 4 decimales
    book_value: float                # max(residual, cost - accumulated)
    is_current: bool                 # period_start <= today <= period_end

class DepreciationScheduleRead(BaseModel):
    config: DepreciationConfigRead | None
    asset_cost: float | None         # None si el activo no tiene purchase_cost
    current_book_value: float | None
    accumulated_depreciation: float | None
    percent_depreciated: float | None
    periods: list[DepreciationPeriodRead]
```

### 6.8 Inventario

```python
class InventoryCurrentRead(BaseModel):
    product_id: UUID
    sku: str | None
    name: str
    is_saleable: bool
    category: str | None
    quantity_on_hand: float          # stock real (inventory_movements)
    theoretical_qty: float | None    # stock teórico (tabla inventario)
    avg_unit_cost: float
    total_value: float
    theoretical_value: float | None  # theoretical_qty × avg_unit_cost
    min_stock: float | None
    stock_status: str                # "OK" | "BELOW_MIN" | "OUT"

class InventoryKpiSummaryRead(BaseModel):
    total_productos / valor_total_real
    valor_total_vendible / valor_total_interno
    productos_out_of_stock / productos_below_min
    productos_out_of_stock_vendible / productos_below_min_vendible
    productos_out_of_stock_interno / productos_below_min_interno
    total_assets / assets_en_reparacion
    total_vendible / total_interno
    con_stock_vendible / sin_stock_vendible / stock_negativo_vendible
    con_stock_interno / sin_stock_interno / stock_negativo_interno

class InventorySnapshotRead(BaseModel):  # from_attributes=True
    id / product_id / snapshot_date
    quantity_on_hand / avg_unit_cost / total_value / created_at
```

---

## 7. Capa de Servicio (`AssetService` en `assets_service.py`)

### 7.1 Función auxiliar de módulo `_add_years(d, years)`

Reemplaza `dateutil.relativedelta` (no instalada). Suma años a una fecha con manejo correcto del 29 de febrero:

```python
def _add_years(d: date, years: int) -> date:
    try:
        return d.replace(year=d.year + years)
    except ValueError:            # 29-Feb en año no bisiesto
        return d.replace(year=d.year + years, day=28)
```

### 7.2 CRUD de Activos

- **`list_assets`** — construye `SELECT Asset` con filtros opcionales: `status` (exacto), `asset_type` (exacto), `location` (ilike), `search` (OR ilike en `asset_code` y `name`). Ordenado por `asset_code`.
- **`get_asset`** — `db.get(Asset, id)`, devuelve `None` si no existe.
- **`create_asset`** — `model_dump()` directo al constructor ORM; commit; refresh.
- **`update_asset`** — `model_dump(exclude_none=True)` con `setattr` loop; commit; refresh.

### 7.3 Jerarquía

- **`get_children(asset_id)`** — `SELECT Asset WHERE parent_asset_id = asset_id ORDER BY asset_code`.

### 7.4 Retiro

- **`retire_asset`** — valida `status NOT IN ('RETIRED', 'DISMANTLED')`, lanza `ValueError` → HTTP 400 si ya retirado. Establece atómicamente: `status='RETIRED'`, `retired_at=now()`, `retirement_reason`, `salvage_value`, `retired_by=user_id`.

### 7.5 Componentes

- **`get_components`** — SQL directo a `v_asset_current_components` filtrado por `asset_id`, ordenado `installed_at DESC`.
- **`install_component`** — INSERT ORM en `asset_components`; el trigger `fn_on_component_install` hace el resto. Tras commit, recarga vía `get_components` para devolver el `AssetComponentDetailRead` enriquecido.
- **`remove_component`** — llama `fn_remove_asset_component(comp_id, reusable, user_id, reason, notes)` como `SELECT` SQL; todos los parámetros con `CAST(:param AS type)` (obligatorio para psycopg3).

### 7.6 Historial

- **`get_history`** — SQL directo a `v_asset_repair_history` filtrado por `asset_id`, con `LIMIT`/`OFFSET`.

### 7.7 Asignaciones

- **`assign_asset`** — INSERT `AssetAssignmentHistory` + update `asset.assigned_user_id` + `asset.location` (solo si se proveyó location). Devuelve `AssetAssignmentRead` construido desde SQL con JOIN a `users` para emails.
- **`get_assignments`** — SQL con doble JOIN a `users` (usuario asignado y quien asignó), ordenado `assigned_at DESC`.

### 7.8 Órdenes de Mantenimiento

- **`_wo_to_read(wo_id)`** — helper privado; SQL con LEFT JOIN a `users` para `assigned_to_email`; retorna `WorkOrderRead`.
- **`create_work_order`** — INSERT ORM; commit; llama `_wo_to_read`.
- **`list_work_orders`** — SQL con ORDER: `CASE status WHEN 'OPEN' THEN 1 WHEN 'IN_PROGRESS' THEN 2 ELSE 3 END, created_at DESC`. Filtro de status opcional (inyección segura con formato de string).
- **`update_work_order`** — valida que `wo.asset_id == asset_id`; `setattr` loop con `exclude_none`; `wo.updated_at = datetime.now(timezone.utc)`; llama `_wo_to_read`.

### 7.9 Conteos Físicos

- **`create_physical_count`** — INSERT `PhysicalCount` → `flush()`. Bifurca según `count_type`:
  - `ASSET`: SELECT activos `status NOT IN ('RETIRED', 'DISMANTLED')` con filtro ilike de location → INSERT `PhysicalCountLine` por cada activo (snapshot de `asset_code`, `asset_name`, `location`).
  - `PRODUCT`: tres bloques de INSERT en `product_count_lines`:
    1. **Productos del catálogo** — SQL une `inventory_movements` (real_qty = SUM qty_in−qty_out) y `inventario` (theoretical_qty) → una línea por producto con `is_saleable` del catálogo.
    2. **Equipos activos** — SELECT `assets` WHERE `status NOT IN ('RETIRED','DISMANTLED')` → línea con `is_saleable=False`, `sku=asset_code`, `real_qty=1`, `theoretical_qty=1`. Permite contar los equipos físicos en la misma sesión de conteo PRODUCT.
    3. **Componentes instalados** — SELECT `asset_components` JOIN `assets` (excluye retirados/desmantelados) agrupando por `product_id` → línea con `is_saleable=False` y `real_qty=SUM(quantity)`.
  - El filtro "Solo Internos" (`is_saleable=false`) del frontend muestra los bloques 2 y 3; "Solo Vendibles" muestra el bloque 1.
  - Commit → reload con `selectinload(lines)` + `selectinload(product_lines)`.
- **`_count_to_read(count)`** — helper privado; bifurca por `count_type`:
  - ASSET: calcula `total/found/not_found/pending` desde `lines`.
  - PRODUCT: calcula `total/counted/discrepancy/uncounted` desde `product_lines`.
- **`list_physical_counts`** — SELECT con `selectinload(lines)` + `selectinload(product_lines)`, ordenado `count_date DESC, created_at DESC`.
- **`get_physical_count_lines`** — SQL raw con LEFT JOIN a `users` para `updated_by_email`, ordenado por `asset_code`.
- **`get_product_count_lines(count_id, search, is_saleable)`** — SQL raw con filtros opcionales de búsqueda (ilike en sku/nombre) y tipo, LEFT JOIN a `users` para `updated_by_email`.
- **`update_count_line(count_id, line_id, data, user_id)`** — valida count DRAFT; actualiza campos no-None + `updated_by=user_id` + `updated_at=now()`; commit; refresh.
- **`update_product_count_line(count_id, line_id, data, user_id)`** — similar para `ProductCountLine`; 400 si el conteo no es DRAFT.
- **`confirm_physical_count`** — valida DRAFT; establece `status='CONFIRMED'`, `confirmed_at`, `confirmed_by`; reload con eager-load de ambas relaciones.

### 7.10 Movimientos e Inventario (nuevos métodos)

- **`list_movements(product_id?, movement_type?, search?, date_from?, date_to?, limit, offset)`** — SQL con LEFT JOIN a `productos` (para `product_sku`/`product_name`) y LEFT JOIN a `users` (para `created_by_email`). Filtros acumulativos con `WHERE` dinámico. Ordenado `moved_on DESC, created_at DESC`.
- **`create_adjustment(data, user_id)`** — INSERT `InventoryMovement` con `movement_type="Ajuste"`, `moved_on=data.moved_on or today`, `qty_in=quantity` si direction='in' (qty_out=None) o viceversa. No genera movimiento de inventory_snapshots — el snapshot lo hace pg_cron mensualmente.

### 7.10 Snapshots

- **`list_snapshots`** — SELECT `InventorySnapshot` ordenado `snapshot_date DESC`, filtro opcional `product_id`.
- **`close_monthly_snapshot`** — `SELECT fn_close_monthly_snapshot()`; retorna el escalar (número de productos snapshooteados).

### 7.11 Inventario Actual

- **`get_inventory_current`** — SQL dinámico sobre `v_inventory_current LEFT JOIN inventario`. Columnas de sort validadas contra allowlist. Filtros acumulativos: `is_saleable`, `stock_status`, `search` (ilike en `sku` y `name`), `category` (ilike). Calcula `theoretical_value` con CASE en SQL.
- **`get_inventory_kpi_summary`** — dos queries separados:
  1. Agregación completa de `v_inventory_current` con `COUNT(*) FILTER` para cada segmento (vendible/interno, por stock_status).
  2. `COUNT(*)` y `COUNT(*) FILTER (WHERE status = 'IN_REPAIR')` de `assets`.
  Resultados mezclados en Python para construir `InventoryKpiSummaryRead`.

### 7.12 Depreciación

- **`get_depreciation(asset_id)`** — carga config y activo; si no hay config o no hay `purchase_cost`, retorna `DepreciationScheduleRead` vacío (sin error). Cálculo:
  - `annual = (cost - residual) / life_years`
  - Para cada año (1 → life): `p_start = _add_years(start, year-1)`, `p_end = _add_years(start, year) - timedelta(1)`, `accumulated = annual * year`, `book_value = max(residual, cost - accumulated)`, `is_current = p_start <= today <= p_end`.
  - Período actual: primer período donde `is_current=True`, o el último si ninguno aplica (activo completamente depreciado o aún no iniciado).
  - `percent_depreciated = accumulated / (cost - residual) * 100`.
- **`upsert_depreciation_config`** — SELECT config existente; UPDATE si existe, INSERT si no; commit; llama `get_depreciation` para la respuesta.

---

## 8. Frontend — Tipos TypeScript (`frontend/src/types/assets.ts`)

```typescript
// Inventario
type InventoryCurrentItem = { product_id, sku, name, is_saleable, category,
  quantity_on_hand, theoretical_qty, avg_unit_cost, total_value,
  theoretical_value, min_stock, stock_status: "OK"|"BELOW_MIN"|"OUT"|null }

type InventoryKpiV2 = { total_productos, valor_total_real,
  valor_total_vendible, valor_total_interno,
  productos_out_of_stock, productos_below_min,
  productos_out_of_stock_vendible, productos_below_min_vendible,
  productos_out_of_stock_interno, productos_below_min_interno,
  total_assets, assets_en_reparacion,
  total_vendible, total_interno,
  con_stock_vendible, sin_stock_vendible, stock_negativo_vendible,
  con_stock_interno, sin_stock_interno, stock_negativo_interno }

// Activos
type AssetRead = { id, asset_code, asset_type, name, base_product_id,
  serial_number, manufacturer, model, location, assigned_user_id,
  parent_asset_id, status, purchase_date, purchase_cost, warranty_until,
  notes, retired_at, retirement_reason, salvage_value, retired_by,
  created_at, updated_at }

type AssetCreate = { asset_code, asset_type, name, ...todos opcionales }
type AssetUpdate = { ...todos opcionales }
type RetireAssetPayload = { retirement_reason?, salvage_value? }

// Componentes
type InstallComponentPayload = { product_id?, quantity?, serial_number?, notes? }
type RemoveComponentPayload  = { is_reusable: boolean, reason?, notes? }
type AssetComponentDetail    = { asset_component_id, product_id, component_sku,
  component_name, quantity, serial_number, installed_at, installed_by_email, notes }
type AssetComponentHistoryItem = { history_id, occurred_at,
  operation: "INSTALL"|"REMOVE"|"REPLACE", component_sku, component_name,
  quantity, serial_number, performed_by, reason, notes,
  inventory_movement_id, nc_id }

// Asignaciones
type AssignAssetPayload = { user_id?, location?, notes? }
type AssetAssignment    = { id, asset_id, user_id, user_email, user_name,
  location, assigned_at, assigned_by_email, notes }

// Órdenes de mantenimiento
type WorkOrderRead   = { id, asset_id, title, description,
  work_type: "PREVENTIVE"|"CORRECTIVE"|"INSPECTION"|"UPGRADE",
  priority: "LOW"|"MEDIUM"|"HIGH"|"URGENT",
  status: "OPEN"|"IN_PROGRESS"|"DONE"|"CANCELLED",
  assigned_to, assigned_to_email, scheduled_date, started_at, completed_at,
  cost, notes, created_by, created_at, updated_at }
type WorkOrderCreate = { title, description?, work_type?, priority?,
  scheduled_date?, cost?, notes? }
type WorkOrderUpdate = { title?, ...todos opcionales, started_at?, completed_at? }

// Conteos físicos
type PhysicalCountRead    = { id, count_date, count_type: "ASSET"|"PRODUCT",
  location_filter, status: "DRAFT"|"CONFIRMED"|"CANCELLED", notes,
  created_by, created_at, confirmed_at, confirmed_by, total_lines,
  // ASSET stats:
  found_count, not_found_count, pending_count,
  // PRODUCT stats:
  counted_lines, discrepancy_lines, uncounted_lines }
type PhysicalCountCreate  = { count_date, count_type?: "ASSET"|"PRODUCT", location_filter?, notes? }
type PhysicalCountLineRead = { id, count_id, asset_id, asset_code, asset_name,
  expected_location, scanned_location, found: boolean|null, notes,
  updated_by: string|null, updated_at: string|null, updated_by_email: string|null }
type PhysicalCountLineUpdate = { found?, scanned_location?, notes? }
type ProductCountLineRead = { id, count_id, product_id: string|null, sku: string|null,
  product_name, is_saleable, category: string|null,
  theoretical_qty: number|null, real_qty: number, counted_qty: number|null,
  notes, updated_by, updated_at, updated_by_email: string|null }
type ProductCountLineUpdate = { counted_qty?: number|null, notes?: string|null }

// Movimientos
type InventoryMovementRead = { id, movement_number: string|null,
  product_id: string|null, product_sku: string|null, product_name: string|null,
  movement_type: string|null, qty_in: number|null, qty_out: number|null,
  qty_nonconformity: number|null, unit_cost: number|null,
  moved_on: string|null, origin: string|null, destination: string|null,
  observations: string|null, created_by_email: string|null, created_at: string }
type AdjustmentCreate = { product_id: string, direction: "in"|"out",
  quantity: number, unit_cost?: number|null, observations: string, moved_on?: string|null }

// Depreciación
type DepreciationConfigRead   = { id, asset_id, method: "STRAIGHT_LINE",
  useful_life_years, residual_value, start_date, created_at, updated_at }
type DepreciationConfigCreate = { method?, useful_life_years, residual_value?, start_date }
type DepreciationPeriodRead   = { year, period_start, period_end,
  annual_depreciation, accumulated_depreciation, book_value, is_current }
type DepreciationScheduleRead = { config, asset_cost, current_book_value,
  accumulated_depreciation, percent_depreciated, periods: DepreciationPeriodRead[] }
```

---

## 9. Frontend — Servicio `assetsService` (`frontend/src/services/assetsService.ts`)

Todas las funciones reciben `token: string | null` como primer argumento. El helper interno `withQuery()` construye la query string omitiendo valores `null`, `undefined` y `""`.

| Función | Método / Ruta | Descripción |
|---|---|---|
| `getKpisV2(token, signal?)` | GET `/api/inventario/kpis-v2` | KPIs de inventario |
| `getVendible(token, params, signal?)` | GET `/api/inventario/vendible` | Items vendibles |
| `getInterno(token, params, signal?)` | GET `/api/inventario/interno` | Items internos |
| `listAssets(token, params, signal?)` | GET `/api/assets` | Lista activos |
| `getChildren(token, assetId, signal?)` | GET `/api/assets/{id}/children` | Sub-activos |
| `getAsset(token, id, signal?)` | GET `/api/assets/{id}` | Detalle de activo |
| `createAsset(token, data)` | POST `/api/assets` | Crea activo |
| `updateAsset(token, id, data)` | PATCH `/api/assets/{id}` | Actualiza activo |
| `installComponent(token, assetId, data)` | POST `/api/assets/{id}/components` | Instala componente |
| `removeComponent(token, assetId, compId, data)` | POST `/api/assets/{id}/components/{cid}/remove` | Remueve componente |
| `getComponents(token, assetId, signal?)` | GET `/api/assets/{id}/components` | Componentes instalados |
| `getHistory(token, assetId, params, signal?)` | GET `/api/assets/{id}/history` | Historial de componentes |
| `getAssignments(token, assetId, params, signal?)` | GET `/api/assets/{id}/assignments` | Historial de asignaciones |
| `assignAsset(token, assetId, data)` | POST `/api/assets/{id}/assign` | Asigna/reasigna activo |
| `retireAsset(token, assetId, data)` | POST `/api/assets/{id}/retire` | Retira activo formalmente |
| `createCount(token, data)` | POST `/api/assets/counts` | Crea sesión de conteo (ASSET o PRODUCT) |
| `listCounts(token, params, signal?)` | GET `/api/assets/counts` | Lista sesiones de conteo |
| `getCountLines(token, countId, signal?)` | GET `/api/assets/counts/{id}/lines` | Líneas de activos de un conteo |
| `updateCountLine(token, countId, lineId, data)` | PATCH `/api/assets/counts/{id}/lines/{lid}` | Actualiza línea de activo |
| `getProductCountLines(token, countId, params, signal?)` | GET `/api/assets/counts/{id}/product-lines` | Líneas de productos de un conteo |
| `updateProductCountLine(token, countId, lineId, data)` | PATCH `/api/assets/counts/{id}/product-lines/{lid}` | Actualiza cantidad contada |
| `confirmCount(token, countId)` | POST `/api/assets/counts/{id}/confirm` | Cierra el conteo |
| `listMovements(token, params, signal?)` | GET `/api/inventario/movimientos` | Bitácora de movimientos de inventario |
| `createAdjustment(token, data)` | POST `/api/inventario/ajustes` | Crea ajuste manual de inventario |
| `createWorkOrder(token, assetId, data)` | POST `/api/assets/{id}/work-orders` | Crea orden de mantenimiento |
| `listWorkOrders(token, assetId, params, signal?)` | GET `/api/assets/{id}/work-orders` | Lista órdenes de mantenimiento |
| `updateWorkOrder(token, assetId, woId, data)` | PATCH `/api/assets/{id}/work-orders/{wid}` | Actualiza orden |
| `getDepreciation(token, assetId, signal?)` | GET `/api/assets/{id}/depreciation` | Obtiene calendario de depreciación |
| `upsertDepreciation(token, assetId, data)` | POST `/api/assets/{id}/depreciation` | Crea/actualiza configuración de depreciación |

---

## 10. Frontend — Páginas

### 10.1 `AlmacenPage` (`frontend/src/pages/Inventarios.tsx`)

```
AlmacenPage
├── Header card — "Control de Almacén · Stock en tiempo real..."
│     └── Badges de contexto adaptativos al tab activo
├── Tab strip [Inventario Vendible | Inventario Interno | Ajustes | Bitácora]
│
│  ── Tabs Vendible / Interno ──
├── KPI cards (6 tarjetas, desde /api/inventario/kpis-v2)
│     ├── Valor Total · Con Stock · Sin Stock · Stock Negativo · Bajo Mínimo · Sin Stock
├── Toolbar: búsqueda + filtro categoría + filtro estado + ordenamiento
└── DataTable de stock
      Columnas: SKU · Nombre · Categoría · Stock Real · Stock Teórico
                · Diferencia (±diff con flecha color) · Costo Prom.
                · Valor Real · Valor Teórico · Estado (badge)
│
│  ── Tab Ajustes ──
├── Toolbar: búsqueda + rango de fechas + botón "Nuevo Ajuste" → AjusteModal
└── DataTable filtrado a movement_type='Ajuste'
      Columnas: Fecha · Tipo (badge) · Producto · Entrada · Salida
                · Costo Unit. · Observaciones · Registrado por · Folio
│
│  ── Tab Bitácora ──
├── Toolbar: búsqueda + filtro tipo de movimiento + rango de fechas
└── DataTable de todos los movimientos (mismas columnas que Ajustes)
```

### 10.2 `EquiposPage` (`frontend/src/pages/EquiposPage.tsx`)

```
EquiposPage
├── Header card — "Gestión de Equipos · Activos físicos registrados..."
├── Filtros: select Tipo de activo · select Estado · input Búsqueda
│            + botón "Nuevo Activo" → AssetFormModal
├── DataTable principal
│     Columnas: Código · Tipo · Nombre · Ubicación · Estado · Costo Compra · Fecha Compra
│     onClick fila → abre AssetDetailPanel
└── AssetDetailPanel (panel deslizante lateral al seleccionar fila)
```

### 10.3 `ConteosPage` (`frontend/src/pages/ConteosPage.tsx`)

```
ConteosPage — vista lista
├── Header card — KPI cards (total / DRAFT / CONFIRMED)
├── Botón "Nuevo Conteo" → CreateCountModal (selector Activos / Productos)
└── DataTable de sesiones (fecha, tipo badge, estado, progreso adaptativo)
      onClick fila → vista detalle (in-page, no modal)

ConteosPage — vista detalle ASSET (count_type='ASSET')
├── Breadcrumb header + estadísticas (total/encontrado/no encontrado/pendiente)
├── Botón "Confirmar Conteo" (solo en DRAFT)
└── DataTable de líneas de activos
      Columnas: Código · Nombre · Ubic. Esperada · Ubic. Escaneada · Estado · Contado por
      Botones inline: ✓ / ✗ — toggle found; registra updated_by_email + timestamp

ConteosPage — vista detalle PRODUCT (count_type='PRODUCT')
├── Breadcrumb header + KPIs (total/contados/con discrepancia/sin contar)
├── Barra de búsqueda (debounce 300ms) + filtro vendible/interno/todos
├── Auto-refresh cada 10s cuando status='DRAFT' (colaboración multi-usuario)
├── Advertencia amber si hay uncounted_lines al confirmar → permite pasar con N/A
└── DataTable de líneas de productos
      Columnas: SKU (mono) · Nombre · Tipo (Vendible/Interno) · Categoría
                · Stock Teórico (violet) · Stock Real (blue)
                · Cant. Contada (input inline en DRAFT / valor o N/A en CONFIRMED)
                · Diferencia (badge ±diff en CONFIRMED)
                · Contado por (email + timestamp)
```

---

## 11. Frontend — Componentes

### 11.1 `AssetDetailPanel` (`frontend/src/components/assets/AssetDetailPanel.tsx`)

Panel deslizante que aparece al seleccionar un activo en `EquiposPage`. Estructura de 7 tabs:

| Tab | Key | Contenido |
|---|---|---|
| Info | `info` | Metadata del activo (código, tipo, fabricante, modelo, ubicación, número de serie, garantía, notas) + activo padre (si tiene `parent_asset_id`) + tarjeta de retiro con borde rojo (solo visible cuando `retired_at` no es null) |
| Partes (N) | `components` | DataTable de `AssetComponentDetailRead` + botón "Instalar Componente" → `InstallComponentModal` + botón Trash por fila → `RemoveComponentModal` |
| Historial | `history` | DataTable de `AssetComponentHistoryItem` desde `v_asset_repair_history` |
| Asignaciones | `assignments` | Historial de asignaciones con JOINed emails + botón "Asignar / Reasignar" → `AssignAssetModal` |
| Sub-activos (N) | `children` | DataTable de activos hijos (donde `parent_asset_id = id`) |
| Mant. (N) | `maintenance` | DataTable de `WorkOrderRead` + botón "Nueva Orden" → `WorkOrderFormModal` |
| Depr. | `depreciation` | Componente `DepreciationTab` autónomo |

**Header del panel:** `asset_code` en monospace + badge de status + botón `AlertTriangle` (retiro — oculto si `status IN ['RETIRED','DISMANTLED']`) + botón `Pencil` (editar → `AssetFormModal`) + botón `X` (cerrar panel).

**Patrón de refresh por key:** cada sección usa una clave numérica (`compKey`, `assignKey`, `woKey`) que se incrementa para forzar re-fetch sin recargar la página.

### 11.2 `DepreciationTab` (`frontend/src/components/assets/DepreciationTab.tsx`)

Componente autónomo (no levanta estado al padre):

1. Fetch `GET /api/assets/{id}/depreciation` al montar.
2. Si existe `config`:
   - 4 tarjetas KPI: Costo Original, Valor en Libros, Dep. Acumulada, % Depreciado.
   - Tabla año a año: Año · Período (inicio → fin) · Dep. Anual · Dep. Acumulada · Valor Libros. La fila del período actual se resalta en `bg-blue-500/10`.
3. Botón "Configurar / Editar depreciación" abre formulario inline (vida útil, valor residual, fecha inicio).
4. Si el activo no tiene `purchase_cost`: muestra advertencia y deshabilita el botón Guardar.

### 11.3 Modales

| Archivo | Propósito |
|---|---|
| `AssetFormModal.tsx` | Crear / editar activo. Incluye búsqueda de activo padre con debounce de 300ms (llama `listAssets` para mostrar dropdown) |
| `InstallComponentModal.tsx` | Instalar componente: búsqueda de producto + cantidad + número de serie + notas |
| `RemoveComponentModal.tsx` | Remover componente: toggle `is_reusable` (determina si se genera movimiento RETURN al inventario) + motivo + notas |
| `AssignAssetModal.tsx` | Asignar/reasignar activo: select de usuario + campo ubicación + notas. Valor especial `__none__` en el select es convertido a `null` antes del POST (para desasignar) |
| `RetireAssetModal.tsx` | Retiro formal: textarea de motivo + input valor de rescate + botón destructivo de confirmación |
| `WorkOrderFormModal.tsx` | Crear / editar orden de mantenimiento: tipo, prioridad, status (solo edición), fecha programada, costo, descripción, notas |
| `CreateCountModal.tsx` | Crear sesión de conteo: selector visual tipo (Activos físicos / Inventario de productos), fecha, filtro de ubicación (solo ASSET), notas |
| `AjusteModal.tsx` | Ajuste manual de inventario: typeahead de producto (`productosService.listProducts`, debounce 300ms), toggle Entrada/Salida (color-coded), cantidad + costo unitario + observaciones (requeridas) + fecha |

---

## 12. Flujos de Negocio

### 12.1 Instalación de Componente

```
1. Usuario abre InstallComponentModal desde AssetDetailPanel (tab Partes)
2. POST /api/assets/{id}/components
   { product_id, quantity, serial_number, notes }
3. AssetService.install_component() inserta en asset_components
4. Trigger DB fn_on_component_install dispara automáticamente:
   a. Crea inventory_movements (type=ISSUE, quantity negativa → stock baja)
   b. Crea asset_component_history (operation=INSTALL)
5. Respuesta: AssetComponentDetailRead enriquecido desde v_asset_current_components
6. Frontend incrementa compKey → re-fetch de componentes y historial
```

### 12.2 Remoción de Componente

```
1. Usuario abre RemoveComponentModal (botón Trash en la fila)
2. POST /api/assets/{id}/components/{comp_id}/remove
   { is_reusable: bool, reason?, notes? }
3. AssetService.remove_component() llama PL/pgSQL:
   SELECT fn_remove_asset_component(comp_id, reusable, user_id, reason, notes)
4. La función PL/pgSQL atómicamente:
   a. DELETE FROM asset_components WHERE id = comp_id
   b. INSERT INTO asset_component_history (operation=REMOVE)
   c. Si is_reusable=true:
      INSERT INTO inventory_movements (type=RETURN, quantity positiva → stock sube)
5. Respuesta: { "ok": true }
6. Frontend incrementa compKey → re-fetch
```

### 12.3 Retiro Formal de Activo

```
1. Usuario hace clic en AlertTriangle en el header de AssetDetailPanel
2. RetireAssetModal: textarea motivo + valor de rescate
3. POST /api/assets/{id}/retire { retirement_reason?, salvage_value? }
4. AssetService.retire_asset():
   a. Valida status NOT IN ('RETIRED', 'DISMANTLED') → 400 si falla
   b. status = 'RETIRED'
   c. retired_at = now(UTC)
   d. retirement_reason, salvage_value, retired_by = current_user.id
   e. commit()
5. En la UI: botón AlertTriangle se oculta, tarjeta de retiro (borde rojo) aparece en tab Info
```

### 12.4 Asignación de Activo

```
1. Usuario abre AssignAssetModal (botón en tab Asignaciones)
2. Select de usuario (None → sentinel "__none__") + campo ubicación + notas
3. Frontend convierte "__none__" → null antes del POST
4. POST /api/assets/{id}/assign { user_id?, location?, notes? }
5. AssetService.assign_asset():
   a. INSERT AssetAssignmentHistory (user_id puede ser null = desasignación)
   b. asset.assigned_user_id = data.user_id
   c. Si data.location: asset.location = data.location
   d. commit()
   e. SQL JOIN para devolver AssetAssignmentRead con emails
6. Frontend incrementa assignKey → re-fetch historial
```

### 12.5 Sesión de Conteo Físico

```
1. Usuario crea sesión en ConteosPage → CreateCountModal
   { count_date, location_filter?, notes? }
2. POST /api/assets/counts
3. AssetService.create_physical_count():
   a. INSERT PhysicalCount (status=DRAFT)
   b. flush() para obtener count.id
   c. SELECT Asset WHERE status NOT IN ('RETIRED','DISMANTLED')
      [AND location ILIKE location_filter si aplica]
   d. INSERT PhysicalCountLine por cada activo
      (snapshot: asset_code, asset_name, expected_location)
   e. commit()
   f. Reload con selectinload(lines)
4. Operador navega al detalle del conteo
5. Por cada activo: PATCH /counts/{id}/lines/{lid} { found: bool, scanned_location? }
   → Validación: count.status debe ser DRAFT
6. POST /counts/{id}/confirm → status=CONFIRMED, confirmed_at, confirmed_by
7. Estadísticas calculadas en Python:
   total_lines = len(lines)
   found_count = count(found is True)
   not_found_count = count(found is False)
   pending_count = total - found_count - not_found_count
```

### 12.6 Conteo Físico de Productos

```
1. Usuario crea sesión en ConteosPage → CreateCountModal (tipo=PRODUCTO)
   { count_date, count_type: "PRODUCT", notes? }
2. POST /api/assets/counts
3. AssetService.create_physical_count() para PRODUCT:
   a. INSERT PhysicalCount (count_type='PRODUCT', status=DRAFT)
   b. flush() para obtener count.id
   c. SQL que une inventory_movements y inventario para calcular
      real_qty y theoretical_qty de cada producto activo
   d. INSERT ProductCountLine por cada producto (snapshot completo)
   e. commit()
4. Operadores abren el conteo en detalle — auto-refresh cada 10s mantiene
   sincronizado si varios usuarios están contando al mismo tiempo
5. Por cada producto: PATCH /counts/{id}/product-lines/{lid}
   { counted_qty: N } — registra user_id → updated_by + updated_at
6. Al confirmar con productos sin contar (counted_qty null):
   a. Primera llamada → frontend muestra advertencia amber con conteo de no contados
   b. Segunda llamada (force) → POST /confirm procede
   c. Productos sin contar aparecen como N/A en el reporte
7. POST /counts/{id}/confirm → status=CONFIRMED
   Stats: counted_lines, discrepancy_lines, uncounted_lines calculados en Python
```

### 12.7 Ajuste Manual de Inventario

```
1. Usuario navega a Almacén → tab Ajustes → "Nuevo Ajuste"
2. AjusteModal:
   a. Typeahead busca producto por nombre/SKU (productosService.listProducts)
   b. Selecciona Entrada (qty_in) o Salida (qty_out)
   c. Llena cantidad, costo unitario (opcional), observaciones (requerido), fecha
3. POST /api/inventario/ajustes { product_id, direction, quantity, unit_cost?,
   observations, moved_on? }
4. AssetService.create_adjustment():
   a. INSERT inventory_movements con movement_type="Ajuste"
   b. qty_in = quantity si direction='in', qty_out = quantity si direction='out'
   c. moved_on = data.moved_on o date.today()
5. Frontend incrementa movKey → tabla de ajustes se recarga automáticamente
6. El ajuste afecta el stock real inmediatamente (v_inventory_current recalcula)
```

### 12.9 Cálculo de Depreciación (Línea Recta)

```
Configuración: useful_life_years, residual_value, start_date
Asset: purchase_cost (requerido)

annual_depreciation = (purchase_cost - residual_value) / useful_life_years

Para año 1..life:
  period_start = _add_years(start_date, year - 1)
  period_end   = _add_years(start_date, year) - timedelta(days=1)
  accumulated  = annual_depreciation * year
  book_value   = max(residual_value, purchase_cost - accumulated)
  is_current   = period_start <= date.today() <= period_end

Período actual = primer período donde is_current=True
  (o el último período si ya está completamente depreciado)

current_book_value   = current_period.book_value
accumulated_dep      = current_period.accumulated_depreciation
percent_depreciated  = accumulated / (cost - residual) * 100
```

Si no hay `purchase_cost`: retorna `DepreciationScheduleRead` con `periods=[]` y todos los valores `None`. No se lanza error.

### 12.10 Flujo de Órdenes de Mantenimiento

```
Creación:  POST /work-orders { title, work_type, priority, scheduled_date?, cost?, notes? }
           status inicial = OPEN

Progresión típica:
  OPEN → IN_PROGRESS (PATCH con status + started_at)
       → DONE (PATCH con status + completed_at + cost)
       → CANCELLED (si se cancela)

Listado ordenado: OPEN primero, IN_PROGRESS segundo, resto tercero;
                  dentro de cada grupo por created_at DESC
```

---

## 13. Paleta de Colores

### 13.1 Estados de Activo

| Estado | Clases Tailwind |
|---|---|
| `ACTIVE` | `border-emerald-500/30 bg-emerald-500/10 text-emerald-600` |
| `IN_REPAIR` | `border-amber-500/30 bg-amber-500/10 text-amber-600` |
| `IDLE` | `border-slate-500/30 bg-slate-500/10 text-slate-500` |
| `RETIRED` | `border-red-500/30 bg-red-500/10 text-red-600` |
| `DISMANTLED` | `border-red-700/30 bg-red-700/10 text-red-700` |

### 13.2 Operaciones de Historial de Componentes

| Operación | Color |
|---|---|
| `INSTALL` | emerald |
| `REMOVE` | red |
| `REPLACE` | blue |

### 13.3 Órdenes de Mantenimiento — Status

| Status | Color |
|---|---|
| `OPEN` | amber |
| `IN_PROGRESS` | blue |
| `DONE` | emerald |
| `CANCELLED` | slate |

### 13.4 Órdenes de Mantenimiento — Prioridad

| Prioridad | Clases Tailwind |
|---|---|
| `URGENT` | `text-red-600 font-bold` |
| `HIGH` | `text-orange-500` |
| `MEDIUM` | `text-amber-600` |
| `LOW` | `text-slate-500` |

### 13.5 Depreciación

| Elemento | Clases Tailwind |
|---|---|
| Fila del período actual en tabla de años | `bg-blue-500/10` |

### 13.6 KPI Cards — AlmacenPage

| Tarjeta | Color |
|---|---|
| Con Stock | `border-emerald-500/30 bg-emerald-500/10 text-emerald-300` |
| Sin Stock | `border-amber-500/30 bg-amber-500/10 text-amber-300` |
| Stock Negativo | `border-red-500/30 bg-red-500/10 text-red-300` |
| Valor Real | `border-blue-500/30 bg-blue-500/10 text-blue-300` |
| Valor Teórico | `border-violet-500/30 bg-violet-500/10 text-violet-300` |

---

## 14. Notas de Implementación y Advertencias

### 14.1 Stock teórico vacío

La tabla `inventario` tiene 0 filas en el estado actual (no hay sync externo configurado). Las columnas `theoretical_qty` y `theoretical_value` muestran "—" en la UI. Solo tendrán datos cuando se configure e implemente el proceso de sync externo.

### 14.2 Múltiples Alembic heads — regla crítica

El proyecto tiene **dos heads** conviviendo:
- Rama TOTP: `20260429_0027`
- Cadena de assets: `20260430_0033`

**Nunca ejecutar `alembic upgrade head`** — Alembic no sabe cuál head usar y puede fallar o ejecutar en orden incorrecto. Siempre usar el ID de revisión concreto:

```bash
docker compose exec backend alembic upgrade 20260430_0033
```

### 14.3 `_add_years()` — manejo de año bisiesto

La función módulo-nivel `_add_years(d, years)` reemplaza a `dateutil.relativedelta` (no instalada en el proyecto). Maneja el caso de 29 de febrero en años no bisiestos retrocediendo al día 28:

```python
def _add_years(d: date, years: int) -> date:
    try:
        return d.replace(year=d.year + years)
    except ValueError:
        return d.replace(year=d.year + years, day=28)
```

### 14.4 Parámetros SQL con psycopg3

Todos los parámetros en llamadas SQL de texto deben usar `CAST(:param AS type)` — nunca la sintaxis `::type` de PostgreSQL. Esto es obligatorio para psycopg3. Ejemplo en `remove_component`:

```python
SELECT fn_remove_asset_component(
    CAST(:comp_id   AS UUID),
    CAST(:reusable  AS BOOLEAN),
    CAST(:user_id   AS UUID),
    CAST(:reason    AS TEXT),
    CAST(:notes     AS TEXT)
)
```

### 14.5 Patrón de refresh por key en `AssetDetailPanel`

Las tabs que pueden mutar datos (Partes, Asignaciones, Mant.) usan claves numéricas para forzar re-fetch sin desmontar el panel completo:

```tsx
const [compKey, setCompKey] = useState(0)
// Después de instalar o remover:
setCompKey(k => k + 1)
```

### 14.6 Sentinel `__none__` para desasignar

En `AssignAssetModal`, el select de usuarios incluye la opción con valor `"__none__"`. El componente convierte este valor a `null` antes de llamar a `assetsService.assignAsset()`, lo que hace que el backend establezca `asset.assigned_user_id = null`.

### 14.7 Tarjeta de retiro en tab Info

La tarjeta con borde rojo que muestra los detalles del retiro solo se renderiza cuando `asset.retired_at !== null`. El botón `AlertTriangle` del header se oculta cuando `status` es `RETIRED` o `DISMANTLED`.

### 14.8 `DepreciationTab` es autónomo

`DepreciationTab` gestiona su propio estado y fetcher — no levanta datos al `AssetDetailPanel`. Esto mantiene el panel principal liviano y evita que un error en depreciación afecte las otras tabs.

### 14.9 Múltiples Alembic heads — head actualizado

Con la migración `20260505_0034` la cadena de assets queda en:
- Rama TOTP: `20260429_0027`
- Cadena de assets (ahora head): `20260505_0034`

Para aplicar la migración:
```bash
docker compose exec backend alembic upgrade 20260505_0034
```

### 14.10 Colaboración multi-usuario en conteos de productos

Los conteos de productos (`count_type='PRODUCT'`) pueden ser trabajados por múltiples operadores simultáneamente. El frontend implementa un refresh automático cada 10 segundos cuando el conteo está en `DRAFT`. Cada PATCH de línea registra `updated_by`/`updated_at` en la base de datos, y el frontend lo muestra en la columna "Contado por".

### 14.11 Confirmación de conteo con productos sin contar

Cuando se intenta confirmar un conteo `PRODUCT` con líneas sin `counted_qty`, el frontend:
1. Detecta `uncounted_lines > 0` en la respuesta del `GET /counts`
2. Muestra un banner amber con el número de productos no contados
3. Ofrece botones "Sí, confirmar" (procede con `force=true`) y "Cancelar"
4. Los productos sin contar quedan en el reporte con `N/A`

Esto permite cerrar conteos parciales sin bloquear el flujo operativo.

### 14.12 Columna Diferencia en tabla de stock

En `AlmacenPage`, la columna "Diferencia" calcula `quantity_on_hand - theoretical_qty` en el frontend (no viene del backend). Es un campo computed en la tabla:
- `theoretical_qty = null`: muestra "—"
- `diff = 0`: muestra "0" en muted
- `diff > 0`: flecha verde ↑ (más stock real que teórico)
- `diff < 0`: flecha roja ↓ (menos stock real que teórico)

### 14.14 Scroll independiente en DataTable

`DataTable` con prop `maxHeight` coloca scroll horizontal y vertical en el mismo contenedor:

```tsx
<div
  style={maxHeight ? { maxHeight } : undefined}
  className={cn("overflow-x-auto", maxHeight ? "overflow-y-auto" : "")}
>
```

| Tabla | `maxHeight` |
|---|---|
| AlmacenPage — tabla principal | `calc(100vh - 430px)` |
| EquiposPage — tabla principal | `calc(100vh - 320px)` |
| AssetDetailPanel — componentes/historial | `300px` |
