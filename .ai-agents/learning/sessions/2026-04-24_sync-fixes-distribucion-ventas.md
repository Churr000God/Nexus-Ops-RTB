# Sesion: Correcciones de Sync, Importador CSV y Distribucion de Ventas por Producto

**Fecha:** 2026-04-24
**Agente:** Claude Sonnet 4.6
**Area:** backend + db + scripts
**Sprint:** 3
**Duracion aprox:** 3 horas

## Objetivo

1. Ejecutar la funcion "Actualizar datos" desde terminal via webhook n8n.
2. Producir dos tablas de verificacion: IDs con match en BD vs IDs sin match.
3. Implementar flag `--force` para reimportacion total desde CSV.
4. Diagnosticar y corregir errores que impedian que el sync completara.
5. Corregir anomalia en grafica "Distribucion de Ventas por Producto".

## Contexto Previo

- El sync via n8n funcionaba parcialmente pero fallaba con varios errores de BD.
- La funcion de reemplazo total (`--mode replace`) estaba referenciada en `setup-db.sh` pero nunca implementada en el script.
- La grafica de distribucion de ventas por producto mostraba qty=0 con revenue>0 para items pendientes.

## Trabajo Realizado

### 1. Ejecucion de sync y verificacion de IDs
- Login via API, disparo de `POST /api/sync/trigger`, monitoreo de estado.
- Script de verificacion ad-hoc que lee CSVs, extrae UUIDs y consulta BD para producir tabla CON MATCH y SIN MATCH.

### 2. Fix: columnas GENERATED ALWAYS en GoodsReceipt
- `total_cost`, `delivery_percent`, `qty_requested_converted` en `entradas_mercancia` eran GENERATED ALWAYS en Postgres pero en el modelo SQLAlchemy estaban como columnas normales.
- `_bulk_upsert` no las excluia del SET del UPDATE, causando error de Postgres.
- Solucion: declarar las tres con `Computed(..., persisted=True)` en `GoodsReceipt`.
- Archivo: `backend/app/models/ops_models.py`

### 3. Fix: FK quote_id sin validacion en cotizacion_items y ventas
- `_import_quote_items` y `_import_cancelled_quotes` y `_import_sales` usaban `_parse_uuid` directo para `quote_id`.
- Cuando n8n envia solo cambios del dia, puede llegar un item cuya cotizacion padre no esta en el batch → ForeignKeyViolation.
- Solucion: reemplazar `_parse_uuid(...)` por `_fk_or_none(conn, "cotizaciones", _parse_uuid(...))`.
- Archivo: `backend/alembic/versions/20260419_0002_import_csv_data.py`

### 4. Fix: conflict_cols incorrecto en proveedor_productos
- El upsert usaba `conflict_cols=["product_id", "supplier_id", "supplier_type"]` pero no existe constraint UNIQUE en esas columnas (solo PK en `id`).
- Con product_id/supplier_id NULL (se resuelven despues), el ON CONFLICT no actuaba y el INSERT colisionaba en el PK.
- Solucion: cambiar a `conflict_cols=["id"]`.
- Archivo: `backend/alembic/versions/20260419_0002_import_csv_data.py`

### 5. Implementacion de flag --force en sync_csv_data.py
- `setup-db.sh` llamaba `--mode replace` que nunca existio en el script.
- Implementado `--force`: salta el check de hash (`_already_imported`) y reimporta todos los CSVs de `data/csv/`.
- Corrected `setup-db.sh` para usar `--force` en lugar de `--mode replace`.
- Archivos: `backend/scripts/sync_csv_data.py`, `scripts/setup-db.sh`

### 6. Fix: colision de headers en Bitacora de Movimientos
- El CSV tiene dos columnas que normalizan al mismo key:
  - Col [0] `id_movimiento` → UUID del registro (el ID real)
  - Col [1] `ID / movimiento` → numero legible como `S-2295`
