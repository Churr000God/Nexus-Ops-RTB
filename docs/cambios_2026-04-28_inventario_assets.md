# Módulo Inventario v2 + Assets — Implementación completa (2026-04-28)

## Contexto

Se implementó el módulo descrito en
`Reestructuracion_Bases_Datos/13_modulo_inventario_assets.docx`.
Cubre tres niveles de gestión:

```
Nivel 1 — Stock por SKU          → inventory_movements como fuente de verdad
Nivel 2 — Inventario segmentado  → is_saleable (vendible / interno)
Nivel 3 — Equipos físicos        → assets + componentes intercambiables + historial
```

Este módulo depreca la tabla rollup `inventario` como fuente de stock real y migra
a movimientos acumulados para mayor precisión.

---

## Base de Datos

### Migraciones aplicadas

| Revisión | Archivo | Contenido |
|---|---|---|
| `20260428_0019` | `20260428_0019_inventario_assets_deuda_tecnica.py` | Renombres, inversión de valores, backfill de FKs, fórmulas corregidas |
| `20260428_0020` | `20260428_0020_inventario_assets_ddl.py` | 4 tablas nuevas + 2 ALTER TABLE |
| `20260428_0021` | `20260428_0021_inventario_assets_vistas_triggers.py` | 6 vistas + 3 funciones/triggers + pg_cron |

---

### Migración 0019 — Deuda técnica y corrección de fórmulas

#### Renombres de tabla y columna

| Objeto | Antes | Después |
|---|---|---|
| Tabla | `movimientos_inventario` | `inventory_movements` |
| Columna | `productos.is_internal` | `productos.is_saleable` |

**Inversión de valores `is_saleable`:**
El campo `is_internal` usaba `FALSE` = "vendible" (semántica contraria).
Al renombrarlo a `is_saleable` se ejecutó:
```sql
UPDATE productos SET is_saleable = NOT is_saleable;
ALTER COLUMN is_saleable SET DEFAULT TRUE;
```

#### Funciones actualizadas (4)

Se actualizaron los cuerpos de las funciones que referenciaban el nombre antiguo:
- `fn_recalc_product_avg_cost`
- `fn_refresh_all_avg_costs`
- `fn_packing_inv_movement`
- `fn_create_inv_movement_from_receipt`

#### Backfill de FKs

Antes de este módulo, `solicitudes_material`, `entradas_mercancia` e `inventario`
no tenían FK directa a `productos.id` (referenciaban por SKU / código interno).
Se realizó backfill con joins naturales:

| Tabla | FK rellenada via |
|---|---|
| `solicitudes_material` (~860 filas) | `product_sku = productos.sku` |
| `entradas_mercancia` (~1260 filas) | `external_product_id → cotizacion_items → productos.id` |
| `inventario` (~69 filas) | `internal_code = productos.sku` |

#### Función `recompute_inventory_rollups` — fórmulas corregidas

Reemplaza la versión anterior que sumaba movimientos (circular). Las nuevas fórmulas
leen directamente las tablas fuente:

```sql
real_in  = SUM(entradas_mercancia.qty_arrived)
real_out = SUM(cotizacion_items.qty_packed WHERE estado LIKE 'Aprob%')
th_in    = SUM(solicitudes_material.qty_requested)
th_out   = SUM(cotizacion_items.qty_requested WHERE estado LIKE 'Aprob%')
nc_adj   = SUM(no_conformes.inventory_adjustment)
```

---

### Migración 0020 — DDL nuevas tablas

#### Tablas nuevas (4)

**`inventory_snapshots`** — Cierre mensual de stock.
- `UC (product_id, snapshot_date)` — idempotente
- Campos: `quantity_on_hand`, `avg_unit_cost`, `total_value`

**`assets`** — Equipos físicos de la empresa.
- `asset_type CHECK IN ('COMPUTER','LAPTOP','PRINTER','MACHINE','VEHICLE','TOOL','OTHER')`
- `status CHECK IN ('ACTIVE','IN_REPAIR','IDLE','RETIRED','DISMANTLED')` — default `ACTIVE`
- FK opcionales: `base_product_id → productos`, `assigned_user_id → users`
- Campos: `asset_code (UNIQUE)`, `serial_number`, `manufacturer`, `model`, `location`,
  `purchase_date`, `purchase_cost`, `warranty_until`, `notes`

**`asset_components`** — Piezas actualmente instaladas en un equipo.
- FK `asset_id → assets ON DELETE CASCADE`
- FK `product_id → productos ON DELETE SET NULL`
- Un INSERT dispara automáticamente el trigger `fn_on_component_install`

**`asset_component_history`** — Log inmutable de operaciones.
- `operation CHECK IN ('INSTALL','REMOVE','REPLACE')`
- FK `inventory_movement_id → inventory_movements ON DELETE SET NULL`
- FK `nc_id → no_conformes ON DELETE SET NULL`
- Nunca se borra — es trazabilidad permanente

#### ALTER TABLE

