# ERR-0016: UniqueViolation en proveedor_productos_pkey por conflict_cols incorrecto

**Fecha:** 2026-04-24
**Area:** backend + db
**Severidad:** alto
**Estado:** resuelto

## Descripcion

```
psycopg.errors.UniqueViolation: duplicate key value violates unique constraint
"proveedor_productos_pkey"
DETAIL: Key (id)=(0a0beb86-91d3-423d-adf5-0b89cb3943eb) already exists.
```

## Contexto

`_import_supplier_products` usaba `conflict_cols=["product_id", "supplier_id", "supplier_type"]`. La tabla `proveedor_productos` solo tiene PK en `id` — no existe constraint UNIQUE en esas tres columnas.

## Causa Raiz

`ON CONFLICT (product_id, supplier_id, supplier_type) DO UPDATE` requiere un constraint UNIQUE en esas columnas. Como no existe, Postgres no puede usar ese ON CONFLICT correctamente. Con `product_id` y `supplier_id` en NULL (se resuelven en un paso posterior), el conflict targeting falla y el INSERT procede sin manejo de conflicto, colisionando con el PK cuando el mismo UUID se intenta insertar dos veces.

## Solucion

Cambiar `conflict_cols=["product_id", "supplier_id", "supplier_type"]` a `conflict_cols=["id"]`. Cada registro de Notion tiene un UUID unico, que es la clave correcta para el upsert.

## Prevencion

El `conflict_cols` en `_bulk_upsert` debe corresponder a un constraint UNIQUE o PK real en la tabla. Verificar con `\d tabla` en psql antes de definir el conflict target.

## Archivos Afectados

- `backend/alembic/versions/20260419_0002_import_csv_data.py` — funcion `_import_supplier_products`