- `csv.DictReader` hace last-wins: el UUID quedaba sobrescrito por `S-2295`.
- `_parse_uuid('S-2295') = None` → movement_id = None → todas las filas saltadas (0 importados de 8).
- Solucion A (`_read_csv_rows`): reemplazar DictReader por lector manual con `csv.reader` que detecta colisiones al normalizar headers y renombra duplicados con sufijo `_2`, `_3`, etc. Preserva ambos valores.
- Solucion B (`_import_inventory_movements`): agregar aliases para columnas con nombres distintos al esperado:
  - `id_movimiento_2` → movement_number
  - `cantidad_entrante` → qty_in
  - `cantidad_por_no_conformidad` → qty_nonconformity
  - `referencia_entrada` → goods_receipt_id
  - `referencia_salida` → quote_item_id
- Archivos: `backend/alembic/versions/20260419_0002_import_csv_data.py`, `backend/scripts/sync_csv_data.py`

### 7. Fix: Distribucion de ventas por producto usa subtotal en lugar de accumulated_sales
- La query en `sales_distribution_by_product` usaba `SUM(ci.subtotal)` para revenue.
- `ci.subtotal` se llena al aprobar la cotizacion, independiente de si se empacan los items.
- Items con status `Pendiente` contribuian al revenue pero con qty=0 (nada empacado).
- Resultado: producto 041-01-0123 mostraba qty=0, revenue=$19,987, 3%.
- Solucion: cambiar `ci.subtotal` → `ci.accumulated_sales` en ambas CTEs (total_ventas y productos_venta).
- Archivo: `backend/app/services/ventas_service.py`

## Decisiones Tomadas

- **_fk_or_none para quote_id en items**: si la cotizacion padre no llego en este batch, el item se importa con quote_id=NULL en lugar de fallar. Se resuelve en el siguiente sync cuando llegue la cotizacion.
- **Primer valor gana en colision de headers**: cuando dos columnas normalizan al mismo nombre, se renombra la segunda con sufijo `_2`. Esto preserva el UUID (siempre en la primera columna de Notion) y permite recuperar el valor duplicado con un alias explicito en el importador.
- **accumulated_sales para revenue (Opcion A)**: refleja solo lo realmente entregado/empacado, no lo comprometido. Items Pendiente = qty 0 y revenue 0 hasta que se empacan.
- **--force no se ejecuto en produccion**: el flag se implemento y se dejo listo para cuando el usuario decida hacer un reemplazo total controlado.

## Errores Encontrados

- ERR-0014: GoodsReceipt columnas GENERATED ALWAYS no declaradas con Computed() → ver resolucion
- ERR-0015: ForeignKeyViolation quote_id en sync parcial (solo cambios del dia) → ver resolucion
- ERR-0016: UniqueViolation en proveedor_productos_pkey por conflict_cols incorrecto → ver resolucion
- ERR-0017: Colision de headers CSV en Bitacora causa perdida de UUID → ver resolucion

## Lecciones Aprendidas

- Cuando una columna Postgres es GENERATED ALWAYS, el modelo SQLAlchemy DEBE usar `Computed(..., persisted=True)`. Sin eso, `_bulk_upsert` la incluye en el UPDATE SET y Postgres rechaza la operacion.
- El sync delta (solo cambios del dia) requiere que todas las FKs usen `_fk_or_none`. Si el padre no cambio hoy, no estara en el batch pero si puede no estar en BD si es nuevo.
- `csv.DictReader` hace last-wins con headers duplicados. Para CSVs con headers que normalizan igual (e.g. `id_movimiento` y `ID / movimiento`), se debe usar un lector personalizado con `csv.reader`.
- Notion exporta el UUID de la pagina en la primera columna; las columnas con nombre similar pero de tipo relacion/formula van despues. El UUID siempre esta en la primera ocurrencia del key normalizado.

## Estado Final

- Sync ejecutado correctamente: 15 datasets procesados, todos con status=success.
- bitacora_movimientos: 8/8 UUIDs parseados correctamente (verificado en contenedor).
- Distribucion de ventas por producto: muestra solo ventas realmente empacadas.
- Flag --force implementado y listo para uso futuro.