**`no_conformes`** — 2 columnas nuevas:
- `nc_source TEXT NOT NULL DEFAULT 'SUPPLIER'` — `CHECK IN ('SUPPLIER','CUSTOMER_RETURN','ASSET_REMOVAL','PHYSICAL_COUNT','OTHER')`
- `asset_id UUID FK → assets ON DELETE SET NULL`

**`inventory_movements`** — 2 columnas nuevas (para trazabilidad de equipos):
- `source_type TEXT` — valores: `ASSET_INSTALL`, `ASSET_REMOVE`
- `source_id UUID` — ID del componente de equipo origen

---

### Migración 0021 — Vistas, triggers y pg_cron

#### Vistas (6)

| Vista | Descripción |
|---|---|
| `v_inventory_current` | Stock desde `inventory_movements`: `qty_on_hand`, `avg_unit_cost`, `total_value`, `stock_status` |
| `v_inventory_kpis` | ABC (A/B/C), días sin movimiento, semáforo de stock, acción sugerida por SKU |
| `v_saleable_inventory` | `v_inventory_current` filtrada a `is_saleable = TRUE` |
| `v_internal_inventory` | `v_inventory_current` filtrada a `is_saleable = FALSE` |
| `v_asset_current_components` | Componentes vigentes por equipo con SKU, email del instalador |
| `v_asset_repair_history` | Historial cronológico de instalaciones/retiros por equipo |

**Lógica de `stock_status` en `v_inventory_current`:**
```
qty_on_hand = 0          → 'OUT'
qty_on_hand < min_stock  → 'BELOW_MIN'
else                     → 'OK'
```

#### Funciones y triggers (3)

**`fn_on_component_install()`** — `AFTER INSERT ON asset_components`
1. Registra movimiento `ISSUE` en `inventory_movements` (`source_type='ASSET_INSTALL'`)
2. Inserta en `asset_component_history` con `operation='INSTALL'`

**`fn_remove_asset_component(comp_id, is_reusable, user_id, reason, notes)`** — función plpgsql atómica
- Si `is_reusable = TRUE` → genera movimiento `RETURN_IN` (pieza vuelve al stock)
- Si `is_reusable = FALSE` → crea `no_conformes` con `nc_source='ASSET_REMOVAL'` + movimiento `ADJUSTMENT_OUT`
- Siempre inserta en `asset_component_history` con `operation='REMOVE'`
- Siempre elimina el registro de `asset_components`

**`fn_close_monthly_snapshot()`** — función utilitaria
- `INSERT INTO inventory_snapshots FROM v_inventory_current ON CONFLICT DO UPDATE`
- Idempotente: puede ejecutarse múltiples veces en el mismo mes
- Retorna `INTEGER` con el número de productos snapshooteados

#### pg_cron

```sql
SELECT cron.schedule(
  'close-monthly-inventory-snapshot',
  '0 23 28-31 * *',
  $$ SELECT fn_close_monthly_snapshot() $$
);
```

Ejecuta el cierre mensual los días 28-31 de cada mes a las 23:00.

---

## Backend (FastAPI)

### Archivos nuevos

| Archivo | Descripción |
|---|---|
| `app/models/assets_models.py` | 4 modelos: `Asset`, `AssetComponent`, `AssetComponentHistory`, `InventorySnapshot` |
| `app/schemas/assets_schema.py` | Schemas Create/Read/Update + `RemoveComponentRequest` + `InventoryCurrentRead` + `InventoryKpiSummaryRead` |
| `app/services/assets_service.py` | `AssetService` — CRUD + componentes + historial + snapshots + inventario v2 |
| `app/routers/assets.py` | 3 routers: `router` (`/api/assets`), `snapshot_router` (`/api/inventario/snapshots`), `inventory_router` (`/api/inventario`) |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `app/models/ops_models.py` | `Producto.is_internal` → `is_saleable` (default `True`); `MovimientoInventario.__tablename__` → `inventory_movements` |
| `app/models/__init__.py` | Exporta los 4 nuevos modelos de assets |
| `app/main.py` | Registra `assets_router`, `snapshot_router`, `assets_inventory_router` |
| `backend/tests/conftest.py` | Tabla `movimientos_inventario` → `inventory_movements` en fixtures |
| `backend/scripts/sync_csv_data.py` | Referencias a `movimientos_inventario` → `inventory_movements` |
| `scripts/bootstrap_triggers.sql` | Ídem en cuerpos de funciones SQL |

### Endpoints (14)

