# ERR-0015: ForeignKeyViolation quote_id en sync parcial (solo cambios del dia)

**Fecha:** 2026-04-24
**Area:** backend + scripts
**Severidad:** alto
**Estado:** resuelto

## Descripcion

```
psycopg.errors.ForeignKeyViolation: insert or update on table "cotizacion_items"
violates foreign key constraint "cotizacion_items_quote_id_fkey"
DETAIL: Key (quote_id)=(34bdf670-...) is not present in table "cotizaciones".
```
Mismo error en tabla `ventas` con `ventas_quote_id_fkey`.

## Contexto

El sync delta de n8n solo envia CSVs de registros modificados hoy. Un `cotizacion_item` o una `venta` pueden referenciar una cotizacion que:
- No cambio hoy → no esta en el batch.
- Es nueva (creada hoy) pero no fue capturada en el CSV de cotizaciones de ese batch.

`_import_quote_items`, `_import_cancelled_quotes` e `_import_sales` usaban `_parse_uuid(...)` directo para `quote_id`, sin verificar si la cotizacion existe en BD.

## Causa Raiz

El importador original fue disenado asumiendo que siempre llegaria el dataset completo. Con syncs delta, la cotizacion padre puede estar ausente del batch actual.

## Solucion

Reemplazar `_parse_uuid(row.get("cotizacion_relacionada"))` por `_fk_or_none(conn, "cotizaciones", _parse_uuid(...))` en los tres importadores afectados.

Efecto: si la cotizacion no existe en BD, `quote_id = NULL`. El item se importa correctamente. En el siguiente sync donde llegue la cotizacion, un UPDATE posterior puede resolver la FK si se implementa un paso de reconciliacion (pendiente).

## Prevencion

Toda FK que referencie una tabla que puede estar ausente en un sync delta debe usar `_fk_or_none`. Revisar todos los importadores al agregar nuevas relaciones.

## Archivos Afectados

- `backend/alembic/versions/20260419_0002_import_csv_data.py` — funciones `_import_quote_items`, `_import_cancelled_quotes`, `_import_sales`
