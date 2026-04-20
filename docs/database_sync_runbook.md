# Nexus Ops RTB - Cambios DB y Sincronizacion CSV

Fecha: 2026-04-20

## 1) Objetivo

Este documento resume:

- cambios de estructura y migraciones aplicadas en PostgreSQL (`nexus_ops`);
- script operativo para recargar CSVs cuando se suban nuevos archivos;
- comandos principales para migrar, sincronizar y validar datos.

## 2) Cambios implementados en estructura

Se ajusto el modelo RTB para que la base soporte formulas calculadas, triggers, y carga masiva de CSV sin romper constraints.

### 2.1 Migraciones nuevas

En `backend/alembic/versions/`:

- `20260420_0003_rtb_structure.py`
  - agrega estructura RTB faltante (catalogos, relaciones y columnas operativas);
  - convierte varias columnas a `GENERATED ALWAYS AS STORED` donde aplica;
  - corrige tipos/columnas para solicitudes, entradas, ventas, no conformes, etc.

- `20260420_0004_sales_diff_vs_po_plain.py`
  - deja `ventas.diff_vs_po` como columna normal para permitir importacion desde CSV.

- `20260420_0005_add_updated_at_to_ops_tables.py`
  - agrega `updated_at` a:
    - `facturas_compras`
    - `gastos_operativos`
    - `pedidos_clientes`
    - `entradas_mercancia`

- `20260420_0006_add_updated_at_solicitudes_material.py`
  - agrega `updated_at` a `solicitudes_material`.

- `20260420_0007_add_observations_no_conformes.py`
  - agrega `observations` en `no_conformes` y migra datos desde `notes`.

### 2.2 Triggers y funciones de rollup

Archivo:

- `scripts/bootstrap_triggers.sql`

Incluye funciones/triggers para:

- rollups de cotizaciones y productos;
- pricing de productos por proveedor;
- rollups de inventario y no conformes;
- rollups de clientes;
- tiempos en pedidos;
- aging en pedidos incompletos;
- `app.recompute_all_rollups()`.

## 3) Cambios de importacion CSV

Se robustecio la carga en:

- `backend/alembic/versions/20260419_0002_import_csv_data.py`

Mejoras principales:

- evita insertar columnas `GENERATED` (para no fallar en Postgres);
- parsea booleanos/numericos/porcentajes correctamente en campos problematicos;
- corrige mapeos de columnas en pedidos/clientes/entradas/no conformes;
- mejora conteo de insertados reales con `RETURNING`;
- deduplica casos conflictivos en `proveedor_productos`.

## 4) Script operativo de sincronizacion

Archivo nuevo:

- `backend/scripts/sync_csv_data.py`

Funcion:

- sincroniza CSV -> DB por dataset con dos modos:
  - `replace`: limpia tablas objetivo y recarga;
  - `append`: inserta incremental (idempotente por hash + conflict handling).

Incluye:

- datasets completos RTB (clientes, productos, inventario, cotizaciones, ventas, compras, pedidos, etc.);
- soporte para archivos vacios (ej. `Bitacora_de_Movimientos.csv`, `Pedidos_Incompletos.csv`);
- registro de corridas en `csv_import_runs`;
- recalculo final de rollups (`app.recompute_all_rollups()`), opcional.

## 5) Comandos principales

## 5.1 Variables de entorno

PowerShell:

```powershell
$env:PYTHONPATH='backend'
$env:DATABASE_URL='postgresql+psycopg://USUARIO:PASSWORD@localhost:5432/nexus_ops'
```

## 5.2 Aplicar migraciones

```powershell
cd backend
python -m alembic -c alembic.ini upgrade head
```

## 5.3 Cargar todo desde CSV (reemplazo total)

Desde raiz del repo:

```powershell
python backend/scripts/sync_csv_data.py --mode replace
```

## 5.4 Cargar incremental

```powershell
python backend/scripts/sync_csv_data.py --mode append
```

## 5.5 Cargar solo ciertos datasets

```powershell
python backend/scripts/sync_csv_data.py --mode replace --datasets cotizaciones cotizacion_items ventas
```

## 5.6 Cargar sin recalcular rollups

```powershell
python backend/scripts/sync_csv_data.py --mode replace --skip-rollups
```

## 6) Flujo recomendado al subir nuevos CSV

1. Copiar/reemplazar archivos en `data/csv/`.
2. Ejecutar:
   - `python backend/scripts/sync_csv_data.py --mode replace`
3. Verificar conteos por tabla en Postgres.
4. Revisar `csv_import_runs` para confirmar estado `success`.

## 7) Verificaciones utiles

Conteos principales:

```sql
select 'clientes' as t, count(*) from clientes
union all select 'proveedores', count(*) from proveedores
union all select 'productos', count(*) from productos
union all select 'inventario', count(*) from inventario
union all select 'cotizaciones', count(*) from cotizaciones
union all select 'cotizacion_items', count(*) from cotizacion_items
union all select 'ventas', count(*) from ventas
union all select 'facturas_compras', count(*) from facturas_compras
union all select 'entradas_mercancia', count(*) from entradas_mercancia
union all select 'pedidos_clientes', count(*) from pedidos_clientes
union all select 'solicitudes_material', count(*) from solicitudes_material
union all select 'proveedor_productos', count(*) from proveedor_productos
union all select 'no_conformes', count(*) from no_conformes;
```

Estado de corridas:

```sql
select dataset, status, row_count, inserted_count, skipped_count, started_at, finished_at
from csv_import_runs
order by id desc
limit 50;
```

## 8) Notas operativas

- Si un CSV viene vacio, el dataset se considera sincronizado con `0` registros.
- `replace` es el modo recomendado para evitar residuos de cargas previas.
- `append` conviene para cargas incrementales controladas.
- Siempre ejecutar migraciones `head` antes de la sincronizacion cuando haya cambios de esquema.