```
# Assets CRUD
GET    /api/assets                                    — lista con filtros (status, asset_type, location)
POST   /api/assets                                    — crear equipo
GET    /api/assets/{id}                               — detalle
PATCH  /api/assets/{id}                               — editar

# Componentes
GET    /api/assets/{id}/components                    — componentes actuales (v_asset_current_components)
POST   /api/assets/{id}/components                    — instalar componente (trigger automático)
POST   /api/assets/{id}/components/{cid}/remove       — retirar componente (fn_remove_asset_component)

# Historial
GET    /api/assets/{id}/history                       — historial de operaciones (v_asset_repair_history)

# Snapshots
GET    /api/inventario/snapshots                      — listar cierres mensuales
POST   /api/inventario/snapshots/close-month          — ejecutar cierre manual

# Inventario v2
GET    /api/inventario/kpis-v2                        — KPIs desde v_inventory_current + assets
GET    /api/inventario/vendible                       — stock vendible (is_saleable=TRUE)
GET    /api/inventario/interno                        — stock interno (is_saleable=FALSE)
```

### Notas técnicas

**psycopg3 — CAST explícito para parámetros UUID:**
```python
await self.db.execute(text("""
    SELECT fn_remove_asset_component(
        CAST(:comp_id  AS UUID),
        CAST(:reusable AS BOOLEAN),
        CAST(:user_id  AS UUID),
        CAST(:reason   AS TEXT),
        CAST(:notes    AS TEXT)
    )
"""), {...})
```
psycopg3 no infiere el tipo de parámetros nulos — siempre se usa `CAST(:param AS type)`.

**Trigger DROP + CREATE — comandos separados:**
psycopg3 rechaza múltiples comandos en un solo `op.execute()`. El DROP y CREATE del trigger
van en llamadas separadas:
```python
op.execute("DROP TRIGGER IF EXISTS trg_asset_component_install ON asset_components")
op.execute("CREATE TRIGGER trg_asset_component_install ...")
```

---

## Frontend (React + TypeScript)

### Archivos nuevos

| Archivo | Descripción |
|---|---|
| `src/types/assets.ts` | `InventoryCurrentItem`, `InventoryKpiV2`, `AssetRead`, `AssetComponentDetail`, `AssetComponentHistoryItem` |
| `src/services/assetsService.ts` | `getKpisV2`, `getVendible`, `getInterno`, `listAssets`, `getComponents`, `getHistory` |
| `src/pages/EquiposPage.tsx` | Gestión de activos físicos: lista filtrable + detalle con tabs Componentes/Historial |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/pages/Inventarios.tsx` | Reescrito: KPIs desde `/api/inventario/kpis-v2` + tabs Vendible/Interno con filtro por `stock_status` |
| `src/components/common/DataTable.tsx` | Añadida prop opcional `selectedRowKey` para resaltar fila activa |
| `src/components/layout/Sidebar.tsx` | Nav item "Equipos" con icono `Laptop` |
| `src/routes.tsx` | Ruta `/equipos` → `EquiposPage` |

### Página `/inventarios` — KPIs v2 (7 tarjetas)

| KPI | Fuente |
|---|---|
| Valor Total Real | `valor_total_real` (costo promedio × stock actual) |
| Valor Vendible | `valor_total_vendible` |
| Valor Interno | `valor_total_interno` |
| Equipos Registrados | `total_assets` + badge si hay en reparación |
| Sin Stock | `productos_out_of_stock` |
| Bajo Mínimo | `productos_below_min` |
| Total SKUs | `total_productos` |

Los botones Reporte/CSV/Email siguen usando la API legacy (`/api/inventario/kpis`).

### Página `/equipos`

- Tabla de activos con filtros por tipo y estado
- Click en fila → panel de detalle debajo con dos tabs:
  - **Componentes** — consulta `v_asset_current_components`
  - **Historial** — consulta `v_asset_repair_history` (últimos 200 registros)
- Operaciones de escritura (crear equipo, instalar/retirar componente) pendientes de UI

---

## Notas de despliegue

```bash
# Migraciones ya aplicadas en Supabase (0019, 0020 y 0021):
docker compose exec backend alembic upgrade head

# Rebuild seguro:
docker compose up -d --build backend frontend
```

### Verificación post-deploy

```sql
-- Tablas nuevas
SELECT tablename FROM pg_tables
WHERE tablename IN ('inventory_movements','inventory_snapshots','assets','asset_components','asset_component_history');

-- Vistas nuevas
SELECT viewname FROM pg_views
WHERE viewname IN ('v_inventory_current','v_inventory_kpis','v_saleable_inventory',
                   'v_internal_inventory','v_asset_current_components','v_asset_repair_history');

-- Job pg_cron
SELECT jobname, schedule FROM cron.job WHERE jobname = 'close-monthly-inventory-snapshot';
```

---

## Pendientes (no bloqueantes)

| Item | Descripción |
|---|---|
| UI: crear/editar activo | Formulario `POST/PATCH /api/assets` — endpoint listo, sin pantalla |
| UI: instalar componente | Formulario `POST /api/assets/{id}/components` — endpoint listo |
| UI: retirar componente | Formulario con `is_reusable` y razón — endpoint listo |
| Endpoint `v_inventory_kpis` | Vista con ABC, días sin movimiento y acción sugerida — definida en BD, sin ruta API |
| Migrar reportes legacy | `/api/inventario/kpis` y `/api/inventario/productos` aún leen tabla `inventario` rollup |
